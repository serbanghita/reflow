import React, { useState } from "react";
import type { ReflowResult, SettlementChannel } from "../types";
import { MetricsTab } from "./MetricsTab";
import { ChangesTab } from "./ChangesTab";
import { ExplanationTab } from "./ExplanationTab";
import { ErrorsTab } from "./ErrorsTab";

interface BottomPanelProps {
  result: ReflowResult | null;
  channels: SettlementChannel[];
}

type TabKey = "metrics" | "changes" | "explanation" | "errors";

export function BottomPanel({ result, channels }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("metrics");

  const errorCount = result?.errors.length ?? 0;

  const tabs: Array<{ key: TabKey; label: string; badge?: number }> = [
    { key: "metrics", label: "Metrics" },
    { key: "changes", label: "Changes" },
    { key: "explanation", label: "Explanation" },
    { key: "errors", label: "Errors", badge: errorCount > 0 ? errorCount : undefined },
  ];

  return (
    <div className="bottom-panel">
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="tab-badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {activeTab === "metrics" && (
          <MetricsTab metrics={result?.metrics ?? null} channels={channels} />
        )}
        {activeTab === "changes" && (
          <ChangesTab changes={result?.changes ?? []} />
        )}
        {activeTab === "explanation" && (
          <ExplanationTab explanation={result?.explanation ?? []} />
        )}
        {activeTab === "errors" && (
          <ErrorsTab errors={result?.errors ?? []} />
        )}
      </div>
    </div>
  );
}
