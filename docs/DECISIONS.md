# Architectural Decisions Log (`DECISIONS.md`)

## ADR-001: Unified Next.js 15 Full-Stack Runtime with Isomorphic Pure Domain Engine
- **Context**: The specification defines a pure deterministic Domain Engine mirrored across backend API routes and frontend client slider previews, backed by versioned persistence, SSE job streams, and an LLM gateway.
- **Decision**: Implement the pure Domain Engine in `/lib/engine/` with zero IO dependencies so that identical functions (`applyOps`, `validateEvent`, `computeHealth`, `computeDiff`, `rescaleBudget`, `scheduleTimeline`) execute both in Next.js `/api/v1/*` routes and in the browser for sub-10ms What-If slider previews.
- **Consequences**: 100% behavioral parity between preview and commit; zero cross-language serialization drift; property tests and 500 test vectors run directly via `node:test`.

## ADR-002: Integer Rupees & Asia/Kolkata ISO Dates
- **Context**: Floating-point currency math causes rounding drift that violates Invariant I1 (`sum(lines) === budget`). Naive datetimes cause timezone drift around midnight.
- **Decision**: All monetary amounts are strict integers (`Math.round` with remainder absorbed by the largest unlocked non-contingency line, or contingency if all other lines are locked). All dates are `YYYY-MM-DD` strings interpreted in `Asia/Kolkata` with deterministic day-difference arithmetic.

## ADR-003: Validator-Gated Retries & Repair Proposals
- **Context**: When a user or LLM requests a change that violates an invariant (e.g. increasing guests from 200 to 350 when the selected venue capacity is 250, violating I7, or cutting budget below locked lines + 5% contingency, violating I1/I2/I6), the system must never persist an invalid state.
- **Decision**: `applyOpsAndValidate` returns machine-readable RFC 7807 reason codes (`I7_VENUE_CAPACITY_EXCEEDED`, `I1_BUDGET_SUM_MISMATCH`, `I2_CONTINGENCY_BELOW_5_PCT`, `I3_TASK_DATE_OUT_OF_RANGE`, `I5_DEPENDENCY_ORDER_VIOLATION`, etc.) along with a deterministic `repairSuggestion` (typed ops that resolve the conflict, e.g., upgrading venue capacity or unlocking a category) so the user can inspect the caught violation and repair it with one click.

## ADR-004: LLM Gateway Circuit Breaker & Template-Only Degraded Mode
- **Context**: External LLM providers can fail, rate-limit, or be disabled via kill switch.
- **Decision**: The LLM Gateway (`/lib/llm/gateway.ts`) wraps `@google/genai` (`gemini-3.8-flash`) with timeouts, exponential backoff, a 5-failure circuit breaker, response caching, and a deterministic rule/template fallback compiler that translates natural-language edits, intake briefs, vendor outreach drafts (English & Hinglish), and RAG-cited ideas even when `TEMPLATE_ONLY_MODE=true` or the circuit is open.
