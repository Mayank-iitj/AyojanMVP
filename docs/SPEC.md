# Aayojan — Master Build Spec (v1.0)

Single source of truth: PRD, UX, API, system design, reliability, testing, and coding-agent specification.
Owner: Mayank Sharma

## 1. Core Concept & Invariants (I1–I10)
The Event is one JSON document, versioned. Every mutation produces a new immutable version. Invariants enforced by `validate()` before any write:
- **I1**: Budget lines sum exactly to total budget (integer rupees).
- **I2**: Contingency >= 5% of total budget.
- **I3**: Every open task due date lies between `today` and `event_date` (completed tasks exempt from the past-date rule).
- **I4**: Every dependency id exists and the dependency graph is acyclic.
- **I5**: A dependency never finishes after its dependent starts (`dep.due <= task.start`).
- **I6**: Locked budget lines are never changed by automatic rebalancing.
- **I7**: Venue capacity >= guest count where the venue declares capacity.
- **I8**: Every task category exists in the event-type template.
- **I9**: Version number increases by exactly 1 and the parent version exists.
- **I10**: All text fields are length-bounded and sanitized (no raw HTML/scripts).

## 2. Closed Operation Vocabulary
`SetBudget(total)`, `SetGuests(n, function?)`, `SetDate(date)`, `SetCity(city)`, `SetTier(tier)`, `LockLine(category)`, `UnlockLine(category)`, `SetLine(category, amount)`, `CancelVendor(category, name?)`, `SelectVendor(category, name, quote?, capacity?)`, `AddTask(...)`, `RemoveTask(id)`, `MoveTask(id, due)`, `AssignTask(id, owner)`, `SetStatus(id, status)`, `AddFunction(...)`, `RemoveFunction(name)`, `SetIdeas(section, content)`.
