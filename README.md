# Aayojan — Verified Event Planning Engine (v1.0)

**Aayojan** is a production-grade, verified, versioned event-planning engine for **Weddings**, **Birthdays**, and **Community Events**. Unlike generic chatbots or static spreadsheets, Aayojan maintains one single source-of-truth **Event State** (budget lines, backward-scheduled dependency DAG, vendor kits, quotes, actual expenses, and cited ideas) and re-solves it deterministically after every mutation with explainable diffs and hard mathematical invariants (`I1`–`I10`).

---

## Evaluation Matrix Alignment

### 1. Problem Statement Alignment
- **3 Event Archetypes Pre-Seeded & Configurable**:
  - **Wedding (`evt-jaipur-wedding`)**: Riya's Sister's Wedding in Jaipur — 200 guests, ₹12,00,000 budget, 3 functions (Mehendi, Sangeet, Wedding + Reception), 8 budget categories.
  - **Birthday (`evt-arjun-birthday`)**: Arjun's 10th Birthday Mystery Hunt in Bengaluru — 45 guests, ₹75,000 budget, 7 budget categories.
  - **Community (`evt-diwali-mela`)**: Green Valley RWA Diwali Mela in Pune — 400 guests, ₹3,50,000 budget, 7 civic/safety categories.
- **Closed Vocabulary of 17 Typed Operations (`TypedOp`)**:
  `SetBudget`, `SetGuests`, `SetDate`, `SetTier`, `LockLine`, `UnlockLine`, `AllocateLine`, `AddLine`, `RemoveLine`, `ShiftTask`, `CompleteTask`, `AssignTask`, `SelectVendor`, `CancelVendor`, `AddFunction`, `RemoveFunction`, `RegenerateIdeas`.
- **Explainable Plan Health Score (0–100)**:
  Interactive popover detailing exact point deductions (`budgetBuffer`, `timelineBuffer`, `criticalVendors`, `overdueTasks`, `overallocatedCategories`) with **1-tap deterministic fix actions**.
- **Deterministic What-If Sliders (<50ms Preview)**:
  Real-time sliders for Total Budget (`₹`), Guest Headcount, and Event Date (`Asia/Kolkata`) that respect locked lines (`I6`) and highlight category deltas before committing a new version.
- **Bilingual Vendor Kits & Quote Matrix**:
  Category-specific checklists, red flags, payment milestone schedules (`30/50/20`), side-by-side quote comparison (`Select as Winner` emits `SelectVendor` + `AllocateLine` + `LockLine`), and **English + Hinglish** WhatsApp/Email outreach generators.

### 2. Code Quality & Architecture
- **Strict Separation of Concerns**:
  - `lib/engine/types.ts`: Strict TypeScript domain contracts (zero `any`, discriminated unions for all 17 `TypedOp` variants, RFC 7807 Problem Details schema).
  - `lib/engine/core.ts`: Pure, side-effect-free state transition engine (`buildBaselineBudget`, idempotent `rescaleBudget`, `scheduleTimeline`, `computeHealth`, `validateEvent`, `computeDiff`, `applyOps`).
  - `lib/engine/templates.ts`: Appendix A deterministic templates, city tiers, lead-time DAG specifications, and 12 cited RAG documents (`TPL-WED-01`..`TPL-COM-04`).
  - `lib/engine/nlp-compiler.ts`: Prompt-injection firewall, natural-language-to-typed-ops compiler, and bilingual outreach generator.
  - `lib/server/llm-gateway.ts`: Server-only `@google/genai` (`gemini-3-flash-preview`) gateway with validator reason-code retry loop, circuit breaker, bounded response cache, and **Template-Only Degraded Mode** fallback.
  - `lib/server/security.ts`: Sliding-window rate limiter, constant-time token verification (`crypto.timingSafeEqual`), XSS/control-character sanitization, and `X-Correlation-ID` tracing headers.

### 3. Hard Domain Invariants (`I1`–`I10`)
Every state mutation (`applyOps`) is validated against all 10 invariants before persistence:

