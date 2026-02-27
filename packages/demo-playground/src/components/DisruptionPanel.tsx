import React, { useState } from "react";
import type { ReflowInput, SettlementTask } from "../types";

interface DisruptionPanelProps {
  input: ReflowInput | null;
  loading: boolean;
  onApply: (modifiedInput: ReflowInput) => void;
  beforeTasks: SettlementTask[] | null;
}

export function DisruptionPanel({ input, loading, onApply, beforeTasks }: DisruptionPanelProps) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(180);

  if (!input) return null;

  const tasks = input.settlementTasks.filter((t) => !t.data.isRegulatoryHold);

  const handleApply = () => {
    if (!selectedTaskId || !input) return;

    const modified: ReflowInput = JSON.parse(JSON.stringify(input));
    const task = modified.settlementTasks.find((t) => t.docId === selectedTaskId);
    if (!task) return;

    // Use reflowed (before) times as baseline so the delay is relative to
    // where the task actually landed after the initial reflow, not the
    // original scenario input. Falls back to input times if beforeTasks is null.
    const reflowedTask = beforeTasks?.find((t) => t.docId === selectedTaskId);
    const baseStart = reflowedTask?.data.startDate ?? task.data.startDate;
    const baseEnd = reflowedTask?.data.endDate ?? task.data.endDate;
    const start = new Date(baseStart);
    const end = new Date(baseEnd);
    start.setTime(start.getTime() + delayMinutes * 60000);
    end.setTime(end.getTime() + delayMinutes * 60000);
    task.data.startDate = start.toISOString().replace(".000Z", "Z");
    task.data.endDate = end.toISOString().replace(".000Z", "Z");

    onApply(modified);
  };

  return (
    <div className="sidebar-section">
      <h3>Disruption</h3>
      <div className="disruption-controls">
        <div className="form-row">
          <label className="form-label">Delay task</label>
          <select
            className="form-select"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
          >
            <option value="">Select a task...</option>
            {tasks.map((t) => (
              <option key={t.docId} value={t.docId}>
                {t.data.taskReference} ({t.data.taskType})
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Delay (minutes)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            step={15}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <button
          className="apply-button"
          onClick={handleApply}
          disabled={loading || !selectedTaskId}
        >
          {loading ? "Running..." : "Apply & Reflow"}
        </button>
      </div>
    </div>
  );
}
