'use client';

import React, { useState } from 'react';
import { ArrowLeftRight, History, RotateCcw } from 'lucide-react';
import { computeDiff } from '@/lib/engine/core';
import { EventVersionRecord } from '@/lib/engine/types';

interface HistoryTabProps {
  versions: EventVersionRecord[];
  currentVersion: number;
  onUndoToVersion: (targetVersion: number) => Promise<void>;
}

export default function HistoryTab({
  versions,
  currentVersion,
  onUndoToVersion,
}: HistoryTabProps) {
  const [fromVer, setFromVer] = useState<number>(
    versions.length > 1 ? versions[versions.length - 2].version : 1
  );
  const [toVer, setToVer] = useState<number>(currentVersion);

  const fromRecord =
    versions.find((v) => v.version === fromVer) ?? versions[0];
  const toRecord =
    versions.find((v) => v.version === toVer) ??
    versions[versions.length - 1];

  const comparisonDiff =
    fromRecord && toRecord
      ? computeDiff(fromRecord.state, toRecord.state)
      : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 5 Cols: Version Timeline */}
      <div className="lg:col-span-5 bg-white rounded-[14px] border border-[#14110F]/10 p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
            <History className="w-4 h-4 text-[#B9771B]" />
            Immutable Version Ledger (I9)
          </h2>
          <p className="text-xs text-[#6B645C] mt-0.5">
            Every mutation writes a new verified version. Revert to any prior version safely.
          </p>
        </div>

        <div className="space-y-3">
          {[...versions].reverse().map((v) => {
            const isCurrent = v.version === currentVersion;
            return (
              <div
                key={v.version}
                className={`p-4 rounded-xl border transition-colors ${
                  isCurrent
                    ? 'bg-[#FBF7F0] border-[#B9771B]'
                    : 'bg-white border-[#14110F]/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs font-semibold text-[#14110F]">
                    Version {v.version} {isCurrent && '· Active'}
                  </div>
                  <div className="font-mono text-xs tabular-nums text-[#6B645C]">
                    Health {v.health}/100
                  </div>
                </div>
                <div className="text-xs font-medium text-[#14110F] mt-1">
                  {v.cause}
                </div>
                <p className="text-xs text-[#6B645C] mt-1 leading-relaxed">
                  {v.diff.summary}
                </p>
                <div className="mt-3 pt-2 border-t border-[#14110F]/10 flex items-center justify-between text-[11px] text-[#6B645C]">
                  <span>
                    By {v.created_by} · {v.created_at.slice(0, 16).replace('T', ' ')}
                  </span>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => onUndoToVersion(v.version)}
                      className="px-2.5 py-1 rounded-md bg-[#14110F] text-white font-medium hover:bg-[#14110F]/85 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore v{v.version}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 7 Cols: Any-Two-Versions Diff Comparator (FR-14) */}
      <div className="lg:col-span-7 bg-white rounded-[14px] border border-[#14110F]/10 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#14110F]/10">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#B9771B]" />
              Compare Any Two Versions
            </h3>
            <p className="text-xs text-[#6B645C] mt-0.5">
              Deterministic diff across budget lines, backward-scheduled tasks, and vendors.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <label htmlFor="diff-from-select" className="text-[#6B645C]">
              From:
            </label>
            <select
              id="diff-from-select"
              value={fromVer}
              onChange={(e) => setFromVer(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>

            <label htmlFor="diff-to-select" className="text-[#6B645C] ml-2">
              To:
            </label>
            <select
              id="diff-to-select"
              value={toVer}
              onChange={(e) => setToVer(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
          </div>
        </div>

        {comparisonDiff && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10">
              <div className="text-xs font-semibold text-[#14110F]">
                Deterministic Summary (v{fromRecord.version} → v{toRecord.version})
              </div>
              <p className="text-xs text-[#6B645C] mt-1 leading-relaxed">
                {comparisonDiff.summary}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-[#14110F]/10 font-mono text-xs tabular-nums">
                <div>
                  <span className="text-[#6B645C] block text-[11px]">Budget</span>
                  ₹{comparisonDiff.budgetBefore.toLocaleString('en-IN')} → ₹
                  {comparisonDiff.budgetAfter.toLocaleString('en-IN')}
                </div>
                <div>
                  <span className="text-[#6B645C] block text-[11px]">Guests</span>
                  {comparisonDiff.guestsBefore} → {comparisonDiff.guestsAfter}
                </div>
                <div>
                  <span className="text-[#6B645C] block text-[11px]">Health</span>
                  {comparisonDiff.healthBefore} → {comparisonDiff.healthAfter} (
                  {comparisonDiff.healthDelta >= 0
                    ? `+${comparisonDiff.healthDelta}`
                    : comparisonDiff.healthDelta}
                  )
                </div>
              </div>
            </div>

            {comparisonDiff.lineChanges.length === 0 &&
            comparisonDiff.taskChanges.length === 0 &&
            comparisonDiff.vendorChanges.length === 0 ? (
              <div className="text-xs text-[#6B645C] py-4">
                No differences between Version {fromRecord.version} and Version {toRecord.version}. Make a change in Budget, Timeline, or Replan (`⌘K`) to compare versions.
              </div>
            ) : (
              <div className="space-y-4">
                {comparisonDiff.lineChanges.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-[#14110F] mb-2">
                      Budget Category Changes ({comparisonDiff.lineChanges.length})
                    </div>
                    <div className="divide-y divide-[#14110F]/10 border border-[#14110F]/10 rounded-xl overflow-hidden text-xs">
                      {comparisonDiff.lineChanges.map((lc) => (
                        <div
                          key={lc.category}
                          className="p-3 bg-white flex items-center justify-between font-mono tabular-nums"
                        >
                          <span className="font-sans font-medium text-[#14110F]">
                            {lc.category}
                          </span>
                          <span>
                            ₹{lc.before.toLocaleString('en-IN')} → ₹
                            {lc.after.toLocaleString('en-IN')}{' '}
                            <strong
                              className={
                                lc.delta > 0 ? 'text-[#2F7D5B]' : 'text-[#C98A1B]'
                              }
                            >
                              ({lc.delta > 0 ? '+' : ''}₹
                              {lc.delta.toLocaleString('en-IN')})
                            </strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comparisonDiff.taskChanges.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-[#14110F] mb-2">
                      Timeline Task Deltas ({comparisonDiff.taskChanges.length})
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {comparisonDiff.taskChanges.map((tc) => (
                        <div
                          key={tc.id}
                          className="p-2.5 rounded-lg bg-[#FBF7F0] flex items-center justify-between"
                        >
                          <span className="font-medium text-[#14110F]">
                            {tc.title}
                          </span>
                          <span className="font-mono text-[#B9771B]">
                            {tc.change}: {tc.beforeDue ?? tc.beforeStatus ?? ''} →{' '}
                            {tc.afterDue ?? tc.afterStatus ?? ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
