import React from "react";
import type { ScenarioMeta, ReflowInput, SettlementTask } from "../types";
import { ScenarioPicker } from "./ScenarioPicker";
import { DisruptionPanel } from "./DisruptionPanel";
import { TaskEditor } from "./TaskEditor";
import { ChannelEditor } from "./ChannelEditor";
import { OrderEditor } from "./OrderEditor";

interface SidebarProps {
  scenarios: ScenarioMeta[];
  selectedKey: string;
  onSelectScenario: (key: string) => void;
  input: ReflowInput | null;
  loading: boolean;
  onApplyDisruption: (modifiedInput: ReflowInput) => void;
  selectedTaskId?: string;
  beforeTasks: SettlementTask[] | null;
}

export function Sidebar({
  scenarios,
  selectedKey,
  onSelectScenario,
  input,
  loading,
  onApplyDisruption,
  selectedTaskId,
  beforeTasks,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <ScenarioPicker
        scenarios={scenarios}
        selectedKey={selectedKey}
        onSelect={onSelectScenario}
        loading={loading}
      />
      <DisruptionPanel
        input={input}
        loading={loading}
        onApply={onApplyDisruption}
        beforeTasks={beforeTasks}
      />
      {input && (
        <>
          <TaskEditor
            tasks={input.settlementTasks}
            selectedTaskId={selectedTaskId}
          />
          <ChannelEditor channels={input.settlementChannels} />
          <OrderEditor orders={input.tradeOrders} />
        </>
      )}
    </aside>
  );
}
