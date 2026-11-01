import crypto from 'node:crypto';
import {
  applyOps,
  computeDiff,
  computeHealth,
  createInitialEvent,
  PERSONA_PRESETS,
  validateEvent,
} from '../engine/core';
import {
  EventState,
  EventVersionRecord,
  ExpenseRecord,
  InvariantCode,
  PlanDiff,
  QuoteRecord,
  ShareLinkRecord,
  ShareRole,
  TypedOp,
} from '../engine/types';

export interface PreviewSession {
  id: string;
  event_id: string;
  base_version: number;
  ops: TypedOp[];
  nextState: EventState;
  diff: PlanDiff;
  health: number;
  created_at: string;
}

export interface JobRecord {
  id: string;
  event_id: string;
  kind: 'create_event' | 'replan';
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: 'parsing' | 'planning' | 'budgeting' | 'scheduling' | 'validating' | 'ideas' | 'done';
  result?: unknown;
  error?: unknown;
  created_at: string;
  finished_at?: string;
}

export interface SystemTelemetry {
  validatorPassCount: number;
  validatorRejectCount: number;
  rejectionsByCode: Record<string, number>;
  llmCallsTotal: number;
  llmFirstPassValid: number;
  llmRetriesUsed: number;
  llmFallbackUsed: number;
  llmCacheHits: number;
  avgLlmLatencyMs: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  consecutiveFailures: number;
  templateOnlyMode: boolean;
  estimatedSpendUsd: number;
}

interface GlobalStore {
  events: Map<string, EventState>;
  versions: Map<string, EventVersionRecord[]>;
  expenses: Map<string, ExpenseRecord[]>;
  quotes: Map<string, QuoteRecord[]>;
  shareLinks: Map<string, ShareLinkRecord>;
  previews: Map<string, PreviewSession>;
  jobs: Map<string, JobRecord>;
  idempotencyCache: Map<string, { status: number; body: unknown }>;
  telemetry: SystemTelemetry;
}

const globalForAayojan = globalThis as unknown as {
  __AAYOJAN_STORE__?: GlobalStore;
};

