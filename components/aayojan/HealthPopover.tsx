'use client';

import React, { useState } from 'react';
import { CheckCircle2, ShieldAlert, Sparkles, Wrench, X } from 'lucide-react';
import { HealthReport, TypedOp } from '@/lib/engine/types';

interface HealthPopoverProps {
  health: HealthReport;
  onApplyFix: (ops: TypedOp[], description: string) => void;
}

export default function HealthPopover({
  health,
  onApplyFix,
}: HealthPopoverProps) {
  const [open, setOpen] = useState(false);

  const scoreColor =
    health.score >= 85
      ? '#2F7D5B'
      : health.score >= 65
        ? '#C98A1B'
        : '#B3402F';

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (health.score / 100) * circumference;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Plan Health Score ${health.score} out of 100. Click for itemized breakdown`}
        className="flex items-center gap-3 px-3.5 py-2 rounded-[14px] bg-white border border-[#14110F]/10 hover:border-[#14110F]/25 transition-colors cursor-pointer"
      >
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="#14110F"
              strokeOpacity="0.08"
              strokeWidth="4"
            />
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke={scoreColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <span className="absolute font-mono text-sm font-semibold tabular-nums text-[#14110F]">
            {health.score}
          </span>
        </div>
        <div className="text-left">
          <div className="text-xs text-[#6B645C]">Plan Health</div>
          <div className="text-sm font-semibold text-[#14110F] whitespace-nowrap">
            {health.deductions.length === 0
              ? 'Optimal (100/100)'
              : `${health.deductions.length} Deduction${health.deductions.length > 1 ? 's' : ''}`}
          </div>
        </div>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Plan Health Score Breakdown"
          className="absolute right-0 mt-2 w-[380px] sm:w-[440px] max-w-[92vw] z-40 bg-white rounded-[14px] border border-[#14110F]/15 shadow-xl p-5"
        >
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#14110F]/10">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#14110F]">
                Plan Health Breakdown ({health.score}/100)
              </h3>
              <p className="text-xs text-[#6B645C] mt-0.5">
                Deterministic score computed from budget bands, lead times, contingency & slack.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close health breakdown"
              className="p-1.5 rounded-lg text-[#6B645C] hover:text-[#14110F] hover:bg-[#FBF7F0]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3 max-h-[340px] overflow-y-auto">
            {health.deductions.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#2F7D5B]/10 text-[#2F7D5B] text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  All budget bands, lead times, critical-path slack, and contingency buffers are healthy.
                </span>
              </div>
            ) : (
              health.deductions.map((d) => (
                <div
                  key={d.code}
                  className="p-3.5 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-[#B3402F] flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {d.code}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-[#B3402F]">
                      -{d.points} pts
                    </span>
                  </div>
                  <p className="text-xs text-[#14110F] leading-relaxed">
                    {d.why}
                  </p>
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#6B645C] truncate">
                      Fix: {d.fix}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyFix(d.fixOps, `Health Fix: ${d.fix}`);
                        setOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#14110F] text-white text-xs font-medium hover:bg-[#14110F]/85 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Wrench className="w-3 h-3" />
                      One-Tap Fix
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#14110F]/10 flex items-center justify-between text-xs text-[#6B645C]">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B9771B]" />
              Invariants I1–I10 Verified
            </span>
            <span className="font-mono tabular-nums">
              Base 100 - {100 - health.score} = {health.score}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
