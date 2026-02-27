# Demo Playground — Visual Web Client

Interactive Gantt-style web UI for the Settlement Schedule Reflow Engine.

## Quick Start

```bash
# Terminal 1: Start the API server
npm run dev:server        # Express on http://localhost:3001

# Terminal 2: Start the web client
npm run dev:playground    # Webpack dev server on http://localhost:5173
```

Or run both together: `npm run dev`

## Architecture

```
Browser (React + SVG) ──[fetch]──→ Express Server ──[import]──→ Engine
:5173                              :3001                        @reflow/engine
```

The demo playground is a **read-only visualization** — it calls the server to run the reflow engine and renders the results. It does NOT import the engine directly; all communication is via HTTP.

## Package: `@reflow/demo-playground`

### Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | Component-based UI |
| webpack | 5.97.1 | Bundler (no esbuild dependency, Node 18 compatible) |
| ts-loader | 9.5.1 | TypeScript compilation |
| css-loader + style-loader | 7.1.2 / 4.0.0 | CSS injection |
| html-webpack-plugin | 5.6.3 | HTML template |

### Why webpack (not Vite)?

Vite 4+ requires esbuild ≥0.18, which does not ship binaries for macOS Big Sur (Darwin 20.6.0). webpack 5 uses ts-loader (tsc) for TypeScript and has no esbuild dependency.

### File Structure

```
packages/demo-playground/
├── package.json
├── tsconfig.json
├── webpack.config.js        # CJS config — dev server + production build
├── public/
│   └── index.html
└── src/
    ├── index.tsx             # React entry: createRoot, render <App />
    ├── App.tsx               # Top-level layout (header, sidebar, gantt, bottom)
    ├── types.ts              # Client-side type mirrors of engine types
    ├── api.ts                # HTTP client for /api/* endpoints
    ├── hooks/
    │   ├── useReflow.ts      # Manages before/after reflow API calls + state
    │   └── useScenarios.ts   # Fetches scenario list + selection
    ├── components/
    │   ├── Header.tsx         # Title bar + zoom/fit controls
    │   ├── Sidebar.tsx        # Scenario picker + disruption + data inspector
    │   ├── ScenarioPicker.tsx # Dropdown + description
    │   ├── DisruptionPanel.tsx# Delay controls, Apply & Reflow button
    │   ├── BottomPanel.tsx    # Tabbed panel container
    │   ├── MetricsTab.tsx     # Delay, utilization, SLA breaches
    │   ├── ChangesTab.tsx     # Change log table
    │   ├── ExplanationTab.tsx # Human-readable narrative
    │   ├── ErrorsTab.tsx      # Error display with tab badge
    │   ├── TaskEditor.tsx     # Expandable task property tree
    │   ├── ChannelEditor.tsx  # Channel operating hours / blackout tree
    │   └── OrderEditor.tsx    # Trade order tree
    ├── gantt/
    │   ├── GanttChart.tsx     # Orchestrates full Gantt SVG render
    │   ├── TimeScale.ts       # DateTime ↔ pixel conversion (pure util)
    │   ├── TimeAxis.tsx       # Hour/day labels and gridlines
    │   ├── SwimLanes.tsx      # Channel row backgrounds
    │   ├── TaskBars.tsx       # Task rectangle components
    │   ├── DependencyArrows.tsx # Arrow rendering between tasks
    │   ├── BlackoutOverlay.tsx# Blackout hatching rectangles
    │   ├── OperatingHoursBg.tsx # Gray non-operating time backgrounds
    │   ├── TaskTooltip.tsx    # Hover popover for task details
    │   └── colors.ts         # Task type → color mapping
    └── styles/
        ├── main.css           # Global layout, CSS variables, scrollbar
        ├── gantt.css          # SVG Gantt chart styles, transitions
        ├── panels.css         # Bottom panel tabs, metrics, tables
        └── forms.css          # Header, sidebar, forms, tooltip
```

## UI Layout

