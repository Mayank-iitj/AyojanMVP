'use client';

import React, { useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Command,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  EventState,
  HealthReport,
  InvariantViolation,
  PlanDiff,
  TypedOp,
} from '@/lib/engine/types';

interface ReplanCommandModalProps {
  open: boolean;
  event: EventState;
  initialInstruction?: string;
  onClose: () => void;
  onCommitOps: (ops: TypedOp[], cause: string) => Promise<void>;
}

interface ProposalResponse {
  ops: TypedOp[];
  explanation: string;
  previewState: EventState;
  diff: PlanDiff;
  health: HealthReport;
  degradedMode: boolean;
  retriesUsed: number;
}

interface ConflictResponse {
  title: string;
  detail: string;
  code: string;
  proposed_ops?: TypedOp[];
  violations?: InvariantViolation[];
  repair_ops?: TypedOp[];
  repair_explanation?: string;
}

export default function ReplanCommandModal({
  open,
  event,
  initialInstruction = '',
  onClose,
  onCommitOps,
}: ReplanCommandModalProps) {
  const [instruction, setInstruction] = useState(initialInstruction);
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const [conflict, setConflict] = useState<ConflictResponse | null>(null);

  // Sync if initialInstruction changes while opening
  const [prevInit, setPrevInit] = useState(initialInstruction);
  if (initialInstruction !== prevInit) {
    setPrevInit(initialInstruction);
    setInstruction(initialInstruction);
    setProposal(null);
    setConflict(null);
  }

  if (!open) return null;

  const quickChips = [
    'Cut budget to Rs 9L',
    'Caterer cancelled',
    'Guests 200 to 350',
    'Lock Venue',
    'Push date 14 days later',
    'Baraat guests badha ke 230 kar do',
  ];

  const runPropose = async (textToRun: string) => {
    const clean = textToRun.trim();
    if (!clean) return;
    setInstruction(clean);
    setLoading(true);
    setProposal(null);
    setConflict(null);

    try {
      const res = await fetch(`/api/v1/events/${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replan_propose',
          instruction: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConflict(data as ConflictResponse);
      } else {
        setProposal(data as ProposalResponse);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyProposal = async () => {
    if (!proposal) return;
    await onCommitOps(proposal.ops, `Replan: "${instruction}"`);
    setProposal(null);
    setConflict(null);
    onClose();
  };

  const handleApplyRepair = async () => {
    if (!conflict?.repair_ops) return;
    await onCommitOps(
      conflict.repair_ops,
      `Validator Conflict Repair: ${conflict.repair_explanation ?? instruction}`
    );
    setProposal(null);
    setConflict(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Replan Command Bar"
      className="fixed inset-0 z-50 bg-[#14110F]/50 backdrop-blur-xs flex items-start justify-center pt-14 px-4 overflow-y-auto pb-12"
    >
      <div className="w-full max-w-2xl bg-white rounded-[14px] border border-[#14110F]/15 shadow-2xl overflow-hidden">
        {/* Top Command Input */}
        <div className="p-5 border-b border-[#14110F]/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#14110F]">
              <Command className="w-4 h-4 text-[#B9771B]" />
              <span>Natural-Language Replan Engine (Closed Typed Ops + Validator Gate)</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close replan modal"
              className="p-1 rounded-lg text-[#6B645C] hover:text-[#14110F]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runPropose(instruction);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              aria-label="Natural language replan instruction"
              placeholder='Try "Cut budget to Rs 9L", "Caterer cancelled", or "Guests 200 to 350"...'
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-[#FBF7F0] border border-[#14110F]/20 text-sm text-[#14110F] focus:outline-none focus:border-[#14110F]"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 transition-colors whitespace-nowrap cursor-pointer"
            >
              {loading ? 'Solving...' : 'Preview Ops'}
            </button>
          </form>

          {/* Scenario Chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#6B645C] mr-1">Demo edits:</span>
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => runPropose(chip)}
                className="px-2.5 py-1 rounded-lg bg-[#FBF7F0] hover:bg-[#E8A33D]/25 border border-[#14110F]/10 text-xs text-[#14110F] transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Validator Conflict Caught State (e.g., Guests 200 -> 350 exceeds Venue Capacity I7) */}
        {conflict && (
          <div className="p-6 bg-[#B3402F]/5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-[#B3402F] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#B3402F]">
                  {conflict.title} ({conflict.code})
                </div>
                <p className="text-xs text-[#14110F] leading-relaxed">
                  {conflict.detail}
                </p>
                <p className="text-[11px] text-[#6B645C]">
                  Hard Invariant Guarantee: Your persisted Version {event.version} plan was NOT modified.
                </p>
              </div>
            </div>

            {conflict.proposed_ops && conflict.proposed_ops.length > 0 && (
              <div className="p-3 rounded-xl bg-white border border-[#14110F]/10">
                <div className="text-[11px] font-semibold text-[#6B645C] mb-1.5">
                  Rejected Typed Operation(s):
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                  {conflict.proposed_ops.map((op, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded bg-[#B3402F]/10 text-[#B3402F]"
                    >
                      {JSON.stringify(op)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {conflict.repair_ops && (
              <div className="p-4 rounded-xl bg-white border border-[#2F7D5B]/35 space-y-3">
                <div className="text-xs font-semibold text-[#2F7D5B] flex items-center gap-1.5">
                  <Wrench className="w-4 h-4" />
                  Deterministic Conflict Resolution Available
                </div>
                <p className="text-xs text-[#14110F]">
                  {conflict.repair_explanation}
                </p>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-[#14110F]">
                  {conflict.repair_ops.map((op, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded bg-[#FBF7F0] border border-[#14110F]/15"
                    >
                      {op.op}
                      {'name' in op ? `("${op.name}")` : ''}
                      {'n' in op ? `(${op.n})` : ''}
                      {'total' in op ? `(₹${op.total.toLocaleString('en-IN')})` : ''}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConflict(null)}
                    className="px-3.5 py-2 rounded-lg border border-[#14110F]/15 text-xs font-medium text-[#6B645C] hover:text-[#14110F] cursor-pointer"
                  >
                    Keep Current Plan
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyRepair}
                    className="px-4 py-2 rounded-lg bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5 text-[#E8A33D]" />
                    Apply Repair & Commit v{event.version + 1}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Valid Proposal Before/After Diff View */}
        {proposal && (
          <div className="p-6 space-y-5">
            {/* Emitted Typed Ops Chips */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#14110F] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#B9771B]" />
                  Verified Typed Operations Emitted
                </span>
                <span className="font-mono text-[11px] text-[#2F7D5B] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All 10 Invariants Passed
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {proposal.ops.map((op, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15 font-mono text-xs text-[#14110F]"
                  >
                    {op.op}(
                    {'total' in op
                      ? `₹${op.total.toLocaleString('en-IN')}`
                      : 'n' in op
                        ? `${op.n} guests`
                        : 'category' in op
                          ? op.category
                          : 'date' in op
                            ? op.date
                            : 'tier' in op
                              ? op.tier
                              : ''}
                    )
                  </span>
                ))}
              </div>
            </div>

            {/* Before/After Diff Summary */}
            <div className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#14110F]">
                  Diff Preview (v{event.version} → v{event.version + 1})
                </span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    proposal.diff.healthDelta >= 0
                      ? 'text-[#2F7D5B]'
                      : 'text-[#C98A1B]'
                  }`}
                >
                  Health {proposal.diff.healthBefore} →{' '}
                  {proposal.diff.healthAfter} (
                  {proposal.diff.healthDelta >= 0
                    ? `+${proposal.diff.healthDelta}`
                    : proposal.diff.healthDelta}
                  )
                </span>
              </div>
              <p className="text-xs text-[#6B645C] leading-relaxed">
                {proposal.diff.summary}
              </p>

              {/* Budget Deltas */}
              {proposal.diff.lineChanges.length > 0 && (
                <div className="pt-2 border-t border-[#14110F]/10 space-y-1 max-h-40 overflow-y-auto font-mono text-xs tabular-nums">
                  {proposal.diff.lineChanges.map((lc) => (
                    <div
                      key={lc.category}
                      className="flex items-center justify-between"
                    >
                      <span className="font-sans text-[#14110F]">
                        {lc.category}
                      </span>
                      <span
                        className={
                          lc.delta > 0 ? 'text-[#2F7D5B]' : 'text-[#B3402F]'
                        }
                      >
                        ₹{lc.before.toLocaleString('en-IN')} → ₹
                        {lc.after.toLocaleString('en-IN')} (
                        {lc.delta > 0 ? '+' : ''}₹
                        {lc.delta.toLocaleString('en-IN')})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Task Deltas */}
              {proposal.diff.taskChanges.length > 0 && (
                <div className="pt-2 border-t border-[#14110F]/10 space-y-1 text-xs">
                  {proposal.diff.taskChanges.map((tc) => (
                    <div
                      key={tc.id}
                      className="flex items-center justify-between text-[#C98A1B]"
                    >
                      <span className="truncate">{tc.title}</span>
                      <span className="font-mono shrink-0">
                        {tc.change}: {tc.afterDue ?? tc.afterStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="px-4 py-2.5 rounded-xl border border-[#14110F]/15 text-xs font-medium text-[#6B645C] hover:text-[#14110F] cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleApplyProposal}
                className="px-5 py-2.5 rounded-xl bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 flex items-center gap-1.5 cursor-pointer"
              >
                Apply Replan (Commit v{event.version + 1})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
