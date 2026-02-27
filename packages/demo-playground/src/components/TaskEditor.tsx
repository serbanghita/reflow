import React, { useState } from "react";
import type { SettlementTask } from "../types";
import { getTaskColor } from "../gantt/colors";

interface TaskEditorProps {
  tasks: SettlementTask[];
  selectedTaskId?: string;
}

export function TaskEditor({ tasks, selectedTaskId }: TaskEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    selectedTaskId ?? null
  );

  return (
    <div className="sidebar-section">
      <h3>Tasks</h3>
      <ul className="data-tree">
        {tasks.map((task) => {
          const isOpen = expandedId === task.docId;
          const d = task.data;
          const color = getTaskColor(d.taskType);

          return (
            <li key={task.docId} className="data-tree-item">
              <div
                className="data-tree-header"
                onClick={() =>
                  setExpandedId(isOpen ? null : task.docId)
                }
              >
                <span
                  className={`data-tree-toggle ${isOpen ? "open" : ""}`}
                >
                  ▶
                </span>
                <span
                  className="task-type-dot"
                  style={{ backgroundColor: color }}
                />
                <span>
                  {d.taskReference} ({d.taskType})
                </span>
              </div>
              {isOpen && (
                <div className="data-tree-body">
                  <div className="field">
                    <span className="key">Channel</span>
                    <span className="val">{d.settlementChannelId}</span>
                  </div>
                  <div className="field">
                    <span className="key">Duration</span>
                    <span className="val">{d.durationMinutes} min</span>
                  </div>
                  {d.prepTimeMinutes ? (
                    <div className="field">
                      <span className="key">Prep Time</span>
                      <span className="val">{d.prepTimeMinutes} min</span>
                    </div>
                  ) : null}
                  <div className="field">
                    <span className="key">Start</span>
                    <span className="val">{d.startDate}</span>
                  </div>
                  <div className="field">
                    <span className="key">End</span>
                    <span className="val">{d.endDate}</span>
                  </div>
                  <div className="field">
                    <span className="key">Regulatory Hold</span>
                    <span className="val">
                      {d.isRegulatoryHold ? "Yes" : "No"}
                    </span>
                  </div>
                  {d.dependsOnTaskIds.length > 0 && (
                    <div className="field">
                      <span className="key">Depends On</span>
                      <span className="val">
                        {d.dependsOnTaskIds.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
