import React from "react";
import type { SettlementChannel } from "../types";
import type { TimeScale } from "./TimeScale";

interface BlackoutOverlayProps {
  channels: SettlementChannel[];
  scale: TimeScale;
  laneHeight: number;
  topOffset: number;
}

export function BlackoutOverlay({
  channels,
  scale,
  laneHeight,
  topOffset,
}: BlackoutOverlayProps) {
  const elements: React.ReactNode[] = [];

  channels.forEach((ch, laneIndex) => {
    const y = topOffset + laneIndex * laneHeight;

    for (const bw of ch.data.blackoutWindows) {
      const x1 = scale.dateToX(bw.startDate);
      const x2 = scale.dateToX(bw.endDate);
      const width = x2 - x1;
      if (width <= 0) continue;

      // Solid dark background behind the hatching
      elements.push(
        <rect
          key={`bo-bg-${ch.docId}-${bw.startDate}`}
          className="blackout-bg"
          x={x1}
          y={y}
          width={width}
          height={laneHeight}
        />
      );

      // Hatched overlay
      elements.push(
        <rect
          key={`bo-${ch.docId}-${bw.startDate}`}
          className="blackout-rect"
          x={x1}
          y={y}
          width={width}
          height={laneHeight}
        />
      );

      // Top accent bar
      elements.push(
        <rect
          key={`bo-accent-${ch.docId}-${bw.startDate}`}
          className="blackout-accent"
          x={x1}
          y={y}
          width={width}
          height={3}
        />
      );

      // Reason label (if wide enough)
      if (width > 30) {
        const label = bw.reason ?? "Blackout";
        const truncated = label.length > 20 ? label.slice(0, 18) + "..." : label;
        elements.push(
          <text
            key={`bo-lbl-${ch.docId}-${bw.startDate}`}
            className="zone-label zone-label-blackout"
            x={x1 + width / 2}
            y={y + laneHeight / 2 + 3}
            textAnchor="middle"
          >
            {truncated}
          </text>
        );
      }
    }
  });

  return <g className="blackout-overlays">{elements}</g>;
}
