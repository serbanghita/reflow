import React from "react";
import type { SettlementChannel } from "../types";

interface SwimLanesProps {
  channels: SettlementChannel[];
  laneHeight: number;
  topOffset: number;
  totalWidth: number;
}

export const LANE_HEIGHT = 80;
export const LANE_LABEL_WIDTH = 100;

export function SwimLanes({ channels, laneHeight, topOffset, totalWidth }: SwimLanesProps) {
  return (
    <g className="swim-lanes">
      {channels.map((ch, i) => {
        const y = topOffset + i * laneHeight;
        return (
          <g key={ch.docId}>
            <rect
              className="swim-lane-bg"
              x={0}
              y={y}
              width={totalWidth}
              height={laneHeight}
              fill={i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.03)"}
            />
            <line
              x1={0}
              y1={y + laneHeight}
              x2={totalWidth}
              y2={y + laneHeight}
              stroke="var(--bg-tertiary)"
              strokeWidth={0.5}
            />
            <text
              className="swim-lane-label"
              x={8}
              y={y + laneHeight / 2 + 4}
            >
              {ch.data.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
