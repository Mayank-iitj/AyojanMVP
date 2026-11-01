'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { diffDays } from '@/lib/engine/core';
import { EventState, HealthReport, TaskStatus, TypedOp } from '@/lib/engine/types';

interface OverviewTabProps {
  event: EventState;
  health: HealthReport;
  onApplyOps: (ops: TypedOp[], cause: string) => void;
  onNavigateTab: (tab: 'budget' | 'timeline' | 'vendors' | 'ideas' | 'history') => void;
  onRunInstruction: (instruction: string) => void;
}

export default function OverviewTab({
  event,
  health,
  onApplyOps,
  onNavigateTab,
  onRunInstruction,
}: OverviewTabProps) {
  const totalActual = event.lines.reduce((acc, l) => acc + l.actual, 0);
  const actualPct = Math.min(100, Math.round((totalActual / Math.max(1, event.budget)) * 100));
  const perGuest = Math.round(event.budget / Math.max(1, event.guests));
  const daysRemaining = diffDays(event.today, event.event_date);

  const upcomingTasks = [...event.tasks]
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 5);

  const nextTaskStatus = (current: TaskStatus): TaskStatus => {
    if (current === 'todo') return 'in_progress';
    if (current === 'in_progress') return 'done';
    if (current === 'at_risk') return 'in_progress';
    return 'todo';
  };

  return (
    <div className="space-y-8">
      {/* Top 4-Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
          <div className="text-xs text-[#6B645C]">Total Verified Budget (I1)</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
            ₹{event.budget.toLocaleString('en-IN')}
          </div>
          <div className="mt-2 text-xs text-[#6B645C] font-mono tabular-nums">
            ₹{perGuest.toLocaleString('en-IN')}/guest · {event.tier} tier (Estimate)
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
          <div className="text-xs text-[#6B645C]">Actual Spend Logged</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
            ₹{totalActual.toLocaleString('en-IN')}
          </div>
          <div className="mt-2 text-xs text-[#6B645C] font-mono tabular-nums">
            {actualPct}% of planned · {event.lines.filter((l) => l.locked).length} locked line(s)
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
          <div className="text-xs text-[#6B645C]">Countdown & Critical Path</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
            {daysRemaining} Days
          </div>
          <div className="mt-2 text-xs text-[#6B645C]">
            Event {event.event_date} · {event.tasks.filter((t) => t.critical).length} critical tasks
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
          <div className="text-xs text-[#6B645C]">Guest Count & Venue Bound (I7)</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
            {event.guests} Guests
          </div>
          <div className="mt-2 text-xs text-[#6B645C] truncate">
            Max capacity:{' '}
            <span className="font-mono tabular-nums">
              {event.vendors.find((v) => v.capacity)?.capacity ?? 250} pax
            </span>{' '}
            · {event.city} (Tier {event.city_tier})
          </div>
        </div>
      </div>

      {/* Follow-Up Questions & Assumptions Strip (FR-1) */}
      <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#14110F]">
              Brief & Quick Follow-Up Adjustments
            </h2>
            <p className="text-sm text-[#6B645C] mt-1">{event.brief.vibe}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onApplyOps(
                  [
                    { op: 'LockLine', category: event.lines[1]?.category ?? 'Venue' },
                  ],
                  `Locked ${event.lines[1]?.category ?? 'Venue'} line`
                )
              }
              className="px-3.5 py-2 rounded-lg bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-xs font-medium text-[#14110F] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#B9771B]" />
              Lock {event.lines[1]?.category ?? 'Venue'} Line
            </button>
            <button
              type="button"
              onClick={() => onRunInstruction('Cut budget to Rs 9L')}
              className="px-3.5 py-2 rounded-lg bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-xs font-medium text-[#14110F] transition-colors whitespace-nowrap cursor-pointer"
            >
              Test ₹9L Budget Cut
            </button>
            <button
              type="button"
              onClick={() => onRunInstruction('Caterer cancelled')}
              className="px-3.5 py-2 rounded-lg bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-xs font-medium text-[#14110F] transition-colors whitespace-nowrap cursor-pointer"
            >
              Simulate &ldquo;Caterer Cancelled&rdquo;
            </button>
            <button
              type="button"
              onClick={() => onRunInstruction('Guests 200 to 350')}
              className="px-3.5 py-2 rounded-lg bg-[#FBF7F0] hover:bg-[#E8A33D]/20 border border-[#14110F]/15 text-xs font-medium text-[#14110F] transition-colors whitespace-nowrap cursor-pointer"
            >
              Test 350 Guests (I7 Conflict)
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#14110F]/10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold text-[#14110F] mb-2">
              Explicit Plan Assumptions (Editable Seed Estimates)
            </div>
            <ul className="space-y-1.5 text-xs text-[#6B645C]">
              {event.brief.assumptions.map((a, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2F7D5B] shrink-0 mt-0.5" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#14110F] mb-2">
              Active Risks & Health Advisory
            </div>
            {event.risks.length === 0 && health.deductions.length === 0 ? (
              <p className="text-xs text-[#2F7D5B]">
                Zero schedule or budget risks detected in Version {event.version}.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs text-[#6B645C]">
                {event.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[#C98A1B]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{r.message}</span>
                  </li>
                ))}
                {health.deductions.slice(0, 2).map((d) => (
                  <li key={d.code} className="flex items-start gap-2 text-[#14110F]">
                    <Clock className="w-3.5 h-3.5 text-[#B9771B] shrink-0 mt-0.5" />
                    <span>
                      {d.why} (-{d.points} pts)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Next 5 Tasks + Budget Planned vs Actual Rings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 cols: Next 5 Tasks */}
        <div className="lg:col-span-7 bg-white rounded-[14px] border border-[#14110F]/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#14110F]">
                  Next 5 Scheduled Tasks
                </h3>
                <p className="text-xs text-[#6B645C]">
                  Backward-scheduled from {event.event_date} · Click status to advance
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('timeline')}
                className="text-xs font-medium text-[#B9771B] hover:text-[#14110F] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                Full Gantt Timeline
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#14110F]/10">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#6B645C]">
                      <span className="font-medium text-[#14110F]">
                        {task.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Owner: {task.owner}</span>
                      {task.critical && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#B9771B]">
                            Critical Path
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-medium text-[#14110F] mt-0.5 truncate">
                      {task.title}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono text-xs tabular-nums text-[#6B645C]">
                      <div>Due {task.due}</div>
                      <div className="text-[11px]">{task.duration_days}d window</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onApplyOps(
                          [
                            {
                              op: 'SetStatus',
                              id: task.id,
                              status: nextTaskStatus(task.status),
                            },
                          ],
                          `Updated "${task.category}" task status to ${nextTaskStatus(task.status)}`
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        task.status === 'done'
                          ? 'bg-[#2F7D5B]/15 text-[#2F7D5B]'
                          : task.status === 'at_risk'
                            ? 'bg-[#B3402F]/15 text-[#B3402F]'
                            : task.status === 'in_progress'
                              ? 'bg-[#E8A33D]/25 text-[#14110F]'
                              : 'bg-[#FBF7F0] text-[#14110F] border border-[#14110F]/15 hover:bg-[#14110F]/5'
                      }`}
                    >
                      {task.status === 'done'
                        ? 'Done'
                        : task.status === 'at_risk'
                          ? 'At Risk'
                          : task.status === 'in_progress'
                            ? 'In Progress'
                            : 'Mark Started'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Functions or Community Roster Footer */}
          {event.type === 'wedding' && event.functions.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[#14110F]/10">
              <div className="text-xs font-semibold text-[#14110F] mb-2.5">
                Multi-Function Wedding Schedule ({event.functions.length} Functions)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {event.functions.map((fn) => (
                  <div
                    key={fn.name}
                    className="p-3 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10"
                  >
                    <div className="text-xs font-semibold text-[#14110F] truncate">
                      {fn.name}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#6B645C] font-mono tabular-nums">
                      <Calendar className="w-3 h-3" />
                      <span>{fn.date}</span>
                      <span>·</span>
                      <Users className="w-3 h-3" />
                      <span>{fn.guests}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.type === 'community' && (
            <div className="mt-6 pt-4 border-t border-[#14110F]/10 flex items-center justify-between gap-4">
              <div className="text-xs text-[#6B645C]">
                Community Mela Mode active: Municipal/Police NOC, Fire Safety & 2-Shift Volunteer Roster enabled.
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('ideas')}
                className="text-xs font-medium text-[#B9771B] hover:underline whitespace-nowrap cursor-pointer"
              >
                View Permits & Roster →
              </button>
            </div>
          )}
        </div>

        {/* Right 5 cols: Budget Donut & Top Categories */}
        <div className="lg:col-span-5 bg-white rounded-[14px] border border-[#14110F]/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#14110F]">
                  Budget Allocation & Actuals
                </h3>
                <p className="text-xs text-[#6B645C]">
                  Exact integer INR sum verified · Contingency ≥ 5%
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('budget')}
                className="text-xs font-medium text-[#B9771B] hover:text-[#14110F] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                What-If Sliders
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Planned vs Actual Visual Bar & Top 6 Categories */}
            <div className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#6B645C]">Actual Disbursed vs Planned</span>
                <span className="font-mono font-semibold tabular-nums text-[#14110F]">
                  ₹{totalActual.toLocaleString('en-IN')} / ₹{event.budget.toLocaleString('en-IN')} ({actualPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#14110F]/10 overflow-hidden">
                <div
                  className="h-full bg-[#E8A33D] rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(4, actualPct)}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {event.lines.slice(0, 6).map((line) => {
                const pct = Math.round((line.planned / Math.max(1, event.budget)) * 100);
                return (
                  <div key={line.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#14110F] flex items-center gap-1.5">
                        {line.category}
                        {line.locked && (
                          <Lock className="w-3 h-3 text-[#B9771B]" aria-label="Locked" />
                        )}
                      </span>
                      <span className="font-mono tabular-nums text-[#14110F]">
                        ₹{line.planned.toLocaleString('en-IN')}{' '}
                        <span className="text-[#6B645C]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#14110F]/8 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          line.locked ? 'bg-[#B9771B]' : 'bg-[#14110F]/75'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#14110F]/10 flex items-center justify-between text-xs text-[#6B645C]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#2F7D5B]" />
              Contingency Floor:{' '}
              <strong className="font-mono text-[#14110F] tabular-nums">
                ₹
                {(
                  event.lines.find((l) => l.category === 'Contingency')?.planned ?? 0
                ).toLocaleString('en-IN')}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('budget')}
              className="font-medium text-[#14110F] hover:underline cursor-pointer"
            >
              All {event.lines.length} Categories →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
