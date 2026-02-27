# Findings from Knowledge Validation Session

Architectural insights and code review findings captured during the grilling session on the Settlement Schedule Reflow system.

---

## High-Level Service Diagram

```
 UPSTREAM (callers)                                DOWNSTREAM (consumers)

 ┌───────────────────────┐  ReflowInput            ┌─────────────────────────┐
 │ Trade Orchestration   ├──┐ {tasks,          ┌──►│ Operations Dashboard    │
 └───────────────────────┘  │  channels,       │   └─────────────────────────┘
 ┌───────────────────────┐  │  orders}         │   ┌─────────────────────────┐
 │ Channel Health        ├──┤                  ├──►│ Compliance & Audit      │
 └───────────────────────┘  │                  │   └─────────────────────────┘
 ┌───────────────────────┐  │                  │   ┌─────────────────────────┐
 │ Regulatory Config     ├──┘                  └──►│ Notification            │
 └───────────────────────┘                     ▲   └─────────────────────────┘
                            │                  │
                            ▼                  │  ReflowResult
 ┌─────────────────────────────────────────────┴──────────────────┐
 │              SETTLEMENT SCHEDULE REFLOW SERVICE                 │
 │              (this project — stateless, pure function)          │
 │                                                                 │
 │  ReflowInput ─► Phase 1 ─► Phase 2 ─► Phase 3 ─► ReflowResult │
 │                 (topo      (schedule)  (validate)               │
 │                  sort)                                          │
 └─────────────────────────────────────────────────────────────────┘
```

---

## System Structure

**Setup Phase** — Platform creates the initial schedule: trade orders spawn settlement tasks with dependencies, assigns them to channels, sets operating hours and blackout windows. Data structures: `SettlementTask`, `SettlementChannel`, `TradeOrder` (typed document wrappers).
- *Special cases:* Empty task list (short-circuits to empty result). Tasks referencing unknown channels (error recorded, task skipped but end time still tracked so downstream deps don't crash). Channels with no operating hours at all (task cannot be scheduled, error returned).
- *Exceptions:* `prepTimeMinutes` is optional — when present, effective duration = prep + processing; when absent, defaults to 0 via `?? 0`.

**Current State** — A snapshot of all tasks, channels, and orders at a point in time. Passed as `ReflowInput`. The engine never queries external state.
- *Special cases:* `structuredClone()` deep-copies the snapshot before mutation so the caller's data is never modified. All dates parsed as UTC via `{ zone: 'utc' }` — no local time ambiguity.

**Disruption** — One of 4 trigger types (late transfer, channel offline, new blackout, unplanned maintenance) invalidates the current schedule. Platform takes a fresh snapshot and calls `ReflowService.reflow()`.
- *Special cases:* The engine doesn't know *which* disruption occurred — it just receives the new snapshot and recomputes from scratch. Multiple simultaneous disruptions are handled implicitly (they're all baked into the snapshot).

**Reflow Engine:**

- **Phase 1 — DAG build + topological sort** (`dag.ts`). Builds a directed acyclic graph from `dependsOnTaskIds`. Algo: **Kahn's algorithm** (BFS-based topo sort) with cycle detection. Data structures: adjacency list (`Map<string, string[]>`), in-degree map (`Map<string, number>`), queue (array). Tie-breaks by `startDate` for deterministic ordering.
  - *Special cases:* Tasks with no dependencies (in-degree 0, scheduled first). Diamond dependencies (A→B, A→C, B→D, C→D — D waits for both B and C). Unknown dep IDs in `dependsOnTaskIds` (silently ignored in scheduling — the dep is treated as already complete).
  - *Exceptions:* Circular dependencies (A→B→A or A→B→C→A) throw `CycleError`. Caught in `ReflowService`, returns original tasks unchanged with descriptive error. Engine does NOT attempt partial scheduling.

