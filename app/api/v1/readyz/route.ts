import { NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';

export async function GET() {
  const store = getStore();
  const eventsCount = store.events.size;

  return NextResponse.json(
    {
      status: 'ready',
      checks: {
        domain_engine: 'UP',
        version_store: eventsCount > 0 ? 'UP' : 'EMPTY',
        llm_circuit_state: store.telemetry.circuitState,
        template_only_fallback: store.telemetry.templateOnlyMode
          ? 'ACTIVE'
          : 'STANDBY',
      },
      events_loaded: eventsCount,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': `rdy_${Date.now().toString(36)}`,
      },
    }
  );
}
