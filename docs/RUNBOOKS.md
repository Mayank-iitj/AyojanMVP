# Production Runbooks (`RUNBOOKS.md`)

## 1. LLM Outage / High Latency / Quota Exhaustion
- **Symptoms**: `/status` shows Circuit Breaker `OPEN` or degraded banner `"Smart suggestions are limited right now; your plan is safe"` appears.
- **Automated Mitigation**: Circuit breaker trips after 5 failures within 30s and routes Intake, Replan, Vendor Outreach, and Ideas requests to the deterministic Template Engine.
- **Manual Action**: Toggle **Template-Only Mode (Kill Switch)** in the top bar or set `TEMPLATE_ONLY_MODE=true`. Verify `/api/v1/healthz` and `/status`.

## 2. Validator Failure Spike (`I1`–`I10`)
- **Symptoms**: Increase in 422 RFC 7807 responses with invariant codes.
- **Diagnosis**: Inspect `/status` Invariant Telemetry table to identify which invariant code (`I1`–`I10`) is rejecting operations.
- **Resolution**: Confirm locked budget lines or venue capacities are not conflicting with user instructions; use the interactive Repair suggestion in the Replan modal.

## 3. Stale Version Conflict (`409 Conflict`)
- **Symptoms**: Collaborator receives HTTP 409 on `POST /api/v1/events/{id}/commit`.
- **Resolution**: Client automatically fetches the latest `current_version` and rebases the pending typed operations onto the latest state.

## 4. Share Token Compromise
- **Symptoms**: Unauthorized access on `/s/{token}`.
- **Resolution**: Open **Share & Export** -> click **Revoke** next to the active role link (`DELETE /api/v1/events/{id}/share/{linkId}`). Token hash is immediately marked `revoked_at = now()`.
