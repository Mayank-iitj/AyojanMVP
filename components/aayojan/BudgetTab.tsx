'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Lock,
  PlusCircle,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Unlock,
  Wrench,
} from 'lucide-react';
import { addDays, applyOps, diffDays } from '@/lib/engine/core';
import { EventState, ExpenseRecord, TypedOp } from '@/lib/engine/types';

interface BudgetTabProps {
  event: EventState;
  expenses: ExpenseRecord[];
  onCommitOps: (ops: TypedOp[], cause: string) => Promise<void>;
  onLogExpense: (expense: {
    category: string;
    amount: number;
    note: string;
  }) => Promise<void>;
}

export default function BudgetTab({
  event,
  expenses,
  onCommitOps,
  onLogExpense,
}: BudgetTabProps) {
  // Deterministic What-If Sliders state (FR-7: <1s local engine preview, no LLM)
  const [sliderBudget, setSliderBudget] = useState<number>(event.budget);
  const [sliderGuests, setSliderGuests] = useState<number>(event.guests);
  const [sliderDateOffset, setSliderDateOffset] = useState<number>(0);

  // Sync sliders only when committed budget, guests, date, or event ID changes
  const [lastSyncedKey, setLastSyncedKey] = useState<string>(
    `${event.id}:${event.budget}:${event.guests}:${event.event_date}`
  );
  const currentKey = `${event.id}:${event.budget}:${event.guests}:${event.event_date}`;
  if (currentKey !== lastSyncedKey) {
    setLastSyncedKey(currentKey);
    setSliderBudget(event.budget);
    setSliderGuests(event.guests);
    setSliderDateOffset(0);
  }

  // Inline category edit state
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');

  // Log Expense form state
  const [expCategory, setExpCategory] = useState<string>(event.lines[0]?.category ?? 'Catering');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expNote, setExpNote] = useState<string>('');
  const [expError, setExpError] = useState<string | null>(null);

  const hasSliderChanges =
    sliderBudget !== event.budget ||
    sliderGuests !== event.guests ||
    sliderDateOffset !== 0;

  const sliderOps = useMemo<TypedOp[]>(() => {
    const ops: TypedOp[] = [];
    if (sliderBudget !== event.budget) {
      ops.push({ op: 'SetBudget', total: sliderBudget });
    }
    if (sliderGuests !== event.guests) {
      ops.push({ op: 'SetGuests', n: sliderGuests });
    }
    if (sliderDateOffset !== 0) {
      ops.push({
        op: 'SetDate',
        date: addDays(event.event_date, sliderDateOffset),
      });
    }
    return ops;
  }, [sliderBudget, sliderGuests, sliderDateOffset, event.budget, event.guests, event.event_date]);

  const previewOutcome = useMemo(() => {
    if (!hasSliderChanges) return null;
    return applyOps(event, sliderOps);
  }, [event, hasSliderChanges, sliderOps]);

  const minSliderBudget = Math.max(25000, Math.round(event.budget * 0.45));
  const maxSliderBudget = Math.round(event.budget * 1.85);
  const stepBudget = event.budget >= 500000 ? 25000 : 5000;

  const displayedLines =
    previewOutcome && previewOutcome.ok
      ? previewOutcome.nextState.lines
      : event.lines;

  const handleToggleLock = async (category: string, currentlyLocked: boolean) => {
    const op: TypedOp = currentlyLocked
      ? { op: 'UnlockLine', category }
      : { op: 'LockLine', category };
    await onCommitOps(
      [op],
      `${currentlyLocked ? 'Unlocked' : 'Locked'} ${category} budget line`
    );
  };

  const handleSaveInlineLine = async (category: string) => {
    const parsed = Math.round(Number(editingAmount));
    if (isNaN(parsed) || parsed < 500) return;
    setEditingCategory(null);
    await onCommitOps(
      [{ op: 'SetLine', category, amount: parsed }],
      `Adjusted ${category} allocation to ₹${parsed.toLocaleString('en-IN')}`
    );
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(Number(expAmount));
    if (!expCategory || isNaN(amt) || amt <= 0) {
      setExpError('Enter a valid positive integer rupee amount.');
      return;
    }
    setExpError(null);
    await onLogExpense({
      category: expCategory,
      amount: amt,
      note: expNote.trim() || `${expCategory} vendor payment`,
    });
    setExpAmount('');
    setExpNote('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 8 Columns: Budget Allocation Table & Actual Expense Logger */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white rounded-[14px] border border-[#14110F]/10 overflow-hidden">
          <div className="p-5 border-b border-[#14110F]/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#14110F]">
                Category Budget Ledger (Version {event.version})
              </h2>
              <p className="text-xs text-[#6B645C] mt-0.5">
                Click the lock icon to freeze any category against automatic rebalancing (Invariant I6).
              </p>
            </div>
            <div className="text-right font-mono text-xs tabular-nums">
              <div className="text-[#6B645C]">Total Planned Sum (I1)</div>
              <div className="text-base font-semibold text-[#14110F]">
                ₹
                {(previewOutcome?.ok
                  ? previewOutcome.nextState.budget
                  : event.budget
                ).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#14110F]/10 bg-[#FBF7F0] text-[11px] font-semibold text-[#6B645C]">
                  <th className="py-3 px-4">Lock</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Planned (INR)</th>
                  <th className="py-3 px-4 text-right">Preview Delta</th>
                  <th className="py-3 px-4 text-right">Actual Logged</th>
                  <th className="py-3 px-4 text-right">Status / Floor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14110F]/10 text-sm">
                {displayedLines.map((line) => {
                  const baseLine = event.lines.find(
                    (l) => l.category === line.category
                  )!;
                  const delta = line.planned - baseLine.planned;
                  const utilization =
                    line.planned > 0
                      ? Math.round((baseLine.actual / line.planned) * 100)
                      : 0;
                  const isOverrun = baseLine.actual > line.planned;
                  const isNearLimit = !isOverrun && utilization >= 80;

                  return (
                    <tr
                      key={line.category}
                      className="hover:bg-[#FBF7F0]/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleLock(line.category, baseLine.locked)
                          }
                          aria-label={
                            baseLine.locked
                              ? `Unlock ${line.category}`
                              : `Lock ${line.category}`
                          }
                          className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                            baseLine.locked
                              ? 'bg-[#E8A33D]/25 border-[#B9771B] text-[#14110F]'
                              : 'bg-white border-[#14110F]/15 text-[#6B645C] hover:text-[#14110F]'
                          }`}
                        >
                          {baseLine.locked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-[#14110F]">
                          {line.category}
                        </div>
                        <div className="text-xs text-[#6B645C] font-mono tabular-nums">
                          Template {line.templatePct}% ·{' '}
                          {baseLine.locked ? 'Locked (I6)' : 'Auto-scales'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {editingCategory === line.category ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              aria-label={`Edit ${line.category} planned amount`}
                              value={editingAmount}
                              onChange={(e) => setEditingAmount(e.target.value)}
                              className="w-28 px-2 py-1 text-right text-xs border border-[#14110F]/30 rounded bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineLine(line.category)}
                              aria-label={`Save ${line.category} amount`}
                              className="p-1 rounded bg-[#14110F] text-white"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(line.category);
                              setEditingAmount(String(baseLine.planned));
                            }}
                            className="font-semibold text-[#14110F] hover:text-[#B9771B] underline decoration-dotted underline-offset-4 cursor-pointer"
                          >
                            ₹{line.planned.toLocaleString('en-IN')}
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {delta === 0 ? (
                          <span className="text-[#6B645C]">—</span>
                        ) : (
                          <span
                            className={
                              delta > 0
                                ? 'text-[#2F7D5B] font-semibold'
                                : 'text-[#C98A1B] font-semibold'
                            }
                          >
                            {delta > 0 ? '+' : ''}₹{delta.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="text-[#14110F]">
                          ₹{baseLine.actual.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-[#6B645C]">
                          {utilization}% used
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right text-xs">
                        {isOverrun ? (
                          <span className="font-semibold text-[#B3402F]">
                            Overrun (&gt;100%)
                          </span>
                        ) : isNearLimit ? (
                          <span className="font-semibold text-[#C98A1B]">
                            Alert (≥80%)
                          </span>
                        ) : (
                          <span className="font-mono text-[#6B645C] tabular-nums">
                            Floor ₹{line.floor.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actual Expense Logger & Recent Ledger (FR-13) */}
        <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6">
          <h3 className="font-display text-base font-semibold text-[#14110F]">
            Log Actual Expense Against Category
          </h3>
          <p className="text-xs text-[#6B645C] mt-0.5">
            Track real vendor payments and deposits; overruns at 80% and 100% update Plan Health automatically.
          </p>

          <form
            onSubmit={handleExpenseSubmit}
            className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-4">
              <label
                htmlFor="expense-category-select"
                className="block text-xs font-medium text-[#14110F] mb-1"
              >
                Category
              </label>
              <select
                id="expense-category-select"
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15 text-xs text-[#14110F]"
              >
                {event.lines.map((l) => (
                  <option key={l.category} value={l.category}>
                    {l.category}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="expense-amount-input"
                className="block text-xs font-medium text-[#14110F] mb-1"
              >
                Amount (Integer INR)
              </label>
              <input
                id="expense-amount-input"
                type="number"
                min={1}
                placeholder="e.g. 25000"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15 text-xs font-mono text-[#14110F]"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="expense-note-input"
                className="block text-xs font-medium text-[#14110F] mb-1"
              >
                Payment Note
              </label>
              <input
                id="expense-note-input"
                type="text"
                placeholder="Advance / token receipt"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15 text-xs text-[#14110F]"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full px-3 py-2 rounded-lg bg-[#14110F] text-white text-xs font-medium hover:bg-[#14110F]/85 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Log Spend
              </button>
            </div>
          </form>

          {expError && (
            <p className="mt-2 text-xs text-[#B3402F] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {expError}
            </p>
          )}

          {expenses.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#14110F]/10 space-y-2">
              <div className="text-xs font-semibold text-[#6B645C]">
                Recent Disbursed Expenses ({expenses.length})
              </div>
              {expenses.slice(0, 4).map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-[#14110F]/5 last:border-none"
                >
                  <div>
                    <span className="font-medium text-[#14110F]">
                      {exp.category}
                    </span>{' '}
                    <span className="text-[#6B645C]">· {exp.note}</span>
                  </div>
                  <div className="font-mono tabular-nums text-[#14110F] font-medium">
                    ₹{exp.amount.toLocaleString('en-IN')}{' '}
                    <span className="text-[#6B645C] font-normal">
                      ({exp.paid_on})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right 4 Columns: Pinned Deterministic What-If Preview Panel (FR-7) */}
      <div className="lg:col-span-4 bg-white rounded-[14px] border border-[#14110F]/15 p-6 space-y-5 sticky top-20">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#B9771B]" />
              What-If Sandbox
            </h3>
            <p className="text-xs text-[#6B645C] mt-0.5">
              Instant deterministic preview (&lt;10ms, zero LLM latency). Nothing is saved until you commit.
            </p>
          </div>
          {hasSliderChanges && (
            <button
              type="button"
              onClick={() => {
                setSliderBudget(event.budget);
                setSliderGuests(event.guests);
                setSliderDateOffset(0);
              }}
              aria-label="Reset sliders"
              className="p-1.5 rounded-lg text-xs text-[#6B645C] hover:text-[#14110F] hover:bg-[#FBF7F0] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* 1. Budget Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="whatif-budget-slider" className="font-medium text-[#14110F]">
              Total Budget (INR)
            </label>
            <span className="font-mono font-semibold tabular-nums text-[#14110F]">
              ₹{sliderBudget.toLocaleString('en-IN')}
            </span>
          </div>
          <input
            id="whatif-budget-slider"
            type="range"
            min={minSliderBudget}
            max={maxSliderBudget}
            step={stepBudget}
            value={sliderBudget}
            onChange={(e) => setSliderBudget(Number(e.target.value))}
            className="w-full accent-[#E8A33D] cursor-pointer"
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-[#6B645C] tabular-nums">
            <span>₹{minSliderBudget.toLocaleString('en-IN')}</span>
            <div className="flex gap-1.5">
              {event.type === 'wedding' && (
                <button
                  type="button"
                  onClick={() => setSliderBudget(900000)}
                  className="px-2 py-0.5 rounded bg-[#FBF7F0] border border-[#14110F]/15 text-[#14110F] hover:bg-[#E8A33D]/25 cursor-pointer"
                >
                  Set ₹9L
                </button>
              )}
              <button
                type="button"
                onClick={() => setSliderBudget(Math.round(event.budget * 0.85))}
                className="px-2 py-0.5 rounded bg-[#FBF7F0] border border-[#14110F]/15 text-[#14110F] hover:bg-[#E8A33D]/25 cursor-pointer"
              >
                -15%
              </button>
            </div>
            <span>₹{maxSliderBudget.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* 2. Guest Count Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="whatif-guests-slider" className="font-medium text-[#14110F]">
              Guest Headcount
            </label>
            <span className="font-mono font-semibold tabular-nums text-[#14110F]">
              {sliderGuests} Guests
            </span>
          </div>
          <input
            id="whatif-guests-slider"
            type="range"
            min={20}
            max={Math.max(400, event.guests * 2)}
            step={10}
            value={sliderGuests}
            onChange={(e) => setSliderGuests(Number(e.target.value))}
            className="w-full accent-[#E8A33D] cursor-pointer"
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-[#6B645C] tabular-nums">
            <span>20 pax</span>
            <button
              type="button"
              onClick={() => setSliderGuests(350)}
              className="px-2 py-0.5 rounded bg-[#FBF7F0] border border-[#14110F]/15 text-[#14110F] hover:bg-[#E8A33D]/25 cursor-pointer"
            >
              Test 350 Guests (I7)
            </button>
            <span>{Math.max(400, event.guests * 2)} pax</span>
          </div>
        </div>

        {/* 3. Date Shift Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="whatif-date-slider" className="font-medium text-[#14110F]">
              Event Date Shift
            </label>
            <span className="font-mono font-semibold tabular-nums text-[#14110F]">
              {addDays(event.event_date, sliderDateOffset)} (
              {sliderDateOffset >= 0 ? `+${sliderDateOffset}d` : `${sliderDateOffset}d`})
            </span>
          </div>
          <input
            id="whatif-date-slider"
            type="range"
            min={-Math.max(5, diffDays(event.today, event.event_date) - 5)}
            max={60}
            step={1}
            value={sliderDateOffset}
            onChange={(e) => setSliderDateOffset(Number(e.target.value))}
            className="w-full accent-[#E8A33D] cursor-pointer"
          />
        </div>

        {/* Live Preview Result Box */}
        {!hasSliderChanges ? (
          <div className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 text-xs text-[#6B645C]">
            Drag any slider above (or click <strong>Set ₹9L</strong>) to preview live budget rebalancing, locked-line protection, and Plan Health delta.
          </div>
        ) : previewOutcome && !previewOutcome.ok ? (
          <div className="p-4 rounded-xl bg-[#B3402F]/10 border border-[#B3402F]/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#B3402F]">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                Validator Blocked Invalid State (
                {previewOutcome.validation.violations[0]?.code})
              </span>
            </div>
            <p className="text-xs text-[#14110F] leading-relaxed">
              {previewOutcome.validation.violations.map((v) => v.detail).join(' ')}
            </p>
            {previewOutcome.validation.repairOps && (
              <div className="pt-2 border-t border-[#B3402F]/20 space-y-2">
                <p className="text-[11px] text-[#6B645C]">
                  Suggested Repair: {previewOutcome.validation.repairExplanation}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await onCommitOps(
                      previewOutcome.validation.repairOps!,
                      previewOutcome.validation.repairExplanation ??
                        'Applied validator conflict repair'
                    );
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-[#14110F] text-white text-xs font-medium hover:bg-[#14110F]/85 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5 text-[#E8A33D]" />
                  Repair Conflict & Commit (v{event.version + 1})
                </button>
              </div>
            )}
          </div>
        ) : (
          previewOutcome && (
            <div className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/15 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#14110F]">
                  Non-Committed Diff Preview
                </span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    previewOutcome.diff.healthDelta >= 0
                      ? 'text-[#2F7D5B]'
                      : 'text-[#C98A1B]'
                  }`}
                >
                  Health {previewOutcome.diff.healthBefore} →{' '}
                  {previewOutcome.diff.healthAfter} (
                  {previewOutcome.diff.healthDelta >= 0
                    ? `+${previewOutcome.diff.healthDelta}`
                    : previewOutcome.diff.healthDelta}
                  )
                </span>
              </div>

              <p className="text-xs text-[#6B645C] leading-relaxed">
                {previewOutcome.diff.summary}
              </p>

              <div className="text-[11px] font-mono text-[#6B645C] space-y-1 max-h-36 overflow-y-auto pt-1">
                {previewOutcome.diff.lineChanges.slice(0, 5).map((lc) => (
                  <div
                    key={lc.category}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{lc.category}</span>
                    <span className="tabular-nums">
                      ₹{lc.before.toLocaleString('en-IN')} → ₹
                      {lc.after.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onCommitOps(
                    sliderOps,
                    `What-if slider commit: Budget ₹${sliderBudget.toLocaleString('en-IN')}, ${sliderGuests} guests`
                  );
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 transition-colors cursor-pointer"
              >
                Commit Changes to Version {event.version + 1}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