- **Phase 2 — Greedy earliest-fit scheduling** (`scheduler.ts`). Walks topo order. For each non-pinned task: `effectiveStart = max(depsComplete, channelAvailable, nextOperatingSlot)`. Computes end date by consuming duration across operating windows. Algo: **greedy interval scheduling** with operating-hours arithmetic. Data structures: `channelNextAvailable` map, `taskEndTimes` map. Regulatory holds are pre-seeded into channel availability, never moved.
  - *Special cases:* Regulatory holds — pinned in place, never moved; validated for blackout overlap but still act as dependency sources and block their channel's time slot. Spanning tasks — a task's wall-clock range can cross overnight/weekends; it pauses at operating-hours close and resumes at next open. Split operating hours — multiple windows per day (e.g. 8-12, 13-17 with lunch gap); duration is consumed across all windows. Blackout mid-window — operating window is split around the blackout via `subtractBlackouts()` using `Interval.difference()`. Zero-duration tasks — return start time immediately. Channel contention — multiple independent tasks on the same channel are serialized via `channelNextAvailable`.
  - *Exceptions:* No operating slot found within 365 days (safety limit) — error recorded, task skipped. End date computation fails within 365 days — error recorded. Regulatory hold overlapping a blackout — error recorded (impossible constraint, can't move the hold).

- **Phase 3 — Post-reflow validation** (`constraint-checker.ts`). Proves the output is correct. Checks (in spec order): dependency ordering, channel overlaps, operating hours (duration-matching), blackout overlaps (reg holds only), regulatory hold immutability. Algo: **brute-force pairwise constraint checking**. Pure validation, no mutations.
  - *Special cases:* Operating hours validation uses duration-matching (available minutes between start/end must equal effective duration) rather than wall-clock contiguity — this correctly handles spanning tasks that pause overnight. Blackout overlap is only checked for regulatory holds — non-hold tasks legitimately span blackouts (they pause and resume). Non-hold tasks on the same channel sorted by start time for overlap detection. Tolerance of 0.5 min on duration matching to handle floating-point drift.
  - *Exceptions:* Violations are collected into an array, never thrown. The validator never retries or re-runs the scheduler (would produce the same result, risks infinite loops). `regulatory_hold_moved` compares original vs updated dates — defense-in-depth since the scheduler should never move holds.

**Outputs** — `ReflowResult` containing: updated task list, change log with reasons and deltas, human-readable explanation, metrics (delay, utilization, idle time, SLA breaches via `metrics.ts`), and error list. Consumed by Operations/Compliance teams — the engine is advisory only.
- *Special cases:* SLA breaches detected by comparing each task's actual end date against its trade order's `settlementDate`. Change reasons are multi-part strings (e.g. "dependency X completes later; channel occupied; adjusted to operating hours"). Tasks with no changes produce no change entries. Utilization can exceed 100% when regulatory holds occupy time outside operating hours.
- *Exceptions:* Scheduler errors and constraint violations are merged into a single `errors[]` array. The engine does NOT act on errors — it reports them for human review.

---

## Architectural Insights

### Scope boundary: scheduler vs business rules

The engine trusts `dependsOnTaskIds` blindly. If the platform creates a chain where `fundTransfer` runs before `complianceScreen` (sanctions check), money moves before compliance — but that's a platform bug, not our engine's responsibility. The engine is a pure scheduler, not a business rule enforcer. Capital33 should consider adding an upstream business rule validator.

### Stateless pure-function model

The engine is stateless. Each call gets a fresh snapshot and computes from scratch. No memory of previous runs. The platform handles real-world state (what's done, in-progress, broken). The engine is a pure function: snapshot in → schedule out.

### Validator reports, never retries

If post-reflow validation finds violations, they go into `errors[]`. The engine does NOT re-run the scheduler (would produce the same bug, risks infinite loops). Humans review and escalate.

### Human-in-the-loop at validation

The engine outputs a schedule + errors, but does NOT act on errors automatically. Operations and Compliance teams (diagram's "Internal Consumers") review the output, act on SLA breaches, and escalate if needed. The engine is an advisory tool, not an autonomous decision-maker.

### 4 disruption trigger types

1. Counterparty fund transfer late
2. Channel goes offline (payment rail outage, e.g. Fedwire down)
3. New blackout window declared by regulator
4. Unplanned maintenance

### Topo sort / cycle detection test coverage

Confirmed: `dag.test.ts` has 9 tests covering linear chain, diamond, circular (A→B→A and A→B→C→A), no-deps, single task, tie-breaking, unknown dep IDs. Coverage is solid.

---

## Code Review Findings

### 2a. BUG (Medium): Regulatory holds can overlap non-hold tasks on same channel

**File:** `src/reflow/scheduler.ts`
**Problem:** The scheduler processes tasks in topo order. If a regulatory hold (pinned) and a non-hold task are on the same channel with no dependency between them, the non-hold task might be placed in a slot that overlaps the hold. The hold is processed when reached in topo order, but by then the non-hold task may already occupy that time.
**Fix:** Before the main scheduling loop, pre-scan all regulatory holds and seed `channelNextAvailable` with their time ranges.

### 2b. LOW: Constraint checker validation order doesn't match spec

**File:** `src/reflow/constraint-checker.ts`
**Problem:** Spec says: Dependencies → Channel → Operating Hours → Blackouts. Code checks: Channel → Operating Hours → Blackouts → Dependencies.
**Fix:** Reorder the 4 check calls in `checkConstraints()`.

### 2c. LOW: Missing `regulatory_hold_moved` validation

**File:** `src/reflow/constraint-checker.ts`
**Problem:** The `ConstraintViolation` type includes `"regulatory_hold_moved"` but no check verifies holds weren't moved.
**Fix:** Add a check comparing original vs updated dates for regulatory hold tasks.

### 2d. LOW: Dead code — `isWithinOperatingHours` unused

**File:** `src/utils/date-utils.ts`
**Problem:** Exported but never imported in production code. Was replaced by duration-matching approach.
**Fix:** Remove it.

### 2e. SUGGESTION: Missing test coverage

- Task spanning weekend with Friday blackout
- Multiple blackouts within one operating day
- Regulatory hold as upstream dependency for a non-hold task
- Split operating hours (multiple windows per day) through full scheduler pipeline
