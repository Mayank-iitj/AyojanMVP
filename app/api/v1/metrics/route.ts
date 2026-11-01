import { runGoldenEvalSuite } from '@/lib/engine/eval-suite';
import { getStore } from '@/lib/server/store';

export async function GET() {
  const store = getStore();
  const t = store.telemetry;
  const evalSummary = runGoldenEvalSuite();

  const lines: string[] = [
    '# HELP aayojan_validator_passes_total Total number of event mutations passing all 10 invariants',
    '# TYPE aayojan_validator_passes_total counter',
    `aayojan_validator_passes_total ${t.validatorPassCount}`,
    '# HELP aayojan_validator_rejections_total Total number of invalid mutations blocked by validator',
    '# TYPE aayojan_validator_rejections_total counter',
    `aayojan_validator_rejections_total ${t.validatorRejectCount}`,
    '# HELP aayojan_llm_calls_total Total LLM gateway invocations',
    '# TYPE aayojan_llm_calls_total counter',
    `aayojan_llm_calls_total ${t.llmCallsTotal}`,
    '# HELP aayojan_llm_cache_hits_total Total normalized prompt cache hits',
    '# TYPE aayojan_llm_cache_hits_total counter',
    `aayojan_llm_cache_hits_total ${t.llmCacheHits}`,
    '# HELP aayojan_llm_circuit_open Circuit breaker state (1 = OPEN or TEMPLATE_ONLY, 0 = CLOSED)',
    '# TYPE aayojan_llm_circuit_open gauge',
    `aayojan_llm_circuit_open ${t.circuitState === 'OPEN' || t.templateOnlyMode ? 1 : 0}`,
    '# HELP aayojan_golden_eval_pass_ratio Pass ratio on the 50-case Golden Eval suite',
    '# TYPE aayojan_golden_eval_pass_ratio gauge',
    `aayojan_golden_eval_pass_ratio ${(evalSummary.passed / evalSummary.total).toFixed(4)}`,
  ];

  for (const [code, count] of Object.entries(t.rejectionsByCode)) {
    lines.push(
      `aayojan_validator_rejections_by_code{code="${code}"} ${count}`
    );
  }

  return new Response(lines.join('\n') + '\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
