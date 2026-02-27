# Settlement Schedule Reflow — Implementation Plan

**Iteration 2** — Revised plan that fixes all gaps found in Iteration 1 analysis. All "bonus" features are in-scope. Tests are co-located with each phase (TDD).

> Iteration 1 (`PLAN1.md`) had tests deferred to Phase 7, only 60 min for the date engine, 4 scenarios, and missed the recurring-weekly → concrete-window conversion for operating hours.

**Constraint:** Node 18.20.8 / npm 10.8.2 (no Docker).

---

## Architecture Overview

**Problem:** Constraint-based scheduling — topological sort + interval scheduling with operating-hour-aware duration calculation.

**System flow:** See `settlement-reflow-diagram.mermaid` for the full Mermaid diagram covering the setup phase, disruption trigger, reflow engine internals (DAG → scheduling → validation → metrics), outputs, and consumers.

**Algorithm:**
1. Build a DAG from `dependsOnTaskIds`, detect cycles (Kahn's)
2. Topological sort — tie-break by original `startDate`
3. Pin regulatory hold tasks (do not move, but validate they don't violate blackouts)
4. For each non-pinned task in topo order: `effectiveStart = max(allDepsCompleted, channelNextAvailable, nextOperatingSlot)`
5. Compute end date accounting for operating hours and blackouts (the hard part)
6. Emit result: `{ updatedTasks, changes, explanation, metrics }`

---

## Environment & Dependencies

| Package | Version | Why |
|---|---|---|
| `typescript` | `^5.5` | Type safety |
| `luxon` | `^3` | Date manipulation (spec-recommended) |
| `vitest` | `2.1.9` | Test runner (pinned — v3+ requires Node 20) |
| `tsx` | `^4` | Run TS directly |
| `esbuild` | `0.17.19` | Pinned via npm overrides (newer versions incompatible with macOS 11) |

---

## Data Types — Exact Spec Conformance

All types use the `{ docId, docType, data }` wrapper from the PDF (p.4-6).

```ts
// Base document wrapper
interface Document<T extends string, D> {
  docId: string;
  docType: T;
  data: D;
}

// Settlement Task (p.4-5)
interface SettlementTaskData {
  taskReference: string;
  tradeOrderId: string;
  settlementChannelId: string;
  startDate: string;                // ISO 8601, UTC
  endDate: string;                  // ISO 8601, UTC
  durationMinutes: number;
  isRegulatoryHold: boolean;
  dependsOnTaskIds: string[];
  taskType: "marginCheck" | "fundTransfer" | "disbursement"
          | "complianceScreen" | "reconciliation" | "regulatoryHold";
  prepTimeMinutes?: number;
}

// Settlement Channel (p.5) — recurring weekly + absolute blackouts
interface OperatingHourSlot { dayOfWeek: number; startHour: number; endHour: number; }
interface BlackoutWindow { startDate: string; endDate: string; reason?: string; }
interface SettlementChannelData {
  name: string;
  operatingHours: OperatingHourSlot[];
  blackoutWindows: BlackoutWindow[];
}

// Trade Order (p.6) — needed for SLA breach detection
interface TradeOrderData {
  tradeOrderNumber: string;
  instrumentId: string;
  quantity: number;
  settlementDate: string;
}
```

### Output Interfaces

```ts
interface ScheduleChange {
  taskId: string; taskReference: string;
  field: "startDate" | "endDate";
  oldValue: string; newValue: string;
  deltaMinutes: number; reason: string;
}

interface ReflowMetrics {
  totalDelayMinutes: number;
  tasksAffected: number;
  channelUtilization: Record<string, number>;
  channelIdleMinutes: Record<string, number>;
  slaBreaches: Array<{ taskId: string; tradeOrderId: string;
    targetDate: string; actualEndDate: string; breachMinutes: number; }>;
}

interface ReflowResult {
  updatedTasks: SettlementTask[];
  changes: ScheduleChange[];
  explanation: string[];
  metrics: ReflowMetrics;
  errors: string[];
}
```

### API Shape (spec p.11)

```ts
class ReflowService {
  reflow(input: {
    settlementTasks: SettlementTask[];
    settlementChannels: SettlementChannel[];
    tradeOrders: TradeOrder[];
  }): ReflowResult;
}
```

---

## Key Design Decisions

### 1. All Dates in UTC
Luxon: always `DateTime.fromISO(str, { zone: 'utc' })`. Never local time.

### 2. Operating Hours: Recurring Weekly → Concrete Windows
`operatingHours` is a **recurring weekly pattern** (dayOfWeek + hours). The date engine:
1. Accepts a start datetime and duration
2. Enumerates concrete operating windows day-by-day from the start date
3. Subtracts blackout overlaps from each concrete window
4. Consumes remaining duration across windows until fulfilled

This is the conversion step Iteration 1 missed.

### 3. Regulatory Hold Tasks
- **Pinned** — never moved during scheduling
- **Validated** — if a pinned task overlaps a blackout, report as error in `result.errors`
- Still act as dependency sources for downstream tasks

### 4. Prep Time
`effectiveDuration = (prepTimeMinutes ?? 0) + durationMinutes`. Both phases count as working time within operating hours.

### 5. Channel Conflicts — Greedy Earliest-Fit
Per channel, maintain `nextAvailable` timestamp. Single-pass, O(V+E) for DAG + O(V * W) for scheduling.

### 6. Constraint Checking Order
Dependencies → Channel Conflicts → Operating Hours → Blackout Windows (matches spec p.10).

### 7. Spanning Tasks
A task's wall-clock range can span overnight/weekends — it pauses at close and resumes at open. The constraint checker validates via duration-matching against available operating minutes, not wall-clock contiguity.

---

## Project Structure

```
src/
├── reflow/
│   ├── types.ts                 # All interfaces (verbatim from spec)
│   ├── reflow.service.ts        # ReflowService class — entry point
│   ├── dag.ts                   # DAG build, Kahn's topo sort, cycle detection
│   ├── scheduler.ts             # Core scheduling loop (greedy algorithm)
│   ├── constraint-checker.ts    # Post-reflow validation (proves correctness)
│   └── metrics.ts               # Delay, utilization, idle time, SLA breach
├── utils/
│   └── date-utils.ts            # Operating hours engine (the hard part)
├── data/
│   ├── scenario-delay-cascade.ts
│   ├── scenario-blackout.ts
│   ├── scenario-multi-constraint.ts
│   ├── scenario-channel-contention.ts
│   └── scenario-impossible.ts   # 5a circular, 5b reg hold conflict, 5c SLA breach
├── main.ts                      # Runs all scenarios, prints formatted output
└── __tests__/
    ├── date-utils.test.ts       # 33 tests — operating hours, blackouts, spanning
    ├── dag.test.ts              # 9 tests — linear, diamond, circular, tie-break
    ├── scheduler.test.ts        # 9 tests — deps, channel conflicts, prep time, cascading
    ├── constraint-checker.test.ts  # 7 tests — overlaps, op hours, blackouts, deps
    ├── metrics.test.ts          # 6 tests — delay, utilization, SLA breach
    ├── reflow.integration.test.ts  # 22 tests — all scenarios end-to-end
    └── edge-cases.test.ts       # 8 tests — empty input, circular deps, cross-channel
```

---

## Scenarios (5 total, 7 sub-scenarios)

### Scenario 1: Delay Cascade (Required)
Fund transfer 3h late → margin check, disbursement, reconciliation all shift. Single channel dependency chain.

### Scenario 2: Market Hours + Blackout (Required)
120-min task starts Mon 3PM, channel Mon-Fri 8-4PM, Tue 8-9AM Fedwire blackout. Pauses at 4PM → skips blackout → completes Tue 10AM.

### Scenario 3: Multi-Constraint (Bonus)
Two tasks on same channel, upstream dep completes during blackout. Tests deps + channel conflict + operating hours + blackout simultaneously.

### Scenario 4: Channel Contention (Bonus)
3 independent tasks compete for one channel. Tests greedy scheduling quality and tie-breaking.

### Scenario 5: Impossible Schedule (Bonus)
- **5a:** Circular dependency → error before scheduling
- **5b:** Regulatory hold overlaps blackout → error reported
- **5c:** Cascading delays breach T+1 SLA → flagged in metrics

---

## Phased Execution Plan

| Phase | What | Deliverable |
|---|---|---|
| **1. Scaffold** | `npm init`, TS config, vitest config, `types.ts` | Compiling project with all types |
| **2. Date Engine + Tests** | `date-utils.ts` + `date-utils.test.ts` (TDD) | 33 date-utils tests green |
| **3. DAG + Tests** | `dag.ts` + `dag.test.ts` | 9 dag tests green |
| **4. Scheduler + Tests** | `scheduler.ts` + `scheduler.test.ts` | 9 scheduler tests green |
| **5. Constraint Checker + Tests** | `constraint-checker.ts` + `constraint-checker.test.ts` | 7 constraint tests green |
| **6. Metrics + Tests** | `metrics.ts` + `metrics.test.ts` | 6 metric tests green |
| **7. ReflowService + Scenarios** | `reflow.service.ts`, all scenario data files, `reflow.integration.test.ts` | 22 integration tests green |
| **8. Polish + Edge Cases** | `edge-cases.test.ts`, `main.ts` with formatted output | 8 edge case tests green, runnable demo |
| **9. Docs** | CLAUDE.md, PLAN.md, README if needed | Complete docs |

**Key changes from Iteration 1:**
- Tests co-located with each phase, not deferred to Phase 7
- Date engine gets dedicated focus (was 60 min, proved to be the crux)
- Metrics built before ReflowService (service depends on metrics)
- 7 sub-scenarios instead of 4
- Constraint checker handles spanning tasks correctly (duration-matching, not wall-clock)

---

## Test Strategy

94 tests total across 7 files. Tests are executable documentation.

**Unit tests** verify each module in isolation:
- `date-utils.test.ts` (33) — single window, overnight, weekend, blackout mid-window, boundary, zero-duration
- `dag.test.ts` (9) — linear chain, diamond, circular, no-deps, tie-breaking, unknown deps
- `scheduler.test.ts` (9) — single task, deps, channel conflict, prep time, reg holds, cascading
- `constraint-checker.test.ts` (7) — valid schedule, overlap, outside hours, blackout (reg hold), dep violation
- `metrics.test.ts` (6) — delay, zero delay, utilization, idle time, SLA breach

**Integration tests** run full scenarios end-to-end:
- `reflow.integration.test.ts` (22) — all 7 sub-scenarios, constraint validation on output

**Edge case tests** cover boundary conditions:
- `edge-cases.test.ts` (8) — empty input, single task, circular deps, all-holds, no operating hours, cross-channel deps, boundary times

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Date engine bugs | TDD — wrote tests first. Started with spec's exact example (120 min, Mon 3PM, 8-4 window) |
| Node 18 compat | Pinned `vitest@2.1.9`, `esbuild@0.17.19` via npm overrides |
| Constraint checker false positives | Spanning tasks use duration-matching, not wall-clock contiguity |
| Metrics complexity | Pure functions over before/after data — implemented after core correctness proven |

---

## Iteration History

| Iteration | Key Changes |
|---|---|
| **1** (PLAN1.md) | Initial plan. Tests deferred to Phase 7. 60 min for date engine. 4 scenarios. Missed recurring→concrete operating hours conversion. Wall-clock constraint checking. |
| **2** (this file) | TDD — tests with each phase. Date engine gets full focus. 7 sub-scenarios. Duration-matching constraint validation. Metrics before service. esbuild pinned for Node 18/macOS compat. |
