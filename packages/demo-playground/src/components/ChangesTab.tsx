import React from "react";
import type { ScheduleChange } from "../types";

interface ChangesTabProps {
  changes: ScheduleChange[];
}

export function ChangesTab({ changes }: ChangesTabProps) {
  if (changes.length === 0) {
    return <div className="no-data">No schedule changes</div>;
  }

  return (
    <table className="changes-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Field</th>
          <th>Before</th>
          <th>After</th>
          <th>Delta</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c, i) => {
          const formatDate = (iso: string) => {
            const d = new Date(iso);
            const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
            return `${day} ${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
          };

          return (
            <tr key={`${c.taskId}-${c.field}-${i}`}>
              <td>{c.taskReference}</td>
              <td>{c.field}</td>
              <td>{formatDate(c.oldValue)}</td>
              <td>{formatDate(c.newValue)}</td>
              <td className={c.deltaMinutes > 0 ? "delta-positive" : c.deltaMinutes < 0 ? "delta-negative" : ""}>
                {c.deltaMinutes > 0 ? "+" : ""}
                {c.deltaMinutes} min
              </td>
              <td>{c.reason}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
