import React, { useState, useEffect, useCallback } from "react";
import { useScenarios } from "./hooks/useScenarios";
import { useReflow } from "./hooks/useReflow";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { BottomPanel } from "./components/BottomPanel";
import { GanttChart } from "./gantt/GanttChart";
import type { ReflowInput, SettlementTask } from "./types";

const DEFAULT_PPM = 1.5; // pixels per minute
const MIN_PPM = 0.3;
const MAX_PPM = 8;
const ZOOM_STEP = 0.3;

export function App() {
  const {
    scenarios,
    selectedKey,
    selectScenario,
    input,
    loading: scenarioLoading,
    error: scenarioError,
  } = useScenarios();

  const {
    beforeResult,
    afterResult,
    lastInput,
    loading: reflowLoading,
    error: reflowError,
    runInitial,
    runDisruption,
    reset,
  } = useReflow();

  const [pixelsPerMinute, setPixelsPerMinute] = useState(DEFAULT_PPM);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();

  // When input changes, run initial reflow
  useEffect(() => {
    if (input) {
      reset();
      runInitial(input);
    }
  }, [input, runInitial, reset]);

  const handleApplyDisruption = useCallback(
    (modifiedInput: ReflowInput) => {
      runDisruption(modifiedInput);
    },
    [runDisruption]
  );

  const handleZoomIn = useCallback(() => {
    setPixelsPerMinute((prev) => Math.min(prev + ZOOM_STEP, MAX_PPM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPixelsPerMinute((prev) => Math.max(prev - ZOOM_STEP, MIN_PPM));
  }, []);

  const handleFit = useCallback(() => {
    setPixelsPerMinute(DEFAULT_PPM);
  }, []);

  const handleTaskClick = useCallback((task: SettlementTask) => {
    setSelectedTaskId(task.docId);
  }, []);

  const loading = scenarioLoading || reflowLoading;
  const displayResult = afterResult ?? beforeResult;

  return (
    <div className="app-layout">
      <Header
        pixelsPerMinute={pixelsPerMinute}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
      />
      <Sidebar
        scenarios={scenarios}
        selectedKey={selectedKey}
        onSelectScenario={selectScenario}
        input={lastInput ?? input}
        loading={loading}
        onApplyDisruption={handleApplyDisruption}
        selectedTaskId={selectedTaskId}
        beforeTasks={afterResult?.updatedTasks ?? beforeResult?.updatedTasks ?? null}
      />
      <GanttChart
        channels={input?.settlementChannels ?? []}
        tradeOrders={input?.tradeOrders ?? []}
        beforeResult={beforeResult}
        afterResult={afterResult}
        pixelsPerMinute={pixelsPerMinute}
        onTaskClick={handleTaskClick}
      />
      <BottomPanel
        result={displayResult}
        channels={input?.settlementChannels ?? []}
      />
      {(scenarioError || reflowError) && (
        <div
          style={{
            position: "fixed",
            bottom: 240,
            right: 16,
            background: "rgba(239, 68, 68, 0.9)",
            color: "white",
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 400,
            zIndex: 100,
          }}
        >
          {scenarioError ?? reflowError}
        </div>
      )}
    </div>
  );
}
