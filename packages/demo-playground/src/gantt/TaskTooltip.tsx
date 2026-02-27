import React from "react";
import type { SettlementTask, ScheduleChange } from "../types";
import { getTaskColor } from "./colors";

interface TaskTooltipProps {
  task: SettlementTask;
  position: { x: number; y: number };
  changes?: ScheduleChange[];
}

export function TaskTooltip({ task, position, changes }: TaskTooltipProps) {
  const d = task.data;
  const taskChanges = changes?.filter((c) => c.taskId === task.docId) ?? [];
  const startChange = taskChanges.find((c) => c.field === "startDate");

  const formatDate = (iso: string) => {
    const dt = new Date(iso);
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
    return `${day} ${dt.getUTCHours().toString().padStart(2, "0")}:${dt
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      className="task-tooltip"
      style={{ left: position.x + 12, top: position.y - 10 }}
    >
      <h4>
        <span
          className="task-type-dot"
          style={{ backgroundColor: getTaskColor(d.taskType), marginRight: 6 }}
        />
        {d.taskReference}
      </h4>
      <div className="tt-row">
        <span className="tt-key">Type</span>
        <span className="tt-val">{d.taskType}</span>
      </div>
      <div className="tt-row">
        <span className="tt-key">Channel</span>
        <span className="tt-val">{d.settlementChannelId}</span>
      </div>
      <div className="tt-row">
        <span className="tt-key">Duration</span>
        <span className="tt-val">{d.durationMinutes} min</span>
      </div>
      {d.prepTimeMinutes ? (
        <div className="tt-row">
          <span className="tt-key">Prep Time</span>
          <span className="tt-val">{d.prepTimeMinutes} min</span>
        </div>
      ) : null}
      <div className="tt-row">
        <span className="tt-key">Start</span>
        <span className="tt-val">{formatDate(d.startDate)}</span>
      </div>
      <div className="tt-row">
        <span className="tt-key">End</span>
        <span className="tt-val">{formatDate(d.endDate)}</span>
      </div>
      {d.isRegulatoryHold && (
        <div className="tt-row">
          <span className="tt-key">Status</span>
          <span className="tt-val" style={{ color: "#EF4444" }}>
            Pinned (Regulatory Hold)
          </span>
        </div>
      )}
      {d.dependsOnTaskIds.length > 0 && (
        <div className="tt-row">
          <span className="tt-key">Depends On</span>
          <span className="tt-val">{d.dependsOnTaskIds.length} task(s)</span>
        </div>
      )}
      {startChange && (
        <div className="tt-row">
          <span className="tt-key">Delay</span>
          <span className="tt-val delay">+{startChange.deltaMinutes} min</span>
        </div>
      )}
    </div>
  );
}