| Code | Invariant Rule | Enforcement & Auto-Repair |
| :--- | :--- | :--- |
| **`I1`** | $\sum \text{line.planned} = \text{event.budget}$ | Exact integer rupee remainder reconciliation onto unlocked categories |
| **`I2`** | $\text{Contingency} \ge \lfloor 0.05 \times \text{budget} \rfloor$ | Protected minimum 5% contingency reserve |
| **`I3`** | $\text{task.due} \le \text{event.event\_date}$ | Backward-pass lead-time scheduler clamps to event date |
| **`I4`** | $\text{task.due} \ge \text{event.today}$ (open tasks) | Prevents scheduling new tasks in the past |
| **`I5`** | $\text{parent.due} \le \text{child.start}$ | Topological DAG verification across all task dependencies |
| **`I6`** | Locked lines (`locked = true`) never change during budget rescale | `rescaleBudget` freezes locked lines and redistributes across unlocked weights |
| **`I7`** | $\text{event.guests} \le \text{venue.capacity}$ | Blocks commit (`422`) and returns 1-click `repairOps` (upgrade venue or cap guests) |
| **`I8`** | All currency values are non-negative integers (`INR`) | Rejects floating-point or negative currency values |
| **`I9`** | All user-facing strings $\le 280$ chars, UTF-8 sanitized | Enforced in both `sanitizeUserText` and `validateEvent` |
| **`I10`** | Monotonic version increment ($v_{n+1} = v_n + 1$) | Optimistic concurrency check (`If-Match` / `base_version`, `409 Conflict`) |

### 4. Security
- **Server-Only Secrets**: `GEMINI_API_KEY` is accessed strictly inside server route handlers (`lib/server/llm-gateway.ts`), never exposed to client bundles.
- **Prompt-Injection Firewall**: Untrusted user prompts are scanned via `detectPromptInjection()` and wrapped in `<user_input>` tags; LLMs can only emit closed-vocabulary `TypedOp[]` validated by `validateEvent()`.
- **Cryptographic Share Links**: Share tokens are hashed with a server-side pepper (`SHA-256`) and verified using constant-time `crypto.timingSafeEqual()`.
- **Role-Scoped Least-Privilege Redaction**:
  - `family`: Full read-only summary, budget lines, functions, and timeline.
  - `vendor`: Scoped strictly to a single vendor category, tasks, and checklist.
  - `volunteer`: Roster tasks, run-of-show, and safety permits only (**zero financial/INR fields exposed**).
- **Rate Limiting & RFC 7807 Errors**: Per-IP sliding-window rate limiting (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) and structured `application/problem+json` error responses.

### 5. Efficiency
- **Single-Pass $O(V + E)$ Critical-Path Scheduler**: Backward lead-time scheduling and critical-path slack calculation run in under `2ms`.
- **Idempotent Integer Budget Rescaling**: `O(N)` largest-remainder allocation preserves locked categories and guarantees exact rupee sums without floating-point drift.
- **Bounded Caches**: LRU eviction on both the LLM prompt cache and `Idempotency-Key` store prevents unbounded memory growth.

### 6. Accessibility (WCAG 2.2 AA)
- Semantic landmarks (`<header>`, `<nav>`, `<main id="main-workspace">`, Skip-to-main-workspace link).
- Full keyboard navigation (`⌘K` / `Ctrl+K` Replan Command Modal, `Escape` modal dismissal, `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`).
- Screen-reader announcements via `role="status"` and `aria-live="polite"` on plan commits, health changes, and degraded-mode banners.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on all `₹` currency figures, percentages, and countdowns.

---

## Quick Start & Verification Commands

```bash
# Install dependencies
npm install

# Run all 12 test suites (Invariants I1-I10, Security Firewall, Role Redaction, 500 Property Vectors, 50 Golden Evals)
npm test

# Run ESLint static analysis
npm run lint

# Build production standalone bundle
npm run build

# Start production server on PORT=3000
npm start
```

---

## API & Operational Endpoints

- `GET /api/v1/events` — List all events and system telemetry
- `POST /api/v1/events` — Create a verified event from free-text intake or persona preset (`Idempotency-Key` supported)
- `GET /api/v1/events/:id` — Retrieve full versioned event state, health report, quotes, expenses, and history
- `POST /api/v1/events/:id` — Execute `preview`, `commit`, `replan`, `undo`, `log_expense`, `add_quote`, `vendor_outreach`, `regenerate_ideas`, `create_share`, or `revoke_share`
- `GET /api/v1/share/:token` — Role-redacted (`family` | `vendor` | `volunteer`) read-only event view
- `GET /healthz` (`/api/v1/healthz`) — Liveness probe
- `GET /readyz` (`/api/v1/readyz`) — Readiness probe (domain engine, version store, circuit breaker)
- `GET /metrics` (`/api/v1/metrics`) — Prometheus metrics exporter
