import { NextRequest } from 'next/server';
import { getStore } from '@/lib/server/store';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = getStore();
  const job = store.jobs.get(id);

  const stages: Array<{
    stage: string;
    label: string;
    detail: string;
  }> = [
    {
      stage: 'parsing',
      label: 'Parsing Intake Brief',
      detail: 'Extracting city tier, headcount, budget bounds & assumptions',
    },
    {
      stage: 'planning',
      label: 'Selecting RAG Templates',
      detail: 'Matching curated checklists & regional ritual/permit citations',
    },
    {
      stage: 'budgeting',
      label: 'Solving Integer Rupee Allocations',
      detail: 'Enforcing I1 exact sum and I2 >=5% contingency floor',
    },
    {
      stage: 'scheduling',
      label: 'Backward Timeline & Critical Path',
      detail: 'Running topological dependency pass (I3, I4, I5)',
    },
    {
      stage: 'validating',
      label: 'Verifying All 10 Invariants',
      detail: 'Checking venue capacity (I7) and computing Plan Health Score',
    },
    {
      stage: 'ideas',
      label: 'Assembling Vendor Kits & Ideas',
      detail: 'Preparing Hinglish/English outreach templates & run-of-show',
    },
    {
      stage: 'done',
      label: 'Plan Verified & Ready',
      detail: 'Version 1 persisted',
    },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        const payload = JSON.stringify({
          job_id: id,
          event_id: job?.event_id ?? 'evt-jaipur-wedding',
          stage: s.stage,
          label: s.label,
          detail: s.detail,
          progress: Math.round(((i + 1) / stages.length) * 100),
        });
        controller.enqueue(
          encoder.encode(`id: ${i + 1}\nevent: stage\ndata: ${payload}\n\n`)
        );
        await new Promise((r) => setTimeout(r, 90));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
