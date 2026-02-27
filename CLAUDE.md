# Settlement Schedule Reflow Engine

## Project Overview

A constraint-based scheduling engine that recomputes settlement task timelines when disruptions occur. Takes a snapshot of settlement tasks, channels, and trade orders, then produces a valid schedule respecting dependencies, channel capacity, operating hours, and blackout windows.

Includes a **visual web client** (demo playground) with a Gantt-style timeline. See [DEMO-PLAYGROUND.md](./DEMO-PLAYGROUND.md) for full client/server specs.

## Quick Start

```bash
npm install                                       # install all workspaces
npm test                                          # run all 98 engine tests
npm run start --workspace=@reflow/engine          # run CLI demo scenarios
npm run dev:server                                # Express API on :3001
npm run dev:playground                            # Webpack dev server on :5173
npm run dev                                       # both server + playground
npm run build --workspaces --if-present           # production builds
```

## Tech Stack

- **Node 18.20.8** / npm 10.8.2
- **TypeScript 5.9.3** — strict mode, ES modules
- **Luxon 3.7.2** — all date/time manipulation (always UTC)
- **Vitest 2.1.9** — test runner (pinned; v3+ requires Node 20)
- **tsx 4.21.0** — run TS directly
- **esbuild 0.17.19** — pinned via npm overrides (newer versions incompatible with macOS Big Sur)
- **Express 4.21.2** — HTTP API server
- **React 18.3.1** — demo playground UI
- **webpack 5.97.1** — bundler (no esbuild dependency, Vite incompatible with esbuild pin)

## Monorepo Structure

npm workspaces monorepo with three packages:

```
/                                    # Monorepo root
├── package.json                     # Workspaces config ["packages/*"], shared scripts
├── tsconfig.base.json               # Shared TS config (strict, ES2022)
├── CLAUDE.md                        # This file
├── DEMO-PLAYGROUND.md               # Visual web client specs (see separate doc)
├── planning/                        # Planning docs (stays at root)
│
├── packages/
│   ├── engine/                      # @reflow/engine — core scheduling engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── reflow/
│   │       │   ├── types.ts                 # All interfaces
│   │       │   ├── reflow.service.ts        # ReflowService — main orchestrator
│   │       │   ├── dag.ts                   # DAG build, topo sort, cycle detection
│   │       │   ├── scheduler.ts             # Core scheduling loop
│   │       │   ├── constraint-checker.ts    # Post-reflow validation
│   │       │   └── metrics.ts               # Delay, utilization, SLA breach
│   │       ├── utils/
│   │       │   └── date-utils.ts            # Operating hours engine
│   │       ├── data/                        # Scenario data files
│   │       ├── main.ts                      # CLI entry
│   │       └── __tests__/                   # All 98 engine tests
│   │
│   ├── server/                      # @reflow/server — HTTP API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts             # Express server (:3001)
│   │       ├── routes/
│   │       │   ├── reflow.ts        # POST /api/reflow
│   │       │   └── scenarios.ts     # GET /api/scenarios
│   │       └── middleware/
│   │           └── cors.ts
│   │
│   └── demo-playground/             # @reflow/demo-playground — visual web client
│       ├── package.json
│       ├── tsconfig.json
│       ├── webpack.config.js        # webpack 5 (CJS config)
│       ├── public/index.html
│       └── src/                     # React + SVG Gantt chart
│           ├── index.tsx
│           ├── App.tsx
│           ├── types.ts
│           ├── api.ts
│           ├── hooks/
│           ├── components/
│           ├── gantt/
│           └── styles/
```

## Architecture

### Engine Algorithm