```
+------------------------------------------------------------------+
|  HEADER: "Settlement Schedule Reflow Engine"   [Zoom -][+] [Fit] |
+------------------+-----------------------------------------------+
|  LEFT SIDEBAR    |  MAIN: GANTT CHART (SVG)                      |
|  (320px fixed)   |                                                |
| [Scenario ▼    ] |  SWIFT    |▓▓Task1▓▓▓|→|▓▓Task2▓▓|           |
|  Description...  |           |  ///blackout///                    |
|                  |  Fedwire  |      |▓▓▓Task3▓▓▓▓|               |
| ── Disruption ── |           |                                    |
| Delay task: [▼]  |  ACH      |  |▓Task4▓|  |▓Task5▓|            |
| By mins:  [180]  |           |                                    |
| [Apply & Reflow] |  ──────── time axis ────────────               |
|                  |  8AM  9AM  10AM  11AM  12PM  1PM ...           |
| ── Tasks ──────  |                                                |
| ▸ STL-001 fund   |                                                |
| ▸ STL-002 margin |                                                |
| ── Channels ──── |                                                |
| ▸ SWIFT 8-16 M-F |                                                |
+------------------+-----------------------------------------------+
|  BOTTOM PANEL (220px, tabbed)                                     |
|  [Metrics] [Changes] [Explanation] [Errors]                       |
|  ┌─────────────────────────────────────────────────────────────┐  |
|  │ Total Delay: 180 min | Affected: 3 | SWIFT util: 72%       │  |
|  │ SLA Breaches: 1 (STL-003 +45min past deadline)              │  |
|  └─────────────────────────────────────────────────────────────┘  |
+------------------------------------------------------------------+
```

## Gantt Chart

### Visual Elements

- **Operating hours:** White = operating, gray = non-operating
- **Blackout windows:** Diagonal red hatching via SVG `<pattern>`
- **Task bars:** Rounded `<rect>`, color-coded by type:
  - `fundTransfer`: blue (#3B82F6)
  - `marginCheck`: amber (#F59E0B)
  - `disbursement`: green (#10B981)
  - `complianceScreen`: purple (#8B5CF6)
  - `reconciliation`: indigo (#6366F1)
  - `regulatoryHold`: red (#EF4444) with lock icon
- **Before/After:** "Before" bars at 30% opacity with dashed stroke; "After" at full opacity
- **Dependency arrows:** SVG `<path>` with arrowhead markers
- **SLA deadline:** Vertical dashed red line
- **Delay indicators:** Red "+180m" labels above shifted tasks

### Interactions

- Hover task → tooltip with details (reference, type, duration, channel, delay)
- Click task → highlight in sidebar, expand in task tree
- Zoom slider → changes pixels-per-minute
- Fit button → reset zoom to default

### Before/After Animation

1. "Before" bars fade to 30% opacity (CSS transition, 300ms)
2. "After" bars render at their new positions
3. Dependency arrows redraw with fade-in animation
4. Metrics panel highlights changed values

## Data Flow

```
User selects scenario
  → GET /api/scenarios/:key → ReflowInput
  → POST /api/reflow (original input) → "before" schedule
  → Gantt renders before schedule

User applies disruption
  → Client clones input, shifts task start/end by N minutes
  → POST /api/reflow (modified input) → "after" schedule
  → Gantt renders before (faded) + after (solid) overlay
  → Bottom panel shows metrics, changes, explanation
```

## Error Handling

- **Circular deps (5a):** Error banner across Gantt area, Errors tab shows cycle
- **Reg hold conflict (5b):** Tasks rendered, error reported in Errors tab with badge
- **SLA breach (5c):** Normal render with SLA deadline line, breach in Metrics tab

## Package: `@reflow/server`

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/scenarios` | List preset scenarios (key, name, description) |
| `GET` | `/api/scenarios/:key` | Full `ReflowInput` for a scenario |
| `POST` | `/api/reflow` | Run engine, returns `ReflowResult` |

### Scenario Keys

| Key | Name |
|---|---|
| `delay-cascade` | Scenario 1: Delay Cascade |
| `blackout` | Scenario 2: Market Hours + Blackout |
| `multi-constraint` | Scenario 3: Multi-Constraint |
| `channel-contention` | Scenario 4: Channel Contention |
| `circular-dependency` | Scenario 5a: Circular Dependency |
| `regulatory-hold-conflict` | Scenario 5b: Regulatory Hold Conflict |
| `deadline-breach` | Scenario 5c: Deadline Breach (SLA) |

### Server File Structure

```
packages/server/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Express server (port 3001)
    ├── routes/
    │   ├── reflow.ts         # POST /api/reflow
    │   └── scenarios.ts      # GET /api/scenarios
    └── middleware/
        └── cors.ts           # CORS for localhost dev
```

## Dark Theme

The UI uses a dark theme with CSS custom properties. Key variables are in `styles/main.css`:

- `--bg-primary`: #0f172a (darkest)
- `--bg-secondary`: #1e293b
- `--bg-tertiary`: #334155
- `--accent`: #3b82f6 (blue)
- `--danger`: #ef4444 (red)
- `--warning`: #f59e0b (amber)
- `--success`: #10b981 (green)
