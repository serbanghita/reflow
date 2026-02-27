import React from "react";
import type { SettlementChannel } from "../types";
import type { TimeScale } from "./TimeScale";

interface OperatingHoursBgProps {
  channels: SettlementChannel[];
  scale: TimeScale;
  startMs: number;
  endMs: number;
  laneHeight: number;
  topOffset: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

/**
 * Renders differentiated backgrounds + explanatory labels for non-operating periods:
 * - Full non-operating days (weekends): darkest — "Sat Closed — No operating hours"
 * - Before/after daily market hours: medium — "Market closed until 08:00"
 * - Gaps between operating slots on the same day: lighter — "Mid-day break"
 */
export function OperatingHoursBg({
  channels,
  scale,
  startMs,
  endMs,
  laneHeight,
  topOffset,
}: OperatingHoursBgProps) {
  const elements: React.ReactNode[] = [];

  channels.forEach((ch, laneIndex) => {
    const y = topOffset + laneIndex * laneHeight;
    const chName = ch.data.name;

    const startDate = new Date(startMs);
    const dayStart = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    ));

    let current = dayStart.getTime();
    while (current < endMs) {
      const d = new Date(current);
      const specDay = d.getUTCDay(); // 0=Sun
      const dayName = DAY_LABELS[specDay];

      const slots = ch.data.operatingHours.filter((s) => s.dayOfWeek === specDay);

      if (slots.length === 0) {
        // ── Full non-operating day ──
        const dayEnd = current + 86400000;
        const x1 = scale.dateToX(Math.max(current, startMs));
        const x2 = scale.dateToX(Math.min(dayEnd, endMs));
        const w = x2 - x1;
        if (w > 0) {
          elements.push(
            <rect
              key={`closed-${ch.docId}-${current}`}
              className="closed-day-bg"
              x={x1}
              y={y}
              width={w}
              height={laneHeight}
            />
          );
          const midX = (x1 + x2) / 2;
          if (w > 60) {
            elements.push(
              <text
                key={`closed-lbl-${ch.docId}-${current}`}
                className="zone-label zone-label-closed"
                x={midX}
                y={y + laneHeight / 2 - 2}
                textAnchor="middle"
              >
                {dayName} Closed
              </text>
            );
            elements.push(
              <text
                key={`closed-sub-${ch.docId}-${current}`}
                className="zone-label zone-label-offhours"
                x={midX}
                y={y + laneHeight / 2 + 10}
                textAnchor="middle"
              >
                No {chName} operating hours
              </text>
            );
          } else if (w > 30) {
            elements.push(
              <text
                key={`closed-lbl-${ch.docId}-${current}`}
                className="zone-label zone-label-closed"
                x={midX}
                y={y + laneHeight / 2 + 3}
                textAnchor="middle"
              >
                Closed
              </text>
            );
          }
        }
      } else {
        const sortedSlots = [...slots].sort((a, b) => a.startHour - b.startHour);
        const firstOpen = sortedSlots[0].startHour;
        const lastClose = sortedSlots[sortedSlots.length - 1].endHour;

        // ── Before first slot (early morning off-hours) ──
        const firstSlotStart = current + firstOpen * 3600000;
        if (firstSlotStart > current) {
          const x1 = scale.dateToX(Math.max(current, startMs));
          const x2 = scale.dateToX(Math.min(firstSlotStart, endMs));
          const w = x2 - x1;
          if (w > 0) {
            elements.push(
              <rect
                key={`off-before-${ch.docId}-${current}`}
                className="off-hours-bg"
                x={x1}
                y={y}
                width={w}
                height={laneHeight}
              />
            );
            if (w > 50) {
              elements.push(
                <text
                  key={`off-before-lbl-${ch.docId}-${current}`}
                  className="zone-label zone-label-offhours"
                  x={(x1 + x2) / 2}
                  y={y + laneHeight / 2 + 3}
                  textAnchor="middle"
                >
                  Opens {formatHour(firstOpen)}
                </text>
              );
            }
          }
        }

        // ── After last slot (evening off-hours) ──
        const lastSlotEnd = current + lastClose * 3600000;
        const dayEnd = current + 86400000;
        if (lastSlotEnd < dayEnd) {
          const x1 = scale.dateToX(Math.max(lastSlotEnd, startMs));
          const x2 = scale.dateToX(Math.min(dayEnd, endMs));
          const w = x2 - x1;
          if (w > 0) {
            elements.push(
              <rect
                key={`off-after-${ch.docId}-${current}`}
                className="off-hours-bg"
                x={x1}
                y={y}
                width={w}
                height={laneHeight}
              />
            );
            if (w > 50) {
              elements.push(
                <text
                  key={`off-after-lbl-${ch.docId}-${current}`}
                  className="zone-label zone-label-offhours"
                  x={(x1 + x2) / 2}
                  y={y + laneHeight / 2 + 3}
                  textAnchor="middle"
                >
                  Closed {formatHour(lastClose)}
                </text>
              );
            }
          }
        }

        // ── Gaps between operating slots on the same day ──
        for (let i = 0; i < sortedSlots.length - 1; i++) {
          const gapStart = current + sortedSlots[i].endHour * 3600000;
          const gapEnd = current + sortedSlots[i + 1].startHour * 3600000;
          if (gapEnd > gapStart) {
            const x1 = scale.dateToX(Math.max(gapStart, startMs));
            const x2 = scale.dateToX(Math.min(gapEnd, endMs));
            const w = x2 - x1;
            if (w > 0) {
              elements.push(
                <rect
                  key={`gap-${ch.docId}-${current}-${i}`}
                  className="inter-slot-bg"
                  x={x1}
                  y={y}
                  width={w}
                  height={laneHeight}
                />
              );
              if (w > 40) {
                elements.push(
                  <text
                    key={`gap-lbl-${ch.docId}-${current}-${i}`}
                    className="zone-label zone-label-offhours"
                    x={(x1 + x2) / 2}
                    y={y + laneHeight / 2 + 3}
                    textAnchor="middle"
                  >
                    Break {formatHour(sortedSlots[i].endHour)}-{formatHour(sortedSlots[i + 1].startHour)}
                  </text>
                );
              }
            }
          }
        }
      }

      current += 86400000;
    }
  });

  return <g className="operating-hours-bg">{elements}</g>;
}
