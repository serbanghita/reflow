import React from "react";
import type { SettlementTask, SettlementChannel, OperatingHourSlot, BlackoutWindow } from "../types";
import type { TimeScale } from "./TimeScale";
import { getTaskColor } from "./colors";

interface TaskBarsProps {
  tasks: SettlementTask[];
  channels: SettlementChannel[];
  scale: TimeScale;
  laneHeight: number;
  topOffset: number;
  className?: string;
  onHover?: (task: SettlementTask, rect: DOMRect) => void;
  onLeave?: () => void;
  onClick?: (task: SettlementTask) => void;
}

interface TaskSegment { startMs: number; endMs: number; }

function computeTaskSegments(
  taskStartMs: number,
  taskEndMs: number,
  operatingHours: OperatingHourSlot[],
  blackoutWindows: BlackoutWindow[]
): TaskSegment[] {
  if (operatingHours.length === 0) {
    return [{ startMs: taskStartMs, endMs: taskEndMs }];
  }
  const segments: TaskSegment[] = [];
  const sd = new Date(taskStartMs);
  let dayMs = Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate());
  while (dayMs < taskEndMs) {
    const dow = new Date(dayMs).getUTCDay();
    for (const slot of operatingHours.filter(s => s.dayOfWeek === dow).sort((a, b) => a.startHour - b.startHour)) {
      const segStart = Math.max(dayMs + slot.startHour * 3600000, taskStartMs);
      const segEnd = Math.min(dayMs + slot.endHour * 3600000, taskEndMs);
      if (segEnd > segStart) segments.push({ startMs: segStart, endMs: segEnd });
    }
    dayMs += 86400000;
  }

  // Subtract blackout windows from operating-hour segments
  let result = segments;
  for (const bw of blackoutWindows) {
    const bwStart = new Date(bw.startDate).getTime();
    const bwEnd = new Date(bw.endDate).getTime();
    const next: TaskSegment[] = [];
    for (const seg of result) {
      if (seg.endMs <= bwStart || seg.startMs >= bwEnd) {
        next.push(seg);
      } else {
        if (seg.startMs < bwStart) next.push({ startMs: seg.startMs, endMs: bwStart });
        if (seg.endMs > bwEnd) next.push({ startMs: bwEnd, endMs: seg.endMs });
      }
    }
    result = next;
  }
  return result.length > 0 ? result : [{ startMs: taskStartMs, endMs: taskEndMs }];
}

function formatTaskType(taskType: string): string {
  return taskType.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function TaskBars({
  tasks,
  channels,
  scale,
  laneHeight,
  topOffset,
  className = "",
  onHover,
  onLeave,
  onClick,
}: TaskBarsProps) {
  const channelIndex = new Map(channels.map((ch, i) => [ch.docId, i]));
  const barHeight = 32;

  return (
    <g className={`task-bars ${className}`}>
      {tasks.map((task) => {
        const lane = channelIndex.get(task.data.settlementChannelId);
        if (lane === undefined) return null;

        const channel = channels.find(ch => ch.docId === task.data.settlementChannelId);
        const opHours = channel ? channel.data.operatingHours : [];
        const taskStartMs = new Date(task.data.startDate).getTime();
        const taskEndMs = new Date(task.data.endDate).getTime();
        const segments = computeTaskSegments(taskStartMs, taskEndMs, opHours, channel ? channel.data.blackoutWindows : []);

        const y = topOffset + lane * laneHeight + (laneHeight - barHeight) / 2;
        const color = getTaskColor(task.data.taskType);
        const isHold = task.data.isRegulatoryHold;

        const firstSeg = segments[0];
        const firstX = scale.dateToX(new Date(firstSeg.startMs).toISOString());
        const firstXEnd = scale.dateToX(new Date(firstSeg.endMs).toISOString());
        const firstWidth = Math.max(firstXEnd - firstX, 2);

        return (
          <g
            key={task.docId}
            className="task-bar"
            onMouseEnter={(e) => {
              if (onHover) {
                const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
                onHover(task, rect);
              }
            }}
            onMouseLeave={onLeave}
            onClick={() => onClick?.(task)}
          >
            {segments.map((seg, i) => {
              const sx = scale.dateToX(new Date(seg.startMs).toISOString());
              const sxEnd = scale.dateToX(new Date(seg.endMs).toISOString());
              const sw = Math.max(sxEnd - sx, 2);
              return (
                <rect
                  key={i}
                  x={sx}
                  y={y}
                  width={sw}
                  height={barHeight}
                  rx={4}
                  ry={4}
                  fill={color}
                  opacity={isHold ? 0.8 : 1}
                />
              );
            })}
            {isHold && (
              <text
                x={firstX + 6}
                y={y + barHeight / 2 + 4}
                fontSize="12"
                fill="white"
              >
                🔒
              </text>
            )}
            {firstWidth > 50 && (
              <>
                <text
                  x={firstX + (isHold ? 22 : 6)}
                  y={y + barHeight / 2 - 2}
                  fontSize="10"
                  fill="white"
                  fontWeight="600"
                >
                  {task.data.taskReference.length > 15
                    ? task.data.taskReference.slice(0, 15) + "..."
                    : task.data.taskReference}
                </text>
                <text
                  x={firstX + (isHold ? 22 : 6)}
                  y={y + barHeight / 2 + 10}
                  fontSize="9"
                  fill="white"
                  fontWeight="400"
                  opacity={0.8}
                >
                  {formatTaskType(task.data.taskType)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
