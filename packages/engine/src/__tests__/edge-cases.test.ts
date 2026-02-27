import { describe, it, expect } from "vitest";
import { ReflowService } from "../reflow/reflow.service.js";
import type {
  SettlementTask,
  SettlementChannel,
  TradeOrder,
  ReflowInput,
} from "../reflow/types.js";

const service = new ReflowService();

function makeChannel(
  id: string = "ch-1",
  overrides: Partial<{
    operatingHours: { dayOfWeek: number; startHour: number; endHour: number }[];
    blackouts: { startDate: string; endDate: string }[];
  }> = {}
): SettlementChannel {
  return {
    docId: id,
    docType: "settlementChannel",
    data: {
      name: "Test Channel",
      operatingHours: overrides.operatingHours ?? [
        { dayOfWeek: 1, startHour: 8, endHour: 16 },
        { dayOfWeek: 2, startHour: 8, endHour: 16 },
        { dayOfWeek: 3, startHour: 8, endHour: 16 },
        { dayOfWeek: 4, startHour: 8, endHour: 16 },
        { dayOfWeek: 5, startHour: 8, endHour: 16 },
      ],
      blackoutWindows: overrides.blackouts ?? [],
    },
  };
}

function makeTask(
  id: string,
  overrides: Partial<{
    channelId: string;
    deps: string[];
    startDate: string;
    endDate: string;
    duration: number;
    isRegulatoryHold: boolean;
  }> = {}
): SettlementTask {
  return {
    docId: id,
    docType: "settlementTask",
    data: {
      taskReference: `STL-${id}`,
      tradeOrderId: "trade-1",
      settlementChannelId: overrides.channelId ?? "ch-1",
      startDate: overrides.startDate ?? "2024-01-15T10:00:00Z",
      endDate: overrides.endDate ?? "2024-01-15T11:00:00Z",
      durationMinutes: overrides.duration ?? 60,
      isRegulatoryHold: overrides.isRegulatoryHold ?? false,
      dependsOnTaskIds: overrides.deps ?? [],
      taskType: "fundTransfer",
    },
  };
}

describe("Edge Cases", () => {
  it("empty task list → no changes", () => {
    const input: ReflowInput = {
      settlementTasks: [],
      settlementChannels: [makeChannel()],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    expect(result.updatedTasks).toHaveLength(0);
    expect(result.changes).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("single task, no conflicts → unchanged", () => {
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", {
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
          duration: 60,
        }),
      ],
      settlementChannels: [makeChannel()],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    expect(result.changes).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("circular deps → descriptive error", () => {
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", { deps: ["B"] }),
        makeTask("B", { deps: ["C"] }),
        makeTask("C", { deps: ["A"] }),
      ],
      settlementChannels: [makeChannel()],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Circular dependency");
  });

  it("all tasks are regulatory holds → nothing moves", () => {
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", {
          isRegulatoryHold: true,
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
        }),
        makeTask("B", {
          isRegulatoryHold: true,
          startDate: "2024-01-15T11:00:00Z",
          endDate: "2024-01-15T12:00:00Z",
        }),
      ],
      settlementChannels: [makeChannel()],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    expect(result.changes).toHaveLength(0);
  });

  it("channel with no operating hours at all → error", () => {
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", {
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
          duration: 60,
        }),
      ],
      settlementChannels: [
        makeChannel("ch-1", {
          operatingHours: [], // No operating hours at all
        }),
      ],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("tasks on different channels don't block each other", () => {
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", {
          channelId: "ch-1",
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
          duration: 60,
        }),
        makeTask("B", {
          channelId: "ch-2",
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
          duration: 60,
        }),
      ],
      settlementChannels: [makeChannel("ch-1"), makeChannel("ch-2")],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    // Both should remain at their original times
    expect(result.changes).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("dependency across different channels", () => {
    // A on ch-1, B depends on A but is on ch-2
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", {
          channelId: "ch-1",
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T12:00:00Z",
          duration: 120,
        }),
        makeTask("B", {
          channelId: "ch-2",
          deps: ["A"],
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
          duration: 60,
        }),
      ],
      settlementChannels: [makeChannel("ch-1"), makeChannel("ch-2")],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    // B should be pushed to after A ends (12:00)
    const taskB = result.updatedTasks.find((t) => t.docId === "B")!;
    expect(taskB.data.startDate).toBe("2024-01-15T12:00:00.000Z");
  });

  it("regulatory hold as upstream dependency for non-hold task", () => {
    // Hold at 10-11, non-hold B depends on hold
    // B should start at 11 (after hold ends)
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("hold", {
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
          duration: 60,
          isRegulatoryHold: true,
        }),
        makeTask("B", {
          deps: ["hold"],
          startDate: "2024-01-15T09:00:00Z",
          endDate: "2024-01-15T10:00:00Z",
          duration: 60,
        }),
      ],
      settlementChannels: [makeChannel()],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    const taskB = result.updatedTasks.find((t) => t.docId === "B")!;
    expect(taskB.data.startDate).toBe("2024-01-15T11:00:00.000Z");
    expect(taskB.data.endDate).toBe("2024-01-15T12:00:00.000Z");
    expect(result.errors).toHaveLength(0);
  });

  it("split operating hours (multiple windows per day) through full pipeline", () => {
    // Channel has morning 8-12 and afternoon 13-17 windows (1h lunch gap)
    // Task is 300 min (5h) starting at 10AM
    // Available: 10-12 (120), 13-17 (240) — consumes 120 + 180 = 300 at 16:00
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", {
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T15:00:00Z",
          duration: 300,
        }),
      ],
      settlementChannels: [
        makeChannel("ch-1", {
          operatingHours: [
            { dayOfWeek: 1, startHour: 8, endHour: 12 },
            { dayOfWeek: 1, startHour: 13, endHour: 17 },
            { dayOfWeek: 2, startHour: 8, endHour: 12 },
            { dayOfWeek: 2, startHour: 13, endHour: 17 },
            { dayOfWeek: 3, startHour: 8, endHour: 12 },
            { dayOfWeek: 3, startHour: 13, endHour: 17 },
            { dayOfWeek: 4, startHour: 8, endHour: 12 },
            { dayOfWeek: 4, startHour: 13, endHour: 17 },
            { dayOfWeek: 5, startHour: 8, endHour: 12 },
            { dayOfWeek: 5, startHour: 13, endHour: 17 },
          ],
        }),
      ],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    const taskA = result.updatedTasks[0];
    // 120 min (10-12) + 180 min (13-16) = 300 min
    expect(taskA.data.startDate).toBe("2024-01-15T10:00:00.000Z");
    expect(taskA.data.endDate).toBe("2024-01-15T16:00:00.000Z");
    expect(result.errors).toHaveLength(0);
  });

  it("task starting at exact end of operating hours", () => {
    const input: ReflowInput = {
      settlementTasks: [
        makeTask("A", {
          startDate: "2024-01-15T16:00:00Z", // Exactly at close
          endDate: "2024-01-15T17:00:00Z",
          duration: 60,
        }),
      ],
      settlementChannels: [makeChannel()],
      tradeOrders: [],
    };
    const result = service.reflow(input);
    // Should be pushed to next day 8AM
    const taskA = result.updatedTasks[0];
    expect(taskA.data.startDate).toBe("2024-01-16T08:00:00.000Z");
    expect(taskA.data.endDate).toBe("2024-01-16T09:00:00.000Z");
  });
});
