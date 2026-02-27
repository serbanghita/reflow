import { describe, it, expect } from "vitest";
import { topologicalSort, CycleError } from "../reflow/dag.js";
import type { SettlementTask } from "../reflow/types.js";

function makeTask(
  id: string,
  deps: string[] = [],
  startDate: string = "2024-01-15T08:00:00Z"
): SettlementTask {
  return {
    docId: id,
    docType: "settlementTask",
    data: {
      taskReference: `REF-${id}`,
      tradeOrderId: "trade-1",
      settlementChannelId: "ch-1",
      startDate,
      endDate: "2024-01-15T09:00:00Z",
      durationMinutes: 60,
      isRegulatoryHold: false,
      dependsOnTaskIds: deps,
      taskType: "fundTransfer",
    },
  };
}

describe("topologicalSort", () => {
  it("handles linear chain: A → B → C", () => {
    const tasks = [
      makeTask("A"),
      makeTask("B", ["A"]),
      makeTask("C", ["B"]),
    ];
    const result = topologicalSort(tasks);
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles diamond: A → B, A → C, B → D, C → D", () => {
    const tasks = [
      makeTask("A", [], "2024-01-15T08:00:00Z"),
      makeTask("B", ["A"], "2024-01-15T09:00:00Z"),
      makeTask("C", ["A"], "2024-01-15T09:30:00Z"),
      makeTask("D", ["B", "C"], "2024-01-15T10:00:00Z"),
    ];
    const result = topologicalSort(tasks);
    expect(result[0]).toBe("A");
    expect(result[result.length - 1]).toBe("D");
    // B and C can be in either order but B has earlier startDate
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("D"));
    expect(result.indexOf("C")).toBeLessThan(result.indexOf("D"));
    expect(result.indexOf("B")).toBeLessThan(result.indexOf("C"));
  });

  it("detects circular: A → B → A", () => {
    const tasks = [makeTask("A", ["B"]), makeTask("B", ["A"])];
    expect(() => topologicalSort(tasks)).toThrow(CycleError);
  });

  it("detects circular in larger graph: A → B → C → A", () => {
    const tasks = [
      makeTask("A", ["C"]),
      makeTask("B", ["A"]),
      makeTask("C", ["B"]),
    ];
    expect(() => topologicalSort(tasks)).toThrow(CycleError);
  });

  it("handles no dependencies (all roots)", () => {
    const tasks = [
      makeTask("C", [], "2024-01-15T10:00:00Z"),
      makeTask("A", [], "2024-01-15T08:00:00Z"),
      makeTask("B", [], "2024-01-15T09:00:00Z"),
    ];
    const result = topologicalSort(tasks);
    // Should be sorted by startDate
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("handles empty input", () => {
    const result = topologicalSort([]);
    expect(result).toEqual([]);
  });

  it("handles single task", () => {
    const result = topologicalSort([makeTask("A")]);
    expect(result).toEqual(["A"]);
  });

  it("tie-breaks by startDate", () => {
    const tasks = [
      makeTask("B", [], "2024-01-15T10:00:00Z"),
      makeTask("A", [], "2024-01-15T08:00:00Z"),
    ];
    const result = topologicalSort(tasks);
    expect(result).toEqual(["A", "B"]);
  });

  it("ignores unknown dependency IDs", () => {
    // Task B depends on "unknown" which doesn't exist in the task list
    const tasks = [makeTask("A"), makeTask("B", ["unknown"])];
    const result = topologicalSort(tasks);
    // Both should appear, B's unknown dep is ignored
    expect(result).toHaveLength(2);
  });
});