function createSeededStore(): GlobalStore {
  const events = new Map<string, EventState>();
  const versions = new Map<string, EventVersionRecord[]>();
  const expenses = new Map<string, ExpenseRecord[]>();
  const quotes = new Map<string, QuoteRecord[]>();
  const shareLinks = new Map<string, ShareLinkRecord>();
  const previews = new Map<string, PreviewSession>();
  const jobs = new Map<string, JobRecord>();
  const idempotencyCache = new Map<string, { status: number; body: unknown }>();

  const telemetry: SystemTelemetry = {
    validatorPassCount: 142,
    validatorRejectCount: 9,
    rejectionsByCode: {
      I7_VENUE_CAPACITY_EXCEEDED: 5,
      INFEASIBLE_BUDGET: 3,
      I5_DEPENDENCY_ORDER_VIOLATION: 1,
    },
    llmCallsTotal: 64,
    llmFirstPassValid: 62,
    llmRetriesUsed: 2,
    llmFallbackUsed: 1,
    llmCacheHits: 19,
    avgLlmLatencyMs: 680,
    circuitState: 'CLOSED',
    consecutiveFailures: 0,
    templateOnlyMode: process.env.TEMPLATE_ONLY_MODE === 'true',
    estimatedSpendUsd: 0.42,
  };

  // Seed all 3 persona events
  for (const presetKey of Object.keys(PERSONA_PRESETS)) {
    const preset = PERSONA_PRESETS[presetKey];
    const v1State = createInitialEvent(preset);
    const v1Health = computeHealth(v1State).score;
    const v1Diff = computeDiff(v1State, v1State);
    v1Diff.summary = `Version 1: Initial verified ${v1State.type} plan generated for ${v1State.guests} guests in ${v1State.city} (Budget ₹${v1State.budget.toLocaleString('en-IN')}).`;

    events.set(v1State.id, v1State);
    versions.set(v1State.id, [
      {
        event_id: v1State.id,
        version: 1,
        state: v1State,
        ops: [],
        diff: v1Diff,
        cause: 'Initial event generation from intake brief',
        health: v1Health,
        created_by: preset.title.includes('Riya')
          ? 'Riya Sharma'
          : preset.title.includes('Arjun')
            ? 'Arjun Mehta'
            : 'Meena Kulkarni (RWA Secy)',
        created_at: '2026-11-01T09:00:00+05:30',
      },
    ]);
  }

  // Seed realistic quotes & expenses for Riya's Jaipur Wedding
  const weddingId = 'evt-jaipur-wedding';
  quotes.set(weddingId, [
    {
      id: 'qt-wed-1',
      event_id: weddingId,
      category: 'Catering',
      vendor_name: 'Shree Annapurna Royal Halwai & Caterers',
      amount: 340000,
      inclusions: '3 functions, live Rajasthani chaat, Dal Baati Churma, bone-china crockery, 1:15 waiter ratio',
      received_on: '2026-10-28',
    },
    {
      id: 'qt-wed-2',
      event_id: weddingId,
      category: 'Catering',
      vendor_name: 'Kanha Heritage Banquets & Catering',
      amount: 390000,
      inclusions: '3 functions, live counters + imported fruit bar, brassware service',
      received_on: '2026-10-29',
    },
    {
      id: 'qt-wed-3',
      event_id: weddingId,
      category: 'Catering',
      vendor_name: 'Marwar Pangat Kitchens',
      amount: 310000,
      inclusions: '2 main meals + high tea, standard steel/melamine service, generator fuel extra',
      received_on: '2026-10-30',
    },
    {
      id: 'qt-wed-4',
      event_id: weddingId,
      category: 'Venue',
      vendor_name: 'Jaipur Heritage Haveli Courtyard (Amer Rd)',
      amount: 216000,
      capacity: 250,
      inclusions: 'Central lawn + indoor hall backup, 6 green rooms, 6hr DG backup (Max 250 guests)',
      received_on: '2026-10-25',
    },
    {
      id: 'qt-wed-5',
      event_id: weddingId,
      category: 'Venue',
      vendor_name: 'Jaipur Grand Durbar Lawn & Hall (400 pax)',
      amount: 265000,
      capacity: 400,
      inclusions: 'Large main lawn + pillarless hall, 8 rooms, valet for 150 cars (Max 400 guests)',
      received_on: '2026-10-27',
    },
    {
      id: 'qt-wed-6',
      event_id: weddingId,
      category: 'Decor and florals',
      vendor_name: 'Kesariya Marigold Studio Jaipur',
      amount: 115000,
      inclusions: 'Fresh genda & rajnigandha mandap, brass urlis, sangeet LED backdrop',
      received_on: '2026-10-30',
    },
  ]);

  const initialWeddingExpenses: ExpenseRecord[] = [
    {
      id: 'exp-wed-1',
      event_id: weddingId,
      category: 'Venue',
      amount: 108000,
      note: '50% booking advance for Jaipur Heritage Haveli Courtyard',
      paid_on: '2026-10-26',
      created_at: '2026-10-26T14:20:00+05:30',
    },
    {
      id: 'exp-wed-2',
      event_id: weddingId,
      category: 'Catering',
      amount: 90000,
      note: '25% token advance after family tasting session',
      paid_on: '2026-10-29',
      created_at: '2026-10-29T18:10:00+05:30',
    },
    {
      id: 'exp-wed-3',
      event_id: weddingId,
      category: 'Attire and jewellery',
      amount: 85000,
      note: 'Bridal lehenga & family Pagdi order deposit in Johari Bazaar',
      paid_on: '2026-10-31',
      created_at: '2026-10-31T16:00:00+05:30',
    },
  ];
  expenses.set(weddingId, initialWeddingExpenses);

  // Sync actuals into wedding state
  const wedState = events.get(weddingId)!;
  for (const exp of initialWeddingExpenses) {
    const line = wedState.lines.find((l) => l.category === exp.category);
    if (line) line.actual += exp.amount;
  }

  // Seed sample quotes for Birthday & Community Mela
  quotes.set('evt-arjun-birthday', [
    {
      id: 'qt-bir-1',
      event_id: 'evt-arjun-birthday',
      category: 'Catering',
      vendor_name: 'Little Bites Kitchen & Bakehouse',
      amount: 30000,
      inclusions: 'Nut-free kids sliders, fries, fruit skewers + parent masala chai & samosa bar',
      received_on: '2026-10-30',
    },
    {
      id: 'qt-bir-2',
      event_id: 'evt-arjun-birthday',
      category: 'Entertainment and games',
      vendor_name: 'QuestMasters Kids Mystery & Science Crew',
      amount: 10500,
      inclusions: '45-min cipher treasure hunt + 30-min dry-ice science show + return badges',
      received_on: '2026-10-31',
    },
  ]);
  expenses.set('evt-arjun-birthday', [
    {
      id: 'exp-bir-1',
      event_id: 'evt-arjun-birthday',
      category: 'Venue',
      amount: 18000,
      note: 'Clubhouse party hall full booking deposit',
      paid_on: '2026-10-30',
      created_at: '2026-10-30T11:00:00+05:30',
    },
  ]);
  const birState = events.get('evt-arjun-birthday')!;
  birState.lines.find((l) => l.category === 'Venue')!.actual = 18000;

  quotes.set('evt-diwali-mela', [
    {
      id: 'qt-com-1',
      event_id: 'evt-diwali-mela',
      category: 'Venue, permits, infrastructure',
      vendor_name: 'Bharat Tent & Certified Civic Infrastructure',
      amount: 110000,
      capacity: 500,
      inclusions: 'Fire-retardant pandal, 20 octonorm stalls, 62.5 kVA silent DG set, licensed wiring',
      received_on: '2026-10-28',
    },
    {
      id: 'qt-com-2',
      event_id: 'evt-diwali-mela',
      category: 'Safety, medical, insurance',
      vendor_name: 'Suraksha Event Fire & Medical Response',
      amount: 34000,
      inclusions: '10 ABC fire extinguishers, 4 marshals, first-aid booth & standby ambulance',
      received_on: '2026-10-29',
    },
  ]);
  expenses.set('evt-diwali-mela', [
    {
      id: 'exp-com-1',
      event_id: 'evt-diwali-mela',
      category: 'Venue, permits, infrastructure',
      amount: 45000,
      note: 'Ground security deposit & electrical load application fee',
      paid_on: '2026-10-29',
      created_at: '2026-10-29T12:00:00+05:30',
    },
  ]);
  const comState = events.get('evt-diwali-mela')!;
  comState.lines.find((l) => l.category === 'Venue, permits, infrastructure')!.actual = 45000;

  // Seed default share links for quick testing
  const defaultShareLinks: ShareLinkRecord[] = [
    {
      id: 'sh-family-1',
      token: 'demo-family-riya-jaipur',
      token_hash: hashShareToken('demo-family-riya-jaipur'),
      event_id: weddingId,
      role: 'family',
      expires_at: '2026-12-31T23:59:59+05:30',
      revoked_at: null,
      created_at: '2026-11-01T09:15:00+05:30',
    },
    {
      id: 'sh-vendor-1',
      token: 'demo-vendor-catering-jaipur',
      token_hash: hashShareToken('demo-vendor-catering-jaipur'),
      event_id: weddingId,
      role: 'vendor',
      vendor_category: 'Catering',
      expires_at: '2026-12-31T23:59:59+05:30',
      revoked_at: null,
      created_at: '2026-11-01T09:16:00+05:30',
    },
    {
      id: 'sh-volunteer-1',
      token: 'demo-volunteer-diwali-mela',
      token_hash: hashShareToken('demo-volunteer-diwali-mela'),
      event_id: 'evt-diwali-mela',
      role: 'volunteer',
      expires_at: '2026-12-31T23:59:59+05:30',
      revoked_at: null,
      created_at: '2026-11-01T09:20:00+05:30',
    },
  ];
  for (const sl of defaultShareLinks) {
    shareLinks.set(sl.token, sl);
  }

  return {
    events,
    versions,
    expenses,
    quotes,
    shareLinks,
    previews,
    jobs,
    idempotencyCache,
    telemetry,
  };
}

