import React, { useMemo, useState, useRef } from "react";
import type {
  SettlementTask,
  SettlementChannel,
  TradeOrder,
  ReflowResult,
  ScheduleChange,
} from "../types";
import { createTimeScale, computeTimeBounds } from "./TimeScale";
import { TimeAxis } from "./TimeAxis";
import { SwimLanes, LANE_HEIGHT } from "./SwimLanes";
import { OperatingHoursBg } from "./OperatingHoursBg";
import { TaskBars } from "./TaskBars";
import { BlackoutOverlay } from "./BlackoutOverlay";
import { DependencyArrows } from "./DependencyArrows";
import { TaskTooltip } from "./TaskTooltip";

interface GanttChartProps {
  channels: SettlementChannel[];
  tradeOrders: TradeOrder[];
  beforeResult: ReflowResult | null;
  afterResult: ReflowResult | null;
  pixelsPerMinute: number;
  onTaskClick?: (task: SettlementTask) => void;
}

const TIME_AXIS_HEIGHT = 36;
const LEFT_PADDING = 100;

export function GanttChart({
  channels,
  tradeOrders,
  beforeResult,
  afterResult,
  pixelsPerMinute,
  onTaskClick,
}: GanttChartProps) {
  const [tooltip, setTooltip] = useState<{
    task: SettlementTask;
    pos: { x: number; y: number };
  } | null>(null);

  const allTasks = useMemo(() => {
    const tasks: SettlementTask[] = [];
    if (beforeResult) tasks.push(...beforeResult.updatedTasks);
    if (afterResult) tasks.push(...afterResult.updatedTasks);
    return tasks;
  }, [beforeResult, afterResult]);

  const bounds = useMemo(
    () => computeTimeBounds(allTasks, 30),
    [allTasks]
  );

  const scale = useMemo(
    () =>
      createTimeScale({
        startMs: bounds.startMs,
        endMs: bounds.endMs,
        pixelsPerMinute,
        leftPadding: LEFT_PADDING,
      }),
    [bounds, pixelsPerMinute]
  );

  const LEGEND_HEIGHT = 28;
  const topOffset = TIME_AXIS_HEIGHT;
  const lanesBottom = topOffset + channels.length * LANE_HEIGHT;
  const totalHeight = lanesBottom + LEGEND_HEIGHT;
  const totalWidth = scale.getTotalWidth();

  const hasAfter = afterResult !== null;
  const displayResult = afterResult ?? beforeResult;
  const changes = afterResult?.changes ?? [];

  // SLA deadline lines
  const slaLines = useMemo(() => {
    return tradeOrders.map((order) => ({
      x: scale.dateToX(order.data.settlementDate),
      label: order.data.tradeOrderNumber,
    }));
  }, [tradeOrders, scale]);

  if (!beforeResult) {
    return (
      <div className="gantt-area">
        <div className="gantt-loading">Select a scenario to begin</div>
      </div>
    );
  }

  // Check for fatal errors (circular deps)
  const hasCycleError = beforeResult.errors.some((e) =>
    e.toLowerCase().includes("circular")
  );

  if (hasCycleError && !afterResult) {
    return (
      <div className="gantt-area">
        <div className="gantt-error-banner">
          <h3>Scheduling Error</h3>
          <p>{beforeResult.errors[0]}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gantt-area">
      <svg
        className="gantt-svg"
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        <defs>
          <pattern
            id="blackout-pattern"
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="#EF4444"
              strokeWidth="2"
            />
          </pattern>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
          </marker>
        </defs>

        <OperatingHoursBg
          channels={channels}
          scale={scale}
          startMs={bounds.startMs}
          endMs={bounds.endMs}
          laneHeight={LANE_HEIGHT}
          topOffset={topOffset}
        />

        <SwimLanes
          channels={channels}
          laneHeight={LANE_HEIGHT}
          topOffset={topOffset}
          totalWidth={totalWidth}
        />

        <BlackoutOverlay
          channels={channels}
          scale={scale}
          laneHeight={LANE_HEIGHT}
          topOffset={topOffset}
        />

        <TimeAxis
          scale={scale}
          startMs={bounds.startMs}
          endMs={bounds.endMs}
          y={0}
          totalHeight={totalHeight}
        />

        {/* SLA deadline lines */}
        {slaLines.map((sla) => (
          <g key={sla.label}>
            <line
              className="sla-deadline"
              x1={sla.x}
              y1={topOffset}
              x2={sla.x}
              y2={totalHeight}
            />
            <text
              x={sla.x + 4}
              y={topOffset + 12}
              fontSize="9"
              fill="var(--danger)"
              fontWeight="600"
            >
              SLA
            </text>
          </g>
        ))}

        {/* Before bars (faded when after exists) */}
        {hasAfter && (
          <TaskBars
            tasks={beforeResult.updatedTasks}
            channels={channels}
            scale={scale}
            laneHeight={LANE_HEIGHT}
            topOffset={topOffset}
            className="task-bar-before"
          />
        )}

        {/* Main bars (after if exists, else before) */}
        <TaskBars
          tasks={displayResult!.updatedTasks}
          channels={channels}
          scale={scale}
          laneHeight={LANE_HEIGHT}
          topOffset={topOffset}
          className={hasAfter ? "task-bar-after" : ""}
          onHover={(task, rect) =>
            setTooltip({ task, pos: { x: rect.right, y: rect.top } })
          }
          onLeave={() => setTooltip(null)}
          onClick={onTaskClick}
        />

        {/* Dependency arrows on the displayed result */}
        <DependencyArrows
          tasks={displayResult!.updatedTasks}
          channels={channels}
          scale={scale}
          laneHeight={LANE_HEIGHT}
          topOffset={topOffset}
        />

        {/* Delay indicators */}
        {hasAfter &&
          changes
            .filter((c) => c.field === "startDate" && c.deltaMinutes > 0)
            .map((c) => {
              const task = afterResult!.updatedTasks.find(
                (t) => t.docId === c.taskId
              );
              if (!task) return null;
              const lane = channels.findIndex(
                (ch) => ch.docId === task.data.settlementChannelId
              );
              if (lane < 0) return null;
              const x = scale.dateToX(task.data.startDate);
              const y = topOffset + lane * LANE_HEIGHT + 14;
              return (
                <text
                  key={`delay-${c.taskId}`}
                  className="delay-indicator"
                  x={x}
                  y={y}
                >
                  +{c.deltaMinutes}m
                </text>
              );
            })}

        {/* Legend */}
        <g className="gantt-legend" transform={`translate(${LEFT_PADDING}, ${lanesBottom + 6})`}>
          {/* Operating hours */}
          <rect x={0} y={2} width={14} height={10} rx={1} fill="transparent" stroke="#cbd5e1" strokeWidth={0.5} />
          <text x={18} y={11} className="legend-label">Operating</text>

          {/* Off-hours */}
          <rect x={90} y={2} width={14} height={10} rx={1} className="off-hours-bg" />
          <text x={108} y={11} className="legend-label">Off-Hours</text>

          {/* Closed day */}
          <rect x={180} y={2} width={14} height={10} rx={1} className="closed-day-bg" />
          <text x={198} y={11} className="legend-label">Closed Day</text>

          {/* Blackout */}
          <rect x={280} y={2} width={14} height={10} rx={1} className="blackout-bg" />
          <rect x={280} y={2} width={14} height={10} rx={1} fill="url(#blackout-pattern)" opacity={0.6} />
          <text x={298} y={11} className="legend-label">Blackout</text>

          {/* SLA */}
          <line x1={370} y1={1} x2={370} y2={13} className="sla-deadline" />
          <text x={376} y={11} className="legend-label">SLA Deadline</text>
        </g>
      </svg>
      {tooltip && (
        <TaskTooltip
          task={tooltip.task}
          position={tooltip.pos}
          changes={changes}
        />
      )}
    </div>
  );
}
