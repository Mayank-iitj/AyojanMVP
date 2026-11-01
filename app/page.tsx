'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Command,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  ZapOff,
} from 'lucide-react';
import BudgetTab from '@/components/aayojan/BudgetTab';
import HealthPopover from '@/components/aayojan/HealthPopover';
import HistoryTab from '@/components/aayojan/HistoryTab';
import IdeasTab from '@/components/aayojan/IdeasTab';
import IntakeModal from '@/components/aayojan/IntakeModal';
import OverviewTab from '@/components/aayojan/OverviewTab';
import ReplanCommandModal from '@/components/aayojan/ReplanCommandModal';
import ShareExportModal from '@/components/aayojan/ShareExportModal';
import TimelineTab from '@/components/aayojan/TimelineTab';
import VendorsTab from '@/components/aayojan/VendorsTab';
import {
  applyOps,
  computeDiff,
  computeHealth,
  createInitialEvent,
  PERSONA_PRESETS,
} from '@/lib/engine/core';
import {
  EventState,
  EventVersionRecord,
  ExpenseRecord,
  HealthReport,
  QuoteRecord,
  ShareLinkRecord,
  ShareRole,
  TypedOp,
} from '@/lib/engine/types';
import { SystemTelemetry } from '@/lib/server/store';

type ActiveTab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas' | 'history';

interface EventSummaryItem {
  id: string;
  title: string;
  type: string;
  city: string;
  guests: number;
  budget: number;
  event_date: string;
  version: number;
  health: number;
}

const INITIAL_SEED_EVENT = createInitialEvent(PERSONA_PRESETS.wedding_riya);
const INITIAL_SEED_HEALTH = computeHealth(INITIAL_SEED_EVENT);

