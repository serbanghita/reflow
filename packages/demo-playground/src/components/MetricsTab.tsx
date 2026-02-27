import React from "react";
import type { ReflowMetrics, SettlementChannel } from "../types";

interface MetricsTabProps {
  metrics: ReflowMetrics | null;
  channels: SettlementChannel[];
}

export function MetricsTab({ metrics, channels }: MetricsTabProps) {
  if (!metrics) {
    return <div className="no-data">Run a scenario to see metrics</div>;
  }

  const channelMap = new Map(channels.map((c) => [c.docId, c.data.name]));

  return (
    <div>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="label">Total Delay</div>
          <div className={`value ${metrics.totalDelayMinutes > 0 ? "danger" : "success"}`}>
            {metrics.totalDelayMinutes} min
          </div>
        </div>
        <div className="metric-card">
          <div className="label">Tasks Affected</div>
          <div className={`value ${metrics.tasksAffected > 0 ? "warning" : "success"}`}>
            {metrics.tasksAffected}
          </div>
        </div>
        <div className="metric-card">
          <div className="label">SLA Breaches</div>
          <div className={`value ${metrics.slaBreaches.length > 0 ? "danger" : "success"}`}>
            {metrics.slaBreaches.length}
          </div>
        </div>
      </div>

      {Object.keys(metrics.channelUtilization).length > 0 && (
        <div>
          <h4 style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Channel Utilization
          </h4>
          {Object.entries(metrics.channelUtilization).map(([chId, util]) => {
            const name = channelMap.get(chId) ?? chId;
            const percent = Math.round(util * 100);
            const idle = metrics.channelIdleMinutes[chId] ?? 0;
            return (
              <div key={chId} className="utilization-bar-container">
                <div className="utilization-bar-label">
                  <span>{name}</span>
                  <span>{percent}% utilized, {idle} min idle</span>
                </div>
                <div className="utilization-bar-track">
                  <div
                    className="utilization-bar-fill"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {metrics.slaBreaches.length > 0 && (
        <table className="breach-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Target</th>
              <th>Actual End</th>
              <th>Breach</th>
            </tr>
          </thead>
          <tbody>
            {metrics.slaBreaches.map((b) => (
              <tr key={b.taskId}>
                <td>{b.taskId}</td>
                <td>{b.targetDate}</td>
                <td>{b.actualEndDate}</td>
                <td className="breach-value">+{b.breachMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
