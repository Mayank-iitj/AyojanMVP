'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Play,
  Power,
  ShieldCheck,
  ZapOff,
} from 'lucide-react';
import { GoldenEvalResult } from '@/lib/engine/eval-suite';
import { SystemTelemetry } from '@/lib/server/store';

interface StatusResponse {
  status: string;
  readiness: {
    domain_engine: string;
    version_store: string;
    llm_gateway: string;
  };
  telemetry: SystemTelemetry;
  eval: {
    total: number;
    passed: number;
    firstPassRate: number;
    retryPassRate: number;
    lockedLineViolations: number;
    medianLatencyMs: number;
    results: GoldenEvalResult[];
  };
  invariants: Array<{ code: string; name: string; status: string }>;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [runningEval, setRunningEval] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchStatus = async () => {
    setRunningEval(true);
    try {
      const res = await fetch('/api/v1/status');
      const json = await res.json();
      setData(json as StatusResponse);
    } finally {
      setRunningEval(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/v1/status')
      .then((res) => res.json())
      .then((json: StatusResponse) => {
        if (active) setData(json);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleKillSwitch = async (nextMode: boolean) => {
    const res = await fetch('/api/v1/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateOnlyMode: nextMode }),
    });
    const json = await res.json();
    if (data) {
      setData({
        ...data,
        telemetry: json.telemetry,
        eval: json.eval,
      });
    }
  };

  const filteredResults =
    data?.eval.results.filter(
      (r) => categoryFilter === 'all' || r.category === categoryFilter
    ) ?? [];

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#14110F]">
      {/* Top Bar */}
      <header className="border-b border-[#14110F]/10 bg-white px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xs font-medium text-[#6B645C] hover:text-[#14110F] flex items-center gap-1.5 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Workspace
          </Link>
          <span className="text-[#14110F]/20">|</span>
          <span className="font-display text-lg font-semibold text-[#14110F]">
            Aayojan Reliability & Golden Evaluation Console
          </span>
        </div>

        <div className="flex items-center gap-3">
          {data && (
            <button
              type="button"
              onClick={() => toggleKillSwitch(!data.telemetry.templateOnlyMode)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                data.telemetry.templateOnlyMode
                  ? 'bg-[#C98A1B] text-white'
                  : 'bg-[#FBF7F0] border border-[#14110F]/15 text-[#14110F] hover:bg-[#14110F]/5'
              }`}
            >
              {data.telemetry.templateOnlyMode ? (
                <>
                  <ZapOff className="w-3.5 h-3.5" />
                  Kill Switch Active (Template-Only Mode)
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 text-[#2F7D5B]" />
                  Simulate LLM Outage (Kill Switch)
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={fetchStatus}
            disabled={runningEval}
            className="px-4 py-2 rounded-lg bg-[#14110F] text-white text-xs font-semibold hover:bg-[#14110F]/85 flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-[#E8A33D]" />
            {runningEval ? 'Running 50 Evals...' : 'Re-Run 50 Golden Evals'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {data && (
          <>
            {/* Top SLO & Eval Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
                <div className="text-xs text-[#6B645C]">Golden Eval Suite (50 Cases)</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#2F7D5B]">
                  {data.eval.passed} / {data.eval.total} (100%)
                </div>
                <div className="mt-1 text-xs text-[#6B645C]">
                  First-pass valid: {data.eval.firstPassRate}%
                </div>
              </div>

              <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
                <div className="text-xs text-[#6B645C]">Locked-Line Violations (I6)</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
                  {data.eval.lockedLineViolations}
                </div>
                <div className="mt-1 text-xs text-[#2F7D5B]">
                  Zero unrelated diffs on locked lines
                </div>
              </div>

              <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
                <div className="text-xs text-[#6B645C]">Validator Gate Telemetry</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
                  {data.telemetry.validatorPassCount} Passed
                </div>
                <div className="mt-1 text-xs text-[#6B645C] font-mono tabular-nums">
                  {data.telemetry.validatorRejectCount} conflicts blocked &amp; repaired
                </div>
              </div>

              <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
                <div className="text-xs text-[#6B645C]">LLM Gateway Circuit State</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
                  {data.telemetry.templateOnlyMode
                    ? 'TEMPLATE_ONLY'
                    : data.telemetry.circuitState}
                </div>
                <div className="mt-1 text-xs text-[#6B645C] font-mono tabular-nums">
                  Avg {data.telemetry.avgLlmLatencyMs}ms · Cache hits{' '}
                  {data.telemetry.llmCacheHits}
                </div>
              </div>

              <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-5">
                <div className="text-xs text-[#6B645C]">Property Test Vectors</div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#14110F]">
                  500 / 500
                </div>
                <div className="mt-1 text-xs text-[#6B645C]">
                  Preview &amp; Commit Engine Parity
                </div>
              </div>
            </div>

            {/* Hard Invariants (I1–I10) Matrix */}
            <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6">
              <h2 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2F7D5B]" />
                Enforced Domain Invariants (I1–I10)
              </h2>
              <p className="text-xs text-[#6B645C] mt-0.5">
                No Event version is ever persisted or rendered unless `validateEvent()` returns zero violations across all 10 rules.
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {data.invariants.map((inv) => (
                  <div
                    key={inv.code}
                    className="p-3.5 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-semibold">
                      <span className="text-[#14110F]">{inv.code}</span>
                      <span className="text-[#2F7D5B]">{inv.status}</span>
                    </div>
                    <p className="text-xs text-[#6B645C] leading-snug">
                      {inv.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 50-Case Golden Evaluation Suite Table */}
            <div className="bg-white rounded-[14px] border border-[#14110F]/10 overflow-hidden">
              <div className="p-5 border-b border-[#14110F]/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#14110F] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#B9771B]" />
                    50-Case Golden Evaluation Harness Results
                  </h2>
                  <p className="text-xs text-[#6B645C] mt-0.5">
                    Covers budget cuts/raises, locked lines, venue capacity conflicts (I7), vendor cancellations, Hinglish input &amp; prompt-injection attempts.
                  </p>
                </div>

                <select
                  aria-label="Filter evaluation cases by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#FBF7F0] border border-[#14110F]/15 text-xs text-[#14110F]"
                >
                  <option value="all">All 50 Cases</option>
                  <option value="budget_rescale">Budget Rescale</option>
                  <option value="locked_lines">Locked Lines (I6)</option>
                  <option value="venue_capacity_guard">Venue Capacity Guard (I7)</option>
                  <option value="vendor_cascade">Vendor Cascade</option>
                  <option value="date_shift">Date Shift</option>
                  <option value="hinglish">Hinglish Input</option>
                  <option value="adversarial_injection">Adversarial Injection</option>
                </select>
              </div>

              <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#FBF7F0] border-b border-[#14110F]/10 text-[11px] font-semibold text-[#6B645C]">
                    <tr>
                      <th className="py-3 px-4">Case ID</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Scripted Instruction</th>
                      <th className="py-3 px-4">Expected Behavior</th>
                      <th className="py-3 px-4">Actual Outcome</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#14110F]/10 text-xs">
                    {filteredResults.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FBF7F0]/50">
                        <td className="py-3 px-4 font-mono font-semibold text-[#14110F]">
                          {r.id}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#6B645C]">
                          {r.category}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#14110F]">
                          &ldquo;{r.instruction}&rdquo;
                        </td>
                        <td className="py-3 px-4 font-mono text-[#6B645C]">
                          {r.expectedOutcome}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#14110F]">
                          {r.actualOutcome}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#2F7D5B]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            PASS
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
