# Settlement Schedule Reflow Engine

Constraint-based scheduling engine that recomputes settlement task timelines when disruptions occur. Includes a visual demo playground with a Gantt-style timeline.

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
