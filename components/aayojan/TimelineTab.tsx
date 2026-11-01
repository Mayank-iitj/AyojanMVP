'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  GitBranch,
  UserCheck,
} from 'lucide-react';
import { addDays, diffDays } from '@/lib/engine/core';
import { EventState, TaskStatus, TypedOp } from '@/lib/engine/types';

interface TimelineTabProps {
  event: EventState;
  onCommitOps: (ops: TypedOp[], cause: string) => Promise<void>;
}

export default function TimelineTab({ event, onCommitOps }: TimelineTabProps) {
  const totalWindowDays = Math.max(7, diffDays(event.today, event.event_date));
  const sortedTasks = [...event.tasks].sort((a, b) =>
    a.start.localeCompare(b.start)
  );

  const hasCompressedRisk = event.risks.some(
    (r) => r.code === 'COMPRESSED_TIMELINE'
  );

  const shiftTaskDue = async (taskId: string, currentDue: string, delta: number) => {
    const targetDue = addDays(currentDue, delta);
    await onCommitOps(
      [{ op: 'MoveTask', id: taskId, due: targetDue }],
      `Moved task ${taskId} due date to ${targetDue}`
    );
  };

  const cycleTaskStatus = async (taskId: string, current: TaskStatus) => {
    const next: TaskStatus =
      current === 'todo'
        ? 'in_progress'
        : current === 'in_progress'
          ? 'done'
          : 'todo';
    await onCommitOps(
      [{ op: 'SetStatus', id: taskId, status: next }],
      `Updated task ${taskId} status to ${next}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Compressed Timeline Warning Band (FR-3 & Section 9.2) */}
      {hasCompressedRisk && (
        <div className="p-4 rounded-[14px] bg-[#C98A1B]/12 border border-[#C98A1B]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-[#14110F]">
            <AlertTriangle className="w-4 h-4 text-[#C98A1B] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                Compressed Lead-Time Window Active:
              </span>{' '}
              Several template tasks have standard lead times longer than the{' '}
              <span className="font-mono tabular-nums">{totalWindowDays} days</span>{' '}
              between today ({event.today}) and event date ({event.event_date}). Topological dependencies (I5) and date bounds (I3) are enforced.
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onCommitOps(
                [{ op: 'SetDate', date: addDays(event.event_date, 14) }],
                'Extended event date by 14 days to relieve compressed lead times'
              )
            }
            className="px-3.5 py-2 rounded-lg bg-[#14110F] text-white text-xs font-medium hover:bg-[#14110F]/85 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Push Event Date +14 Days
          </button>
        </div>
      )}

      {/* Backward-Scheduled Gantt Chart Card */}
      <div className="bg-white rounded-[14px] border border-[#14110F]/10 overflow-hidden">
        <div className="p-5 border-b border-[#14110F]/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#14110F]">
              Backward-Scheduled Timeline & Critical Path (I3, I4, I5)
            </h2>
            <p className="text-xs text-[#6B645C] mt-0.5">
              Critical path highlighted in saffron (<span className="text-[#B9771B] font-semibold">#E8A33D</span>) · Dependencies finish on or before dependent starts.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-[#6B645C]">
            <span>Today: {event.today}</span>
            <span>·</span>
            <span className="font-semibold text-[#14110F]">
              Event: {event.event_date}
            </span>
          </div>
        </div>

        {/* Visual Gantt Bars + Interactive Controls */}
        <div className="divide-y divide-[#14110F]/10">
          {sortedTasks.map((task) => {
            const startOffset = Math.max(0, diffDays(event.today, task.start));
            const endOffset = Math.min(
              totalWindowDays,
              Math.max(startOffset + 1, diffDays(event.today, task.due))
            );
            const leftPct = Math.min(
              92,
              Math.max(0, Math.round((startOffset / totalWindowDays) * 100))
            );
            const widthPct = Math.min(
              100 - leftPct,
              Math.max(6, Math.round(((endOffset - startOffset) / totalWindowDays) * 100))
            );

            return (
              <div
                key={task.id}
                className="p-4 hover:bg-[#FBF7F0]/50 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
              >
                {/* Task Info (5 cols) */}
                <div className="lg:col-span-5 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#6B645C]">
                    <span className="font-semibold text-[#14110F]">
                      {task.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      {task.owner}
                    </span>
                    {task.critical && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#B9771B]">
                          Critical Path
                        </span>
                      </>
                    )}
                    {task.template_id && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px]">
                          {task.template_id}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-sm font-medium text-[#14110F] mt-0.5 truncate">
                    {task.title}
                  </div>
                  {task.depends_on.length > 0 && (
                    <div className="text-[11px] text-[#6B645C] mt-0.5 flex items-center gap-1 font-mono">
                      <GitBranch className="w-3 h-3" />
                      Depends on: {task.depends_on.join(', ')}
                    </div>
                  )}
                </div>

                {/* Gantt Timeline Track (4 cols) */}
                <div className="lg:col-span-4">
                  <div className="relative h-7 rounded-lg bg-[#FBF7F0] border border-[#14110F]/10 overflow-hidden flex items-center">
                    <div
                      className={`h-4 rounded-md transition-all ${
                        task.status === 'done'
                          ? 'bg-[#2F7D5B]'
                          : task.status === 'at_risk'
                            ? 'bg-[#B3402F]'
                            : task.critical
                              ? 'bg-[#E8A33D]'
                              : 'bg-[#14110F]/70'
                      }`}
                      style={{
                        marginLeft: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#6B645C] mt-1">
                    <span>Start {task.start}</span>
                    <span>Due {task.due}</span>
                  </div>
                </div>

                {/* Interactive Date Shift & Status Controls (3 cols) */}
                <div className="lg:col-span-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => shiftTaskDue(task.id, task.due, -2)}
                    aria-label={`Move ${task.category} 2 days earlier`}
                    className="p-1.5 rounded-lg border border-[#14110F]/15 text-xs text-[#14110F] hover:bg-[#FBF7F0] cursor-pointer"
                    title="Move 2 days earlier"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftTaskDue(task.id, task.due, 2)}
                    aria-label={`Move ${task.category} 2 days later`}
                    className="p-1.5 rounded-lg border border-[#14110F]/15 text-xs text-[#14110F] hover:bg-[#FBF7F0] cursor-pointer"
                    title="Move 2 days later"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleTaskStatus(task.id, task.status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                      task.status === 'done'
                        ? 'bg-[#2F7D5B]/15 text-[#2F7D5B]'
                        : task.status === 'at_risk'
                          ? 'bg-[#B3402F]/15 text-[#B3402F]'
                          : task.status === 'in_progress'
                            ? 'bg-[#E8A33D]/25 text-[#14110F]'
                            : 'bg-[#FBF7F0] border border-[#14110F]/15 text-[#14110F]'
                    }`}
                  >
                    {task.status === 'done' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </span>
                    ) : task.status === 'at_risk' ? (
                      'At Risk'
                    ) : task.status === 'in_progress' ? (
                      'In Progress'
                    ) : (
                      'To Do'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
