import React from "react";
import type { ScenarioMeta } from "../types";

interface ScenarioPickerProps {
  scenarios: ScenarioMeta[];
  selectedKey: string;
  onSelect: (key: string) => void;
  loading: boolean;
}

export function ScenarioPicker({
  scenarios,
  selectedKey,
  onSelect,
  loading,
}: ScenarioPickerProps) {
  const selected = scenarios.find((s) => s.key === selectedKey);

  return (
    <div className="sidebar-section">
      <h3>Scenario</h3>
      <select
        className="scenario-select"
        value={selectedKey}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
      >
        {scenarios.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>
      {selected && (
        <p className="scenario-description">{selected.description}</p>
      )}
    </div>
  );
}
