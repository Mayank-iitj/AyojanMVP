import { NextRequest, NextResponse } from 'next/server';
import {
  applyOps,
  computeDiff,
  computeHealth,
} from '@/lib/engine/core';
import { ShareRole, TypedOp } from '@/lib/engine/types';
import {
  runIdeasAgent,
  runOpsAgentWithRetry,
  runVendorOutreachAgent,
} from '@/lib/server/llm-gateway';
import {
  checkRateLimit,
  rfc7807Response,
  withSecurityHeaders,
} from '@/lib/server/security';
import {
  commitEventOps,
  createShareLink,
  getStore,
} from '@/lib/server/store';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(req, 'event_detail_get', 180);
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

  const { id } = await context.params;
  const store = getStore();
  const state = store.events.get(id);

  if (!state) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/not-found',
        title: 'Event Not Found',
        status: 404,
        detail: `Event "${id}" does not exist.`,
        code: 'EVENT_NOT_FOUND',
        request_id: `req_${Date.now().toString(36)}`,
      },
      req
    );
  }

  const health = computeHealth(state);
  const versions = store.versions.get(id) ?? [];
  const expenses = store.expenses.get(id) ?? [];
  const quotes = store.quotes.get(id) ?? [];
  const shareLinks = Array.from(store.shareLinks.values()).filter(
    (s) => s.event_id === id
  );

  return withSecurityHeaders(
    NextResponse.json({
      event: state,
      health,
      versions,
      expenses,
      quotes,
      shareLinks,
      telemetry: store.telemetry,
    }),
    req,
    rate
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(req, 'event_action_post', 120);
  if (!rate.allowed) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Action rate limit exceeded. Please retry shortly.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      req
    );
  }

  const { id } = await context.params;
  const store = getStore();
  const current = store.events.get(id);

  if (!current) {
    return rfc7807Response(
      {
        type: 'https://aayojan.dev/errors/not-found',
        title: 'Event Not Found',
        status: 404,
        detail: `Event "${id}" does not exist.`,
        code: 'EVENT_NOT_FOUND',
        request_id: `req_${Date.now().toString(36)}`,
      },
      req
    );
  }

  const body = await req.json();
  const action = body.action as string;

  // 1. Deterministic Preview (Sliders / Typed Ops, nothing persisted, <1s)
  if (action === 'preview') {
    const ops = (body.ops ?? []) as TypedOp[];
    const outcome = applyOps(current, ops);
    if (!outcome.ok) {
      return NextResponse.json(
        {
          type: 'https://aayojan.dev/errors/invariant-violation',
          title: 'Preview Violates Plan Invariants',
          status: 422,
          detail: outcome.validation.violations.map((v) => v.detail).join(' '),
          code: outcome.validation.violations[0]?.code ?? 'INVARIANT_VIOLATION',
          request_id: `req_${Date.now().toString(36)}`,
          violations: outcome.validation.violations,
          repair_ops: outcome.validation.repairOps,
          repair_explanation: outcome.validation.repairExplanation,
        },
        { status: 422 }
      );
    }

    const previewId = `prv_${Date.now().toString(36)}`;
    store.previews.set(previewId, {
      id: previewId,
      event_id: id,
      base_version: current.version,
      ops,
      nextState: outcome.nextState,
      diff: outcome.diff,
      health: outcome.health.score,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      preview_id: previewId,
      base_version: current.version,
      ops,
      previewState: outcome.nextState,
      diff: outcome.diff,
      health: outcome.health,
    });
  }

  // 2. Commit Typed Ops (Requires base_version / If-Match optimistic lock)
  if (action === 'commit') {
    const baseVersion =
      typeof body.base_version === 'number'
        ? body.base_version
        : Number(req.headers.get('If-Match') ?? current.version);
    const ops = (body.ops ?? []) as TypedOp[];
    const cause = (body.cause as string) || 'Plan update committed';

    const committed = commitEventOps({
      eventId: id,
      baseVersion,
      ops,
      cause,
      actor: body.actor ?? 'Organizer',
    });

    if (!committed.ok) {
      return NextResponse.json(
        {
          type: 'https://aayojan.dev/errors/commit-failed',
          title:
            committed.status === 409
              ? 'Version Conflict (409)'
              : 'Invariant Validation Rejected Write',
          status: committed.status,
          detail: committed.detail,
          code: committed.code,
          request_id: `req_${Date.now().toString(36)}`,
          latest_version: committed.latestVersion,
          violations: committed.violations,
          repair_ops: committed.repairOps,
          repair_explanation: committed.repairExplanation,
        },
        { status: committed.status }
      );
    }

    return NextResponse.json({
      event: committed.state,
      health: computeHealth(committed.state),
      versionRecord: committed.versionRecord,
      versions: store.versions.get(id) ?? [],
      telemetry: store.telemetry,
    });
  }

  // 3. Replan Proposal from Natural Language Instruction (Ops Agent + Validator Check)
  if (action === 'replan_propose') {
    const instruction = String(body.instruction ?? '').trim();
    const agentRes = await runOpsAgentWithRetry(instruction, current);

    if (agentRes.ops.length === 0) {
      return NextResponse.json(
        {
          type: 'https://aayojan.dev/errors/unsupported-operation',
          title: 'Could Not Translate Instruction',
          status: 422,
          detail: agentRes.explanation,
          code: 'UNSUPPORTED_OPERATION',
          request_id: `req_${Date.now().toString(36)}`,
        },
        { status: 422 }
      );
    }

    const outcome = applyOps(current, agentRes.ops);
    if (!outcome.ok) {
      // Return 422 with the caught invariant violation AND the one-click repair proposal!
      return NextResponse.json(
        {
          type: 'https://aayojan.dev/errors/invariant-violation',
          title: 'Validator Caught Plan Conflict',
          status: 422,
          detail: outcome.validation.violations.map((v) => v.detail).join(' '),
          code: outcome.validation.violations[0]?.code ?? 'INVARIANT_VIOLATION',
          request_id: `req_${Date.now().toString(36)}`,
          proposed_ops: agentRes.ops,
          violations: outcome.validation.violations,
          repair_ops: outcome.validation.repairOps,
          repair_explanation: outcome.validation.repairExplanation,
          degradedMode: agentRes.degradedMode,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ops: agentRes.ops,
      explanation: agentRes.explanation,
      previewState: outcome.nextState,
      diff: outcome.diff,
      health: outcome.health,
      degradedMode: agentRes.degradedMode,
      retriesUsed: agentRes.retriesUsed,
    });
  }

  // 4. Undo to a Previous Version (Creates a new immutable version restoring prior snapshot)
  if (action === 'undo') {
    const history = store.versions.get(id) ?? [];
    const targetVersion =
      typeof body.target_version === 'number'
        ? body.target_version
        : Math.max(1, current.version - 1);
    const targetRecord = history.find((v) => v.version === targetVersion);
    if (!targetRecord) {
      return NextResponse.json(
        {
          type: 'https://aayojan.dev/errors/not-found',
          title: 'Target Version Not Found',
          status: 404,
          detail: `Version ${targetVersion} not found in history.`,
          code: 'VERSION_NOT_FOUND',
          request_id: `req_${Date.now().toString(36)}`,
        },
        { status: 404 }
      );
    }

    const restoredState = JSON.parse(JSON.stringify(targetRecord.state));
    restoredState.parent_version = current.version;
    restoredState.version = current.version + 1;

    const diff = computeDiff(current, restoredState);
    diff.summary = `Version ${restoredState.version}: Reverted plan state to Version ${targetVersion} snapshot.`;
    const health = computeHealth(restoredState);

    store.events.set(id, restoredState);
    const newRecord = {
      event_id: id,
      version: restoredState.version,
      state: restoredState,
      ops: [],
      diff,
      cause: `Undo to Version ${targetVersion}`,
      health: health.score,
      created_by: 'Organizer',
      created_at: new Date().toISOString(),
    };
    history.push(newRecord);
    store.versions.set(id, history);

    return NextResponse.json({
      event: restoredState,
      health,
      versionRecord: newRecord,
      versions: history,
    });
  }

  // 5. Log Actual Expense (FR-13)
  if (action === 'log_expense') {
    const category = String(body.category ?? '');
    const amount = Math.max(0, Math.round(Number(body.amount ?? 0)));
    const note = String(body.note ?? 'Vendor payment').slice(0, 200);
    const paid_on = String(body.paid_on ?? current.today);

    const line = current.lines.find((l) => l.category === category);
    if (!line || amount <= 0) {
      return NextResponse.json(
        {
          type: 'https://aayojan.dev/errors/invalid-expense',
          title: 'Invalid Expense Entry',
          status: 422,
          detail: 'Select a valid category and a positive integer rupee amount.',
          code: 'INVALID_EXPENSE',
          request_id: `req_${Date.now().toString(36)}`,
        },
        { status: 422 }
      );
    }

    line.actual += amount;
    const expRecord = {
      id: `exp-${Date.now().toString(36)}`,
      event_id: id,
      category,
      amount,
      note,
      paid_on,
      created_at: new Date().toISOString(),
    };
    const list = store.expenses.get(id) ?? [];
    list.unshift(expRecord);
    store.expenses.set(id, list);

    return NextResponse.json({
      event: current,
      health: computeHealth(current),
      expenses: list,
    });
  }

  // 6. Add Vendor Quote (FR-4)
  if (action === 'add_quote') {
    const category = String(body.category ?? current.lines[0].category);
    const vendor_name = String(body.vendor_name ?? '').trim();
    const amount = Math.max(1000, Math.round(Number(body.amount ?? 0)));
    const capacity = body.capacity ? Math.round(Number(body.capacity)) : undefined;
    const inclusions = String(body.inclusions ?? 'Standard package inclusions').slice(0, 240);

    if (!vendor_name) {
      return NextResponse.json(
        {
          type: 'https://aayojan.dev/errors/invalid-quote',
          title: 'Vendor Name Required',
          status: 422,
          detail: 'Please provide the vendor name and quoted integer rupee amount.',
          code: 'INVALID_QUOTE',
          request_id: `req_${Date.now().toString(36)}`,
        },
        { status: 422 }
      );
    }

    const qtRecord = {
      id: `qt-${Date.now().toString(36)}`,
      event_id: id,
      category,
      vendor_name,
      amount,
      capacity,
      inclusions,
      received_on: current.today,
    };
    const list = store.quotes.get(id) ?? [];
    list.push(qtRecord);
    store.quotes.set(id, list);

    return NextResponse.json({
      quotes: list,
    });
  }

  // 7. Generate Vendor Outreach Draft (WhatsApp / Email, English / Hinglish)
  if (action === 'outreach') {
    const category = String(body.category ?? current.lines[0].category);
    const channel = body.channel === 'email' ? 'email' : 'whatsapp';
    const language = body.language === 'hinglish' ? 'hinglish' : 'english';

    const draft = await runVendorOutreachAgent({
      state: current,
      category,
      channel,
      language,
    });

    return NextResponse.json(draft);
  }

  // 8. Regenerate Ideas with Constraint (FR-5)
  if (action === 'regenerate_ideas') {
    const constraint = String(body.constraint ?? 'Local sustainable materials');
    const res = await runIdeasAgent(current, constraint);
    current.ideas = res.ideas;
    return NextResponse.json({
      event: current,
      ideas: res.ideas,
      degradedMode: res.degradedMode,
    });
  }

  // 9. Create or Revoke Role-Based Share Link (FR-11)
  if (action === 'create_share') {
    const role: ShareRole =
      body.role === 'vendor' || body.role === 'volunteer' ? body.role : 'family';
    const link = createShareLink({
      eventId: id,
      role,
      vendorCategory: body.vendor_category,
      expiresInDays: Number(body.expires_in_days ?? 14),
    });
    const shareLinks = Array.from(store.shareLinks.values()).filter(
      (s) => s.event_id === id
    );
    return NextResponse.json({ link, shareLinks });
  }

  if (action === 'revoke_share') {
    const token = String(body.token ?? '');
    const record = store.shareLinks.get(token);
    if (record && record.event_id === id) {
      record.revoked_at = new Date().toISOString();
    }
    const shareLinks = Array.from(store.shareLinks.values()).filter(
      (s) => s.event_id === id
    );
    return NextResponse.json({ shareLinks });
  }

  return NextResponse.json(
    {
      type: 'https://aayojan.dev/errors/bad-request',
      title: 'Unknown Action',
      status: 400,
      detail: `Unsupported action "${action}".`,
      code: 'UNKNOWN_ACTION',
      request_id: `req_${Date.now().toString(36)}`,
    },
    { status: 400 }
  );
}