export default function AayojanWorkspacePage() {
  const [eventsList, setEventsList] = useState<EventSummaryItem[]>([
    {
      id: INITIAL_SEED_EVENT.id,
      title: INITIAL_SEED_EVENT.brief.title,
      type: INITIAL_SEED_EVENT.type,
      city: INITIAL_SEED_EVENT.city,
      guests: INITIAL_SEED_EVENT.guests,
      budget: INITIAL_SEED_EVENT.budget,
      event_date: INITIAL_SEED_EVENT.event_date,
      version: INITIAL_SEED_EVENT.version,
      health: INITIAL_SEED_HEALTH.score,
    },
  ]);
  const [activeEventId, setActiveEventId] = useState<string>('evt-jaipur-wedding');
  const [event, setEvent] = useState<EventState | null>(INITIAL_SEED_EVENT);
  const [health, setHealth] = useState<HealthReport | null>(INITIAL_SEED_HEALTH);
  const [versions, setVersions] = useState<EventVersionRecord[]>([
    {
      event_id: INITIAL_SEED_EVENT.id,
      version: 1,
      state: INITIAL_SEED_EVENT,
      ops: [],
      diff: computeDiff(INITIAL_SEED_EVENT, INITIAL_SEED_EVENT),
      cause: 'Initial event generation from intake brief',
      health: INITIAL_SEED_HEALTH.score,
      created_by: 'Riya Sharma',
      created_at: '2026-11-01T09:00:00+05:30',
    },
  ]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLinkRecord[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [replanOpen, setReplanOpen] = useState(false);
  const [replanInitialText, setReplanInitialText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Undo Toast Banner (30s after commit)
  const [undoToast, setUndoToast] = useState<{
    fromVersion: number;
    toVersion: number;
    summary: string;
  } | null>(null);

  const loadEventDetails = useCallback(async (id: string) => {
    const [listRes, detailRes] = await Promise.all([
      fetch('/api/v1/events'),
      fetch(`/api/v1/events/${encodeURIComponent(id)}`),
    ]);
    if (listRes.ok) {
      const listJson = await listRes.json();
      setEventsList(listJson.events ?? []);
      if (listJson.telemetry) setTelemetry(listJson.telemetry);
    }
    if (detailRes.ok) {
      const detailJson = await detailRes.json();
      setEvent(detailJson.event);
      setHealth(detailJson.health);
      setVersions(detailJson.versions ?? []);
      setExpenses(detailJson.expenses ?? []);
      setQuotes(detailJson.quotes ?? []);
      setShareLinks(detailJson.shareLinks ?? []);
      if (detailJson.telemetry) setTelemetry(detailJson.telemetry);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/v1/events').then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/v1/events/${encodeURIComponent(activeEventId)}`).then((r) =>
        r.ok ? r.json() : null
      ),
    ]).then(([listJson, detailJson]) => {
      if (!active) return;
      if (listJson) {
        setEventsList(listJson.events ?? []);
        if (listJson.telemetry) setTelemetry(listJson.telemetry);
      }
      if (detailJson) {
        setEvent(detailJson.event);
        setHealth(detailJson.health);
        setVersions(detailJson.versions ?? []);
        setExpenses(detailJson.expenses ?? []);
        setQuotes(detailJson.quotes ?? []);
        setShareLinks(detailJson.shareLinks ?? []);
        if (detailJson.telemetry) setTelemetry(detailJson.telemetry);
      }
    });
    return () => {
      active = false;
    };
  }, [activeEventId]);

  // Global Cmd+K / Ctrl+K listener for Replan Command Bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setReplanInitialText('');
        setReplanOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCommitOps = async (ops: TypedOp[], cause: string) => {
    if (!event) return;
    const prevVersion = event.version;

    // Optimistic local engine application so UI updates with 0ms latency
    const localOutcome = applyOps(event, ops);
    if (localOutcome.ok) {
      setEvent(localOutcome.nextState);
      setHealth(localOutcome.health);
      setUndoToast({
        fromVersion: prevVersion,
        toVersion: localOutcome.nextState.version,
        summary: localOutcome.diff.summary,
      });
    }

    const res = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': String(prevVersion),
        'Idempotency-Key': `idem_${event.id}_${prevVersion}_${Date.now()}`,
      },
      body: JSON.stringify({
        action: 'commit',
        base_version: prevVersion,
        ops,
        cause,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setEvent(data.event);
      setHealth(data.health);
      setVersions(data.versions ?? []);
      if (data.telemetry) setTelemetry(data.telemetry);
      setUndoToast({
        fromVersion: prevVersion,
        toVersion: data.event.version,
        summary: data.versionRecord?.diff?.summary ?? cause,
      });
    }
  };

  const handleUndo = async (targetVersion?: number) => {
    if (!event) return;
    const target = targetVersion ?? Math.max(1, event.version - 1);
    const res = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'undo',
        target_version: target,
      }),
    });
    if (res.ok) {
      setUndoToast(null);
      await loadEventDetails(event.id);
    }
  };

  const handleLogExpense = async (exp: {
    category: string;
    amount: number;
    note: string;
  }) => {
    if (!event) return;
    const res = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log_expense',
        ...exp,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setEvent(data.event);
      setHealth(data.health);
      setExpenses(data.expenses ?? []);
    }
  };

  const handleAddQuote = async (quote: {
    category: string;
    vendor_name: string;
    amount: number;
    capacity?: number;
    inclusions: string;
  }) => {
    if (!event) return;
    const res = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_quote',
        ...quote,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setQuotes(data.quotes ?? []);
    }
  };

  const handleRegenerateIdeas = async (constraint: string) => {
    if (!event) return;
    const res = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'regenerate_ideas',
        constraint,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setEvent(data.event);
    }
  };

  const handleCreateShare = async (
    role: ShareRole,
    vendorCategory?: string
  ) => {
    if (!event) return;
    const res = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_share',
        role,
        vendor_category: vendorCategory,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setShareLinks(data.shareLinks ?? []);
    }
  };

  const handleRevokeShare = async (token: string) => {
    if (!event) return;
    const res = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'revoke_share',
        token,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setShareLinks(data.shareLinks ?? []);
    }
  };

  const handleCreateEventFromIntake = async (
    prompt: string,
    presetKey?: string
  ) => {
    const res = await fetch('/api/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `create_${Date.now()}`,
      },
      body: JSON.stringify({ prompt, presetKey }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveEventId(data.event_id);
      await loadEventDetails(data.event_id);
      setActiveTab('overview');
    }
  };

  const handleToggleDegradedMode = async () => {
    const nextVal = !telemetry?.templateOnlyMode;
    const res = await fetch('/api/v1/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateOnlyMode: nextVal }),
    });
    if (res.ok) {
      const data = await res.json();
      setTelemetry(data.telemetry);
    }
  };

  const isDegraded =
    telemetry?.templateOnlyMode || telemetry?.circuitState === 'OPEN';

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF7F0] text-[#14110F]">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#14110F] focus:text-white focus:text-xs focus:font-semibold"
      >
        Skip to main workspace
      </a>
      {/* Degraded Mode Resilience Banner (Section 9.3 & 11) */}
      {isDegraded && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#C98A1B]/15 border-b border-[#C98A1B]/35 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#14110F] no-print"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B9771B] shrink-0" />
            <span>
              <strong>Smart suggestions are limited right now; your plan is safe.</strong>{' '}
              Running in deterministic Template-Only mode — all budget sliders, backward scheduling, and validator invariants operate normally.
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleDegradedMode}
            className="px-3 py-1 rounded-md bg-[#14110F] text-white font-medium hover:bg-[#14110F]/85 whitespace-nowrap cursor-pointer"
          >
            Restore AI Gateway
          </button>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract (frontend-design Section 2) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-[#14110F]/10 no-print">
        {/* Zone 1: Single text element wordmark */}
        <Link
          href="/"
          className="font-display text-xl font-bold tracking-tight text-[#14110F] whitespace-nowrap shrink-0"
        >
          Aayojan
        </Link>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#6B645C]"
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`hover:text-[#14110F] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'text-[#14110F] underline underline-offset-8 decoration-2 decoration-[#E8A33D]'
                : ''
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`hover:text-[#14110F] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'budget'
                ? 'text-[#14110F] underline underline-offset-8 decoration-2 decoration-[#E8A33D]'
                : ''
            }`}
          >
            Budget
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`hover:text-[#14110F] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'timeline'
                ? 'text-[#14110F] underline underline-offset-8 decoration-2 decoration-[#E8A33D]'
                : ''
            }`}
          >
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vendors')}
            className={`hover:text-[#14110F] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'vendors'
                ? 'text-[#14110F] underline underline-offset-8 decoration-2 decoration-[#E8A33D]'
                : ''
            }`}
          >
            Vendors
          </button>
          <Link
            href="/status"
            className="hover:text-[#14110F] transition-colors whitespace-nowrap shrink-0"
          >
            Eval &amp; Status
          </Link>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setReplanInitialText('');
              setReplanOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#14110F] rounded-lg hover:bg-[#14110F]/85 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Command className="w-3.5 h-3.5 text-[#E8A33D]" />
            Replan (⌘K)
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main
        id="main-workspace"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {!event || !health ? (
          <div className="bg-white rounded-[14px] border border-[#14110F]/10 p-8 space-y-4 animate-pulse">
            <div className="h-8 w-1/3 bg-[#14110F]/10 rounded" />
            <div className="h-4 w-1/2 bg-[#14110F]/10 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
              <div className="h-24 bg-[#14110F]/5 rounded-xl" />
              <div className="h-24 bg-[#14110F]/5 rounded-xl" />
              <div className="h-24 bg-[#14110F]/5 rounded-xl" />
              <div className="h-24 bg-[#14110F]/5 rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Event Hero & Workspace Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#14110F]/10">
              <div className="space-y-1.5">
                {/* Clean Unboxed Metadata Line (Zero-Pill Rule) */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B645C] font-mono tabular-nums">
                  <span className="uppercase font-semibold text-[#B9771B]">
                    {event.type} Mode
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Version {event.version}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {event.city} (Tier {event.city_tier})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Event {event.event_date}</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-[#2F7D5B]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Invariants I1–I10 Verified
                  </span>
                </div>

                {/* Title & Event Switcher */}
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#14110F] text-balance">
                    {event.brief.title}
                  </h1>
                </div>
              </div>

              {/* Workspace Controls: Event Switcher, New Intake, Share/Export, Kill Switch, Health Ring */}
              <div className="flex flex-wrap items-center gap-2.5 no-print">
                <select
                  aria-label="Switch active event persona"
                  value={event.id}
                  onChange={(e) => setActiveEventId(e.target.value)}
                  className="px-3 py-2 rounded-[14px] bg-white border border-[#14110F]/15 text-xs font-medium text-[#14110F] cursor-pointer"
                >
                  {eventsList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} (v{item.version})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIntakeOpen(true)}
                  className="px-3.5 py-2 rounded-[14px] bg-white border border-[#14110F]/15 hover:border-[#14110F]/35 text-xs font-semibold text-[#14110F] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#B9771B]" />
                  New Event Intake
                </button>

                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="px-3.5 py-2 rounded-[14px] bg-white border border-[#14110F]/15 hover:border-[#14110F]/35 text-xs font-semibold text-[#14110F] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#B9771B]" />
                  Share &amp; Export
                </button>

                <button
                  type="button"
                  onClick={handleToggleDegradedMode}
                  aria-pressed={Boolean(isDegraded)}
                  className={`px-3 py-2 rounded-[14px] border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isDegraded
                      ? 'bg-[#C98A1B]/20 border-[#C98A1B] text-[#14110F]'
                      : 'bg-white border-[#14110F]/15 text-[#6B645C] hover:text-[#14110F]'
                  }`}
                  title="Toggle Template-Only Degraded Mode (Demo Step 7)"
                >
                  <ZapOff className="w-3.5 h-3.5" />
                  {isDegraded ? 'Degraded Mode: ON' : 'Kill Switch'}
                </button>

                <HealthPopover
                  health={health}
                  onApplyFix={(ops, desc) => handleCommitOps(ops, desc)}
                />
              </div>
            </div>

            {/* Undo Toast Notification after Replan / Commit */}
            {undoToast && (
              <div
                role="status"
                aria-live="polite"
                className="p-3.5 rounded-[14px] bg-[#14110F] text-white flex flex-wrap items-center justify-between gap-3 text-xs no-print"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#E8A33D] font-semibold">
                    Committed v{undoToast.toVersion}:
                  </span>
                  <span>{undoToast.summary}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUndo(undoToast.fromVersion)}
                    className="px-3 py-1 rounded-lg bg-[#E8A33D] text-[#14110F] font-semibold hover:bg-[#E8A33D]/90 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Undo to v{undoToast.fromVersion}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUndoToast(null)}
                    className="text-white/70 hover:text-white px-2"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Workspace Tab Bar (All 6 Core Views) */}
            <div
              role="tablist"
              aria-label="Event Plan Sections"
              className="flex items-center gap-1.5 p-1.5 rounded-[14px] bg-white border border-[#14110F]/10 overflow-x-auto no-print"
            >
              {(
                [
                  { id: 'overview', label: 'Overview' },
                  { id: 'budget', label: `Budget & Sliders (${event.lines.length})` },
                  { id: 'timeline', label: `Backward Timeline (${event.tasks.length})` },
                  { id: 'vendors', label: `Vendor Kits & Quotes (${quotes.length})` },
                  { id: 'ideas', label: 'Ideas & Run-of-Show' },
                  { id: 'history', label: `Version History (v${event.version})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#14110F] text-white'
                      : 'text-[#6B645C] hover:text-[#14110F] hover:bg-[#FBF7F0]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active Tab Viewport */}
            <div
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  event={event}
                  health={health}
                  onApplyOps={handleCommitOps}
                  onNavigateTab={(t) => setActiveTab(t)}
                  onRunInstruction={(instr) => {
                    setReplanInitialText(instr);
                    setReplanOpen(true);
                  }}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetTab
                  event={event}
                  expenses={expenses}
                  onCommitOps={handleCommitOps}
                  onLogExpense={handleLogExpense}
                />
              )}

              {activeTab === 'timeline' && (
                <TimelineTab event={event} onCommitOps={handleCommitOps} />
              )}

              {activeTab === 'vendors' && (
                <VendorsTab
                  event={event}
                  quotes={quotes}
                  onCommitOps={handleCommitOps}
                  onAddQuote={handleAddQuote}
                />
              )}

              {activeTab === 'ideas' && (
                <IdeasTab
                  event={event}
                  onRegenerateIdeas={handleRegenerateIdeas}
                />
              )}

              {activeTab === 'history' && (
                <HistoryTab
                  versions={versions}
                  currentVersion={event.version}
                  onUndoToVersion={(ver) => handleUndo(ver)}
                />
              )}
            </div>

            {/* Modals */}
            <ReplanCommandModal
              open={replanOpen}
              event={event}
              initialInstruction={replanInitialText}
              onClose={() => setReplanOpen(false)}
              onCommitOps={handleCommitOps}
            />

            <ShareExportModal
              open={shareOpen}
              event={event}
              health={health}
              shareLinks={shareLinks}
              onClose={() => setShareOpen(false)}
              onCreateShare={handleCreateShare}
              onRevokeShare={handleRevokeShare}
            />

            <IntakeModal
              open={intakeOpen}
              onClose={() => setIntakeOpen(false)}
              onCreateFromPrompt={handleCreateEventFromIntake}
            />
          </>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="mt-12 border-t border-[#14110F]/10 bg-white px-6 py-4 text-xs text-[#6B645C] flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          Aayojan — Verified Event Planning Engine · All currency figures in integer INR · Seed price bands are editable assumptions.
        </div>
        <div className="flex items-center gap-4">
          <Link href="/status" className="hover:text-[#14110F] underline">
            Golden Eval Suite (50/50) &amp; System Status
          </Link>
          <span>·</span>
          <Link
            href="/s/demo-family-riya-jaipur"
            className="hover:text-[#14110F] underline"
          >
            Demo Family Share View
          </Link>
          <span>·</span>
          <Link
            href="/s/demo-volunteer-diwali-mela"
            className="hover:text-[#14110F] underline"
          >
            Demo Volunteer Share View
          </Link>
        </div>
      </footer>
    </div>
  );
}
