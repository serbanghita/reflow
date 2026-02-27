# Settlement Schedule Reflow Engine

A constraint-based scheduling engine that recomputes settlement task timelines when disruptions occur. Takes a snapshot of settlement tasks, channels, and trade orders, then produces a valid schedule respecting dependencies, channel capacity, operating hours, and blackout windows.

Includes a visual demo playground with a Gantt-style timeline for simulating disruptions and observing the reflow in action.

## Prerequisites

- **Node 18.20.8** / npm 10.8.2

## Install

```bash
npm install
```

## Running the Engine (standalone)

Run all built-in scenarios from the CLI:

```bash
npm start
```

This executes the engine against each scenario (delay cascade, blackout, multi-constraint, channel contention, impossible cases) and prints the scheduled results.

### Tests

Run the full test suite (98 tests):

```bash
npm test
```

Watch mode:

```bash
npm run test:watch --workspace=@reflow/engine
```

## Running the Demo Playground

The demo playground is a visual web client with a Gantt chart where you can select scenarios, apply disruptions (delay tasks), and see the reflow engine reschedule in real time.

### Start both server and playground:

```bash
npm run dev
```

This starts:
- **Express API server** on `http://localhost:3001`
- **Webpack dev server** (React UI) on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

### Start individually:

```bash
# API server only
npm run dev:server

# Playground UI only (requires server running)
npm run dev:playground
```

### Production build:

```bash
npm run build
```

## Project Structure

```
packages/
  engine/           Core scheduling engine (TypeScript, Luxon)
  server/           Express HTTP API wrapping the engine
  demo-playground/  React + SVG Gantt chart UI
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/scenarios` | List preset scenarios |
| `GET` | `/api/scenarios/:key` | Full input for a scenario |
| `POST` | `/api/reflow` | Run engine, returns scheduled result |
