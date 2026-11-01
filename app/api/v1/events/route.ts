import { NextRequest, NextResponse } from 'next/server';
import {
  computeDiff,
  computeHealth,
  createInitialEvent,
  PERSONA_PRESETS,
  validateEvent,
} from '@/lib/engine/core';
import { runIntakeAgent } from '@/lib/server/llm-gateway';
import {
  checkRateLimit,
  rfc7807Response,
  sanitizeUserText,
  withSecurityHeaders,
} from '@/lib/server/security';
import { getStore, recordValidatorPass } from '@/lib/server/store';

export async function GET(req: NextRequest) {
  const rate = checkRateLimit(req, 'events_get', 180);
  if (!rate.allowed) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Rate limit exceeded. Please retry shortly.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      req
    );
  }

  const store = getStore();
  const list = Array.from(store.events.values()).map((e) => ({
    id: e.id,
    title: e.brief.title,
    type: e.type,
    city: e.city,
    guests: e.guests,
    budget: e.budget,
    event_date: e.event_date,
    version: e.version,
    health: computeHealth(e).score,
  }));

  return withSecurityHeaders(
    NextResponse.json({
      events: list,
      telemetry: store.telemetry,
    }),
    req,
    rate
  );
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, 'events_post', 40);
  if (!rate.allowed) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Event creation rate limit exceeded. Please retry shortly.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      req
    );
  }

  const store = getStore();
  const idempotencyKey = req.headers.get('Idempotency-Key');
  if (idempotencyKey && store.idempotencyCache.has(idempotencyKey)) {
    const cached = store.idempotencyCache.get(idempotencyKey)!;
    return withSecurityHeaders(
      NextResponse.json(cached.body, { status: cached.status }),
      req,
      rate
    );
  }

  const body = await req.json();
  const { prompt: rawPrompt, presetKey } = body as {
    prompt?: string;
    presetKey?: string;
  };
  const prompt = rawPrompt ? sanitizeUserText(rawPrompt, 600) : undefined;

  let state;
  let degradedMode = store.telemetry.templateOnlyMode;

  if (presetKey && PERSONA_PRESETS[presetKey]) {
    state = createInitialEvent({
      ...PERSONA_PRESETS[presetKey],
      id: `evt-${presetKey.replace('_', '-')}-${Date.now().toString(36).slice(-4)}`,
    });
  } else {
    const intake = await runIntakeAgent(
      prompt || "Sister's wedding, 200 guests, Rs 12L, Jaipur, December"
    );
    state = createInitialEvent(intake.eventInput);
    degradedMode = intake.degradedMode;
  }

  const validation = validateEvent(state);
  if (!validation.valid) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/invariant-violation',
        title: 'Plan Validation Failed',
        status: 422,
        detail: validation.violations.map((v) => v.detail).join(' '),
        code: validation.violations[0]?.code ?? 'INVARIANT_VIOLATION',
        request_id: `req_${Date.now().toString(36)}`,
        violations: validation.violations,
      },
      req
    );
  }

  recordValidatorPass();
  const health = computeHealth(state);
  const diff = computeDiff(state, state);
  diff.summary = `Version 1: Initial verified ${state.type} plan generated for ${state.guests} guests in ${state.city} (Budget ₹${state.budget.toLocaleString('en-IN')}).`;

  store.events.set(state.id, state);
  store.versions.set(state.id, [
    {
      event_id: state.id,
      version: 1,
      state,
      ops: [],
      diff,
      cause: prompt ? `Intake: "${prompt.slice(0, 80)}"` : 'Persona template intake',
      health: health.score,
      created_by: 'Organizer',
      created_at: new Date().toISOString(),
    },
  ]);
  store.expenses.set(state.id, []);
  store.quotes.set(state.id, [
    {
      id: `qt-${Date.now().toString(36)}-1`,
      event_id: state.id,
      category: state.lines[0].category,
      vendor_name: state.vendors[0]?.name ?? `${state.city} Premier Partner`,
      amount: state.lines[0].planned,
      inclusions: 'Standard full-service package based on city tier benchmark',
      received_on: state.today,
    },
  ]);

  const jobId = `job_${Date.now().toString(36)}`;
  store.jobs.set(jobId, {
    id: jobId,
    event_id: state.id,
    kind: 'create_event',
    status: 'done',
    stage: 'done',
    result: { event_id: state.id, version: 1 },
    created_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });

  const responsePayload = {
    job_id: jobId,
    event_id: state.id,
    event: state,
    health,
    degradedMode,
  };

  if (idempotencyKey) {
    if (store.idempotencyCache.size >= 500) {
      const oldestKey = store.idempotencyCache.keys().next().value;
      if (oldestKey) store.idempotencyCache.delete(oldestKey);
    }
    store.idempotencyCache.set(idempotencyKey, {
      status: 201,
      body: responsePayload,
    });
  }

  return withSecurityHeaders(
    NextResponse.json(responsePayload, { status: 201 }),
    req,
    rate
  );
}
