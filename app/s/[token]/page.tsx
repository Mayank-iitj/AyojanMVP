'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface SharedRoleData {
  role: 'family' | 'vendor' | 'volunteer';
  vendor_category?: string;
  token: string;
  expires_at: string;
  event_summary: {
    title: string;
    type?: string;
    city: string;
    event_date: string;
    guests: number;
    budget?: number;
    version: number;
    health?: number;
  };
  lines?: Array<{
    category: string;
    planned: number;
    actual: number;
    locked: boolean;
  }>;
  functions?: Array<{ name: string; date: string; guests: number }>;
  tasks?: Array<{
    id: string;
    title: string;
    due: string;
    owner: string;
    status: string;
  }>;
  checklist?: string[];
  benchmark_inclusions?: string;
  roster_tasks?: Array<{
    id: string;
    title: string;
    category: string;
    due: string;
    owner: string;
    status: string;
    critical: boolean;
  }>;
  run_of_show?: Array<{
    title: string;
    description: string;
    templateCitation: string;
  }>;
  permits_and_safety?: Array<{
    title: string;
    description: string;
    templateCitation: string;
  }>;
}

export default function SharedRoleViewPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [data, setData] = useState<SharedRoleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/v1/share/${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(json.detail || 'Share link invalid or revoked.');
        } else {
          setData(json as SharedRoleData);
        }
      } catch {
        if (active) setError('Could not load shared role view.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#FBF7F0] text-[#14110F] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-[#14110F]/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-[#6B645C] hover:text-[#14110F] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Organizer Workspace
            </Link>
            <span className="text-[#6B645C]">·</span>
            <span className="font-display font-semibold text-base">
              Aayojan Role View
            </span>
          </div>
          {data && (
            <div className="text-xs font-mono text-[#B9771B]">
              Scope: {data.role.toUpperCase()}
              {data.vendor_category ? ` (${data.vendor_category})` : ''} · v
              {data.event_summary.version}
            </div>
          )}
        </header>

        {loading && (
          <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6 space-y-3 animate-pulse">
            <div className="h-6 w-2/3 bg-[#14110F]/10 rounded" />
            <div className="h-4 w-1/2 bg-[#14110F]/10 rounded" />
            <div className="h-32 w-full bg-[#14110F]/5 rounded" />
          </div>
        )}

        {error && (
          <div className="bg-white rounded-[14px] border border-[#B3402F]/35 p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#B3402F]">
              <AlertTriangle className="w-4 h-4" />
              <span>Share Link Unavailable</span>
            </div>
            <p className="text-xs text-[#6B645C]">{error}</p>
            <Link
              href="/"
              className="inline-flex px-4 py-2 rounded-lg bg-[#14110F] text-white text-xs font-medium"
            >
              Return to Aayojan
            </Link>
          </div>
        )}

        {data && (
          <>
            {/* Event Summary Header */}
            <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6 space-y-2">
              <div className="text-xs text-[#6B645C] flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2F7D5B]" />
                <span>
                  Read-Only {data.role.toUpperCase()} View · Expires{' '}
                  {data.expires_at.slice(0, 10)}
                </span>
              </div>
              <h1 className="font-display text-2xl font-semibold text-[#14110F]">
                {data.event_summary.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B645C] font-mono tabular-nums pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {data.event_summary.event_date}
                </span>
                <span>·</span>
                <span>{data.event_summary.city}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {data.event_summary.guests} Guests
                </span>
                {data.event_summary.budget !== undefined && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-[#14110F]">
                      Budget ₹{data.event_summary.budget.toLocaleString('en-IN')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Family View: Budget & Functions */}
            {data.role === 'family' && data.lines && (
              <div className="bg-white rounded-[14px] border border-[#14110F]/10 overflow-hidden">
                <div className="p-5 border-b border-[#14110F]/10">
                  <h2 className="font-display text-lg font-semibold text-[#14110F]">
                    Family Budget & Allocation Summary
                  </h2>
                  <p className="text-xs text-[#6B645C]">
                    Verified Version {data.event_summary.version} · Health Score{' '}
                    {data.event_summary.health}/100
                  </p>
                </div>
                <div className="divide-y divide-[#14110F]/10 text-xs">
                  {data.lines.map((l) => (
                    <div
                      key={l.category}
                      className="p-3.5 flex items-center justify-between"
                    >
                      <span className="font-medium text-[#14110F]">
                        {l.category} {l.locked ? '(Locked)' : ''}
                      </span>
                      <span className="font-mono tabular-nums font-semibold">
                        ₹{l.planned.toLocaleString('en-IN')}{' '}
                        <span className="text-[#6B645C] font-normal">
                          (Actual ₹{l.actual.toLocaleString('en-IN')})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendor View: Scoped Category Tasks & Checklist Only */}
            {data.role === 'vendor' && (
              <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#14110F]">
                    {data.vendor_category} Vendor Scope & Milestones
                  </h2>
                  <p className="text-xs text-[#6B645C] mt-0.5">
                    Other event categories and internal family budgets are hidden in this view.
                  </p>
                </div>

                {data.tasks && data.tasks.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#14110F]">
                      Assigned Deliverable Dates
                    </div>
                    {data.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-[#FBF7F0] border border-[#14110F]/10 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#14110F]">
                            {t.title}
                          </div>
                          <div className="text-[#6B645C] mt-0.5">
                            Coordinator: {t.owner}
                          </div>
                        </div>
                        <div className="font-mono tabular-nums text-[#14110F]">
                          Due {t.due}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data.checklist && (
                  <div className="pt-3 border-t border-[#14110F]/10">
                    <div className="text-xs font-semibold text-[#14110F] mb-2">
                      Required Confirmation Checklist
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#6B645C]">
                      {data.checklist.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D5B] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Volunteer View: Roster & Run-of-Show Only */}
            {data.role === 'volunteer' && data.roster_tasks && (
              <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-6 space-y-5">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#14110F]">
                    Volunteer Duty Roster & Safety Schedule
                  </h2>
                  <p className="text-xs text-[#6B645C] mt-0.5">
                    Financial figures are excluded from volunteer links.
                  </p>
                </div>

                <div className="divide-y divide-[#14110F]/10 border border-[#14110F]/10 rounded-xl overflow-hidden text-xs">
                  {data.roster_tasks.map((rt) => (
                    <div
                      key={rt.id}
                      className="p-3.5 bg-white flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-[#14110F]">
                          {rt.category} — {rt.title}
                        </div>
                        <div className="text-[#6B645C] mt-0.5">
                          Lead Marshal: <strong>{rt.owner}</strong>
                        </div>
                      </div>
                      <div className="font-mono tabular-nums text-right shrink-0">
                        <div>Due {rt.due}</div>
                        <div className="text-[11px] text-[#B9771B]">
                          {rt.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
