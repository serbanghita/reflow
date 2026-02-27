import React, { useState } from "react";
import type { SettlementChannel } from "../types";

interface ChannelEditorProps {
  channels: SettlementChannel[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ChannelEditor({ channels }: ChannelEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="sidebar-section">
      <h3>Channels</h3>
      <ul className="data-tree">
        {channels.map((ch) => {
          const isOpen = expandedId === ch.docId;
          const d = ch.data;

          // Summarize operating hours
          const opSummary = d.operatingHours
            .map(
              (s) =>
                `${DAY_NAMES[s.dayOfWeek]} ${s.startHour}:00-${s.endHour}:00`
            )
            .slice(0, 2)
            .join(", ");

          return (
            <li key={ch.docId} className="data-tree-item">
              <div
                className="data-tree-header"
                onClick={() =>
                  setExpandedId(isOpen ? null : ch.docId)
                }
              >
                <span
                  className={`data-tree-toggle ${isOpen ? "open" : ""}`}
                >
                  ▶
                </span>
                <span>
                  {d.name}{" "}
                  {d.operatingHours.length > 0 &&
                    `(${d.operatingHours[0].startHour}-${d.operatingHours[0].endHour} ${DAY_NAMES[d.operatingHours[0].dayOfWeek]}-${DAY_NAMES[d.operatingHours[d.operatingHours.length - 1].dayOfWeek]})`}
                </span>
              </div>
              {isOpen && (
                <div className="data-tree-body">
                  <div className="field">
                    <span className="key">Operating Hours</span>
                    <span className="val" />
                  </div>
                  {d.operatingHours.map((s, i) => (
                    <div key={i} className="field" style={{ paddingLeft: 8 }}>
                      <span className="key">{DAY_NAMES[s.dayOfWeek]}</span>
                      <span className="val">
                        {s.startHour}:00 - {s.endHour}:00
                      </span>
                    </div>
                  ))}
                  {d.blackoutWindows.length > 0 && (
                    <>
                      <div className="field" style={{ marginTop: 6 }}>
                        <span className="key">Blackout Windows</span>
                        <span className="val" />
                      </div>
                      {d.blackoutWindows.map((bw, i) => (
                        <div
                          key={i}
                          className="field"
                          style={{ paddingLeft: 8 }}
                        >
                          <span className="key">{bw.reason ?? "Blackout"}</span>
                          <span className="val">
                            {new Date(bw.startDate).toISOString().slice(11, 16)}-
                            {new Date(bw.endDate).toISOString().slice(11, 16)}
                          </span>
                        </div>
                      ))}
                    </>
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