Topological sort (Kahn's) → greedy earliest-fit scheduling → post-reflow validation.

`ReflowService.reflow()` orchestrates:
1. **DAG build + topo sort** (`dag.ts`) — cycle detection, tie-break by startDate
2. **Scheduling loop** (`scheduler.ts`) — `effectiveStart = max(depsComplete, channelAvailable, nextOperatingSlot)`
3. **End date computation** (`date-utils.ts`) — consumes duration across operating windows, skipping blackouts
4. **Constraint validation** (`constraint-checker.ts`) — proves the output schedule is correct
5. **Metrics** (`metrics.ts`) — delay, utilization, idle time, SLA breach detection

### Client-Server Architecture

```
Browser (React + SVG) ──[fetch]──→ Express Server ──[import]──→ Engine
:5173                              :3001                        @reflow/engine
```

The demo playground calls the server API; it does not import the engine directly. See [DEMO-PLAYGROUND.md](./DEMO-PLAYGROUND.md) for full details including UI layout, Gantt chart design, color scheme, interactions, and data flow.

### Server API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/scenarios` | List preset scenarios |
| `GET` | `/api/scenarios/:key` | Full `ReflowInput` for a scenario |
| `POST` | `/api/reflow` | Run engine, returns `ReflowResult` |

## Key Design Decisions

1. **All dates UTC** — `DateTime.fromISO(str, { zone: 'utc' })` everywhere. Never local time.
2. **Operating hours are recurring weekly patterns** — converted to concrete windows per-day, then blackouts subtracted.
3. **Regulatory holds are pinned** — never moved, but validated (blackout overlap → error). Still act as dependency sources.
4. **Prep time** — `effectiveDuration = (prepTimeMinutes ?? 0) + durationMinutes`. Both phases consume operating hours.
5. **Constraint check order** — Dependencies → Channel Conflicts → Operating Hours → Blackout Windows.
6. **Spanning tasks are valid** — a task's wall-clock range can span overnight/weekends; it pauses at close and resumes at open.
7. **Monorepo with npm workspaces** — engine, server, and client are separate packages. Engine exports via package.json `exports` field.
8. **webpack over Vite** — Vite requires esbuild ≥0.18 which doesn't support macOS Big Sur. webpack 5 + ts-loader has no esbuild dependency.
9. **All dependency versions pinned exact** — no `^` or `~` to prevent breakage on this constrained environment.

## Coding Conventions

- ES module imports with `.js` extensions (TypeScript moduleResolution: bundler)
- `structuredClone()` for deep copies (Node 18 native)
- No classes except `ReflowService` and `CycleError` — prefer pure functions
- Test files co-located in `packages/engine/src/__tests__/`, one per module + integration + edge cases
- Scenario data files export typed `ReflowInput` objects
- React components use functional style with hooks
- SVG Gantt chart rendered as React components (no external charting library)
- webpack config is CJS (webpack-cli requires it)
- Client types mirror engine types (no shared package — keeps client independent)

## Tests

98 tests across 7 files in `packages/engine/`:

| File | Tests | What it covers |
|---|---|---|
| `date-utils.test.ts` | 32 | Operating hours, blackouts, spanning, boundaries, zero-duration |
| `dag.test.ts` | 9 | Linear chain, diamond, circular detection, no-deps, tie-breaking |
| `scheduler.test.ts` | 10 | Dependencies, channel conflicts, prep time, regulatory holds, cascading |
| `constraint-checker.test.ts` | 9 | Overlaps, operating hours, blackouts, dependency violations |
| `metrics.test.ts` | 6 | Delay calc, utilization, idle time, SLA breach detection |
| `reflow.integration.test.ts` | 22 | All 7 scenarios end-to-end with constraint validation |
| `edge-cases.test.ts` | 10 | Empty input, circular deps, all-holds, cross-channel deps, no operating hours |

## Scenarios

1. **Delay Cascade** — fund transfer 3h late → entire chain shifts
2. **Market Hours + Blackout** — 120-min task at Mon 3PM, Tue 8-9AM blackout → completes Tue 10AM
3. **Multi-Constraint** — deps + channel conflict + blackout simultaneously
4. **Channel Contention** — 3 independent tasks compete for one channel
5. **Impossible** — 5a: circular deps, 5b: reg hold in blackout, 5c: SLA breach from cascading delays