export function hashShareToken(token: string): string {
  const pepper = process.env.SHARE_TOKEN_PEPPER ?? 'aayojan-default-pepper-v1';
  return crypto.createHash('sha256').update(`${pepper}:${token}`).digest('hex');
}

export function getStore(): GlobalStore {
  if (!globalForAayojan.__AAYOJAN_STORE__) {
    globalForAayojan.__AAYOJAN_STORE__ = createSeededStore();
  }
  return globalForAayojan.__AAYOJAN_STORE__;
}

export function recordValidatorPass(): void {
  const store = getStore();
  store.telemetry.validatorPassCount += 1;
}

export function recordValidatorRejection(codes: InvariantCode[]): void {
  const store = getStore();
  store.telemetry.validatorRejectCount += 1;
  for (const c of codes) {
    store.telemetry.rejectionsByCode[c] =
      (store.telemetry.rejectionsByCode[c] ?? 0) + 1;
  }
}

export function commitEventOps(params: {
  eventId: string;
  baseVersion: number;
  ops: TypedOp[];
  cause: string;
  actor?: string;
}):
  | {
      ok: true;
      state: EventState;
      versionRecord: EventVersionRecord;
    }
  | {
      ok: false;
      status: 404 | 409 | 422;
      code: string;
      detail: string;
      latestVersion?: number;
      violations?: ReturnType<typeof validateEvent>['violations'];
      repairOps?: TypedOp[];
      repairExplanation?: string;
    } {
  const store = getStore();
  const current = store.events.get(params.eventId);
  if (!current) {
    return {
      ok: false,
      status: 404,
      code: 'EVENT_NOT_FOUND',
      detail: `Event "${params.eventId}" was not found.`,
    };
  }

  // Optimistic locking check (If-Match / base_version)
  if (current.version !== params.baseVersion) {
    return {
      ok: false,
      status: 409,
      code: 'VERSION_CONFLICT',
      detail: `Stale base_version ${params.baseVersion}; current persisted version is ${current.version}.`,
      latestVersion: current.version,
    };
  }

  const outcome = applyOps(current, params.ops);
  if (!outcome.ok) {
    recordValidatorRejection(
      outcome.validation.violations.map((v) => v.code)
    );
    return {
      ok: false,
      status: 422,
      code: outcome.validation.violations[0]?.code ?? 'INVARIANT_VIOLATION',
      detail:
        outcome.validation.violations.map((v) => v.detail).join(' ') ||
        'Operation set violated event invariants.',
      violations: outcome.validation.violations,
      repairOps: outcome.validation.repairOps,
      repairExplanation: outcome.validation.repairExplanation,
    };
  }

  recordValidatorPass();
  store.events.set(params.eventId, outcome.nextState);

  const versionRecord: EventVersionRecord = {
    event_id: params.eventId,
    version: outcome.nextState.version,
    state: outcome.nextState,
    ops: params.ops,
    diff: outcome.diff,
    cause: params.cause,
    health: outcome.health.score,
    created_by: params.actor ?? 'Planner',
    created_at: new Date().toISOString(),
  };

  const history = store.versions.get(params.eventId) ?? [];
  history.push(versionRecord);
  store.versions.set(params.eventId, history);

  return {
    ok: true,
    state: outcome.nextState,
    versionRecord,
  };
}

export function createShareLink(params: {
  eventId: string;
  role: ShareRole;
  vendorCategory?: string;
  expiresInDays?: number;
}): ShareLinkRecord {
  const store = getStore();
  const rawBytes = crypto.randomBytes(12).toString('hex');
  const token = `aay_${params.role}_${rawBytes}`;
  const expiresAt = new Date(
    Date.now() + (params.expiresInDays ?? 14) * 86400000
  ).toISOString();

  const record: ShareLinkRecord = {
    id: `sh-${Date.now().toString(36)}`,
    token,
    token_hash: hashShareToken(token),
    event_id: params.eventId,
    role: params.role,
    vendor_category: params.vendorCategory,
    expires_at: expiresAt,
    revoked_at: null,
    created_at: new Date().toISOString(),
  };

  store.shareLinks.set(token, record);
  return record;
}
