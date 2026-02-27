# Settlement Schedule Reflow Engine

Constraint-based scheduling engine that recomputes settlement task timelines when disruptions occur. Includes a visual demo playground with a Gantt-style timeline.

## 6h timebox
- did not review for all TS/JS best practices
- was mostly concerned with understanding the problem, requirements, exceptions, limits
- git history is probably messy
- worked in parallel with Claude Code to plan (used 3 parallel plans). Used Claude's planning as opposed to my slower planning approach.
- algo review done in the Web UI (10:30 AM)
- actors, plan understanding, flow done in the Web UI (10 AM)
- put the Loom video on 2x

## Setup

Requires **Node 18.20.8** / npm 10.8.2.

```bash
npm install
```

## Engine (standalone)

```bash
npm start          # run all scenarios
npm test           # run 98 tests
```

## Demo Playground

```bash
npm run dev        # starts API server (:3001) + UI (:5173)
```

Open http://localhost:5173 — select a scenario, apply disruptions, and watch the reflow.
