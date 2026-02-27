import React from "react";
import type { SettlementTask, SettlementChannel } from "../types";
import type { TimeScale } from "./TimeScale";

interface DependencyArrowsProps {
  tasks: SettlementTask[];
  channels: SettlementChannel[];
  scale: TimeScale;
  laneHeight: number;
  topOffset: number;
}

export function DependencyArrows({
  tasks,
  channels,
  scale,
  laneHeight,
  topOffset,
}: DependencyArrowsProps) {
  const channelIndex = new Map(channels.map((ch, i) => [ch.docId, i]));
  const taskMap = new Map(tasks.map((t) => [t.docId, t]));
  const barHeight = 32;
  const paths: React.ReactNode[] = [];

  for (const task of tasks) {
    for (const depId of task.data.dependsOnTaskIds) {
      const dep = taskMap.get(depId);
      if (!dep) continue;

      const fromLane = channelIndex.get(dep.data.settlementChannelId);
      const toLane = channelIndex.get(task.data.settlementChannelId);
      if (fromLane === undefined || toLane === undefined) continue;

      const fromX = scale.dateToX(dep.data.endDate);
      const fromY = topOffset + fromLane * laneHeight + laneHeight / 2;
      const toX = scale.dateToX(task.data.startDate);
      const toY = topOffset + toLane * laneHeight + laneHeight / 2;

      // Simple path with a small curve
      const midX = (fromX + toX) / 2;
      const d =
        fromLane === toLane
          ? `M ${fromX} ${fromY} L ${toX - 4} ${toY}`
          : `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX - 4} ${toY}`;

      paths.push(
        <path
          key={`dep-${depId}-${task.docId}`}
          className="dep-arrow"
          d={d}
        />
      );
    }
  }

  return <g className="dependency-arrows">{paths}</g>;
}
