import React from "react";
import type { TimeScale } from "./TimeScale";

interface TimeAxisProps {
  scale: TimeScale;
  startMs: number;
  endMs: number;
  y: number;
  totalHeight: number;
}

export function TimeAxis({ scale, startMs, endMs, y, totalHeight }: TimeAxisProps) {
  const elements: React.ReactNode[] = [];

  // Determine step: hours
  const startDate = new Date(startMs);
  // Round to the next full hour
  const firstHour = new Date(startDate);
  firstHour.setMinutes(0, 0, 0);
  if (firstHour.getTime() < startMs) {
    firstHour.setTime(firstHour.getTime() + 3600000);
  }

  let current = firstHour.getTime();
  let lastDay = "";

  while (current <= endMs) {
    const d = new Date(current);
    const x = scale.dateToX(current);
    const hour = d.getUTCHours();
    const isMajor = hour === 0 || hour === 8;

    // Gridline
    elements.push(
      <line
        key={`gl-${current}`}
        x1={x}
        y1={y + 30}
        x2={x}
        y2={totalHeight}
        className={isMajor ? "gridline-major" : "gridline"}
      />
    );

    // Hour label
    const label = `${hour.toString().padStart(2, "0")}:00`;
    elements.push(
      <text
        key={`hl-${current}`}
        x={x}
        y={y + 24}
        textAnchor="middle"
        className="time-axis-label"
      >
        {label}
      </text>
    );

    // Day label (only at midnight or first visible hour)
    const dayStr = d.toISOString().slice(0, 10);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (dayStr !== lastDay) {
      lastDay = dayStr;
      const dayName = dayNames[d.getUTCDay()];
      elements.push(
        <text
          key={`dl-${current}`}
          x={x + 2}
          y={y + 10}
          className="time-axis-day-label"
        >
          {dayName} {d.getUTCMonth() + 1}/{d.getUTCDate()}
        </text>
      );
    }

    current += 3600000;
  }

  return <g className="time-axis">{elements}</g>;
}
