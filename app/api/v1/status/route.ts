import { NextRequest, NextResponse } from 'next/server';
import { runGoldenEvalSuite } from '@/lib/engine/eval-suite';
import { getStore } from '@/lib/server/store';

export async function GET() {
  const store = getStore();
  const evalSummary = runGoldenEvalSuite();

  return NextResponse.json({
    status: 'healthy',
    readiness: {
      domain_engine: 'UP',
      version_store: 'UP',
      llm_gateway: store.telemetry.templateOnlyMode
        ? 'DEGRADED_TEMPLATE_ONLY'
        : store.telemetry.circuitState === 'OPEN'
          ? 'CIRCUIT_OPEN_FALLBACK'
          : 'UP',
    },
    telemetry: store.telemetry,
    eval: evalSummary,
    invariants: [
      { code: 'I1', name: 'Budget lines sum exactly to total budget (integer INR)', status: 'ENFORCED' },
      { code: 'I2', name: 'Contingency >= 5% of total budget', status: 'ENFORCED' },
      { code: 'I3', name: 'Open task due dates lie within [today, event_date]', status: 'ENFORCED' },
      { code: 'I4', name: 'Task dependency IDs exist and graph is acyclic (DAG)', status: 'ENFORCED' },
      { code: 'I5', name: 'Dependencies finish on or before dependent start date', status: 'ENFORCED' },
      { code: 'I6', name: 'Locked budget lines never altered by automatic rebalancing', status: 'ENFORCED' },
      { code: 'I7', name: 'Venue capacity >= guest count where declared', status: 'ENFORCED' },
      { code: 'I8', name: 'Task categories belong to event-type template', status: 'ENFORCED' },
      { code: 'I9', name: 'Immutable version sequence increments by +1', status: 'ENFORCED' },
      { code: 'I10', name: 'All text fields length-bounded and script-sanitized', status: 'ENFORCED' },
    ],
  });
}

export async function POST(req: NextRequest) {
  const store = getStore();
  const body = await req.json();

  if (typeof body.templateOnlyMode === 'boolean') {
    store.telemetry.templateOnlyMode = body.templateOnlyMode;
    if (!body.templateOnlyMode) {
      store.telemetry.circuitState = 'CLOSED';
      store.telemetry.consecutiveFailures = 0;
    }
  }

  if (body.simulateCircuitOpen === true) {
    store.telemetry.circuitState = 'OPEN';
    store.telemetry.consecutiveFailures = 5;
  } else if (body.simulateCircuitOpen === false) {
    store.telemetry.circuitState = 'CLOSED';
    store.telemetry.consecutiveFailures = 0;
  }

  const evalSummary = runGoldenEvalSuite();
  return NextResponse.json({
    telemetry: store.telemetry,
    eval: evalSummary,
  });
}
