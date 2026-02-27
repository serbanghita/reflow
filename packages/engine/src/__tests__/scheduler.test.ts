import { describe, it, expect } from "vitest";
import { scheduleTasks } from "../reflow/scheduler.js";
import type {
  SettlementTask,
  SettlementChannel,
} from "../reflow/types.js";

// Helper: Mon-Fri 8AM-4PM channel
function makeChannel(
  id: string = "ch-1",
  name: string = "SWIFT",
  blackouts: { startDate: string; endDate: string; reason?: string }[] = []
): SettlementChannel {
  return {
    docId: id,
    docType: "settlementChannel",
    data: {
      name,
      operatingHours: [
        { dayOfWeek: 1, startHour: 8, endHour: 16 },
        { dayOfWeek: 2, startHour: 8, endHour: 16 },
        { dayOfWeek: 3, startHour: 8, endHour: 16 },
        { dayOfWeek: 4, startHour: 8, endHour: 16 },
        { dayOfWeek: 5, startHour: 8, endHour: 16 },
      ],
      blackoutWindows: blackouts,
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
    taskType: string;
    prepTimeMinutes: number;
  }> = {}
): SettlementTask {
  const start = overrides.startDate ?? "2024-01-15T10:00:00Z";
  const end = overrides.endDate ?? "2024-01-15T11:00:00Z";
  return {
    docId: id,
    docType: "settlementTask",
    data: {
      taskReference: `STL-${id}`,
      tradeOrderId: "trade-1",
      settlementChannelId: overrides.channelId ?? "ch-1",
      startDate: start,
      endDate: end,
      durationMinutes: overrides.duration ?? 60,
      isRegulatoryHold: overrides.isRegulatoryHold ?? false,
      dependsOnTaskIds: overrides.deps ?? [],
      taskType: (overrides.taskType as any) ?? "fundTransfer",
      ...(overrides.prepTimeMinutes !== undefined
        ? { prepTimeMinutes: overrides.prepTimeMinutes }
        : {}),
    },
  };
}

describe("scheduleTasks", () => {
  it("handles single task with no constraints — unchanged", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
      }),
    ];
    const channels = [makeChannel()];
    const result = scheduleTasks(tasks, channels);

    expect(result.errors).toHaveLength(0);
    expect(result.changes).toHaveLength(0);
    expect(result.updatedTasks[0].data.startDate).toBe("2024-01-15T10:00:00.000Z");
    expect(result.updatedTasks[0].data.endDate).toBe("2024-01-15T11:00:00.000Z");
  });

  it("handles two tasks with dependency", () => {
    // A: 10-11AM, B depends on A but scheduled at 10:30
    // B should be pushed to 11AM
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
      }),
      makeTask("B", {
        deps: ["A"],
        startDate: "2024-01-15T10:30:00Z",
        endDate: "2024-01-15T11:30:00Z",
        duration: 60,
      }),
    ];
    const channels = [makeChannel()];
    const result = scheduleTasks(tasks, channels);

    expect(result.errors).toHaveLength(0);
    const taskB = result.updatedTasks.find((t) => t.docId === "B")!;
    expect(taskB.data.startDate).toBe("2024-01-15T11:00:00.000Z");
    expect(taskB.data.endDate).toBe("2024-01-15T12:00:00.000Z");
  });

  it("handles two tasks competing for same channel", () => {
    // Both start at 10AM, 60 min each, same channel
    // Second should be pushed to 11AM
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
      }),
      makeTask("B", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
      }),
    ];
    const channels = [makeChannel()];
    const result = scheduleTasks(tasks, channels);

    expect(result.errors).toHaveLength(0);
    const taskA = result.updatedTasks.find((t) => t.docId === "A")!;
    const taskB = result.updatedTasks.find((t) => t.docId === "B")!;
    // A stays at 10, B pushed to 11
    expect(taskA.data.startDate).toBe("2024-01-15T10:00:00.000Z");
    expect(taskB.data.startDate).toBe("2024-01-15T11:00:00.000Z");
  });

  it("handles task with prepTimeMinutes", () => {
    // Task with 30 min prep + 60 min duration = 90 min total
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:30:00Z",
        duration: 60,
        prepTimeMinutes: 30,
      }),
    ];
    const channels = [makeChannel()];
    const result = scheduleTasks(tasks, channels);

    expect(result.errors).toHaveLength(0);
    const taskA = result.updatedTasks[0];
    expect(taskA.data.startDate).toBe("2024-01-15T10:00:00.000Z");
    expect(taskA.data.endDate).toBe("2024-01-15T11:30:00.000Z");
  });

  it("does not move regulatory hold tasks", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
        isRegulatoryHold: true,
        taskType: "regulatoryHold",
      }),
    ];
    const channels = [makeChannel()];
    const result = scheduleTasks(tasks, channels);

    expect(result.changes).toHaveLength(0);
    expect(result.updatedTasks[0].data.startDate).toBe("2024-01-15T10:00:00Z");
  });

  it("reports error when regulatory hold overlaps blackout", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
        isRegulatoryHold: true,
        taskType: "regulatoryHold",
      }),
    ];
    const channels = [
      makeChannel("ch-1", "SWIFT", [
        {
          startDate: "2024-01-15T10:30:00Z",
          endDate: "2024-01-15T11:30:00Z",
          reason: "Maintenance",
        },
      ]),
    ];
    const result = scheduleTasks(tasks, channels);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Regulatory hold");
    expect(result.errors[0]).toContain("blackout");
  });

  it("handles empty task list", () => {
    const result = scheduleTasks([], [makeChannel()]);
    expect(result.updatedTasks).toHaveLength(0);
    expect(result.changes).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("pushes task past blackout window", () => {
    // Task starts at 8AM, but 8-9AM is blacked out
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T08:00:00Z",
        endDate: "2024-01-15T09:00:00Z",
        duration: 60,
      }),
    ];
    const channels = [
      makeChannel("ch-1", "SWIFT", [
        {
          startDate: "2024-01-15T08:00:00Z",
          endDate: "2024-01-15T09:00:00Z",
          reason: "Blackout",
        },
      ]),
    ];
    const result = scheduleTasks(tasks, channels);

    const taskA = result.updatedTasks[0];
    expect(taskA.data.startDate).toBe("2024-01-15T09:00:00.000Z");
    expect(taskA.data.endDate).toBe("2024-01-15T10:00:00.000Z");
  });

  it("schedules non-hold task around regulatory hold on same channel", () => {
    // Regulatory hold occupies 10:00-11:00
    // Non-hold task also wants 10:00-11:00 on the same channel, no deps
    // Non-hold should be pushed past the hold
    const tasks = [
      makeTask("hold", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
        isRegulatoryHold: true,
        taskType: "regulatoryHold",
      }),
      makeTask("work", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
      }),
    ];
    const channels = [makeChannel()];
    const result = scheduleTasks(tasks, channels);

    expect(result.errors).toHaveLength(0);
    const workTask = result.updatedTasks.find((t) => t.docId === "work")!;
    // Should start at or after 11:00 (after hold ends)
    expect(workTask.data.startDate).toBe("2024-01-15T11:00:00.000Z");
    expect(workTask.data.endDate).toBe("2024-01-15T12:00:00.000Z");
  });

  it("cascades delays through dependency chain", () => {
    // A delayed → B delayed → C delayed
    // A is now at 14:00, 120 min, so it ends at 16:00 (end of day)
    // B depends on A, C depends on B
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T14:00:00Z",
        endDate: "2024-01-15T16:00:00Z",
        duration: 120,
      }),
      makeTask("B", {
        deps: ["A"],
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        duration: 60,
      }),
      makeTask("C", {
        deps: ["B"],
        startDate: "2024-01-15T11:00:00Z",
        endDate: "2024-01-15T12:00:00Z",
        duration: 60,
      }),
    ];
    const channels = [makeChannel()];
    const result = scheduleTasks(tasks, channels);

    expect(result.errors).toHaveLength(0);
    const taskA = result.updatedTasks.find((t) => t.docId === "A")!;
    const taskB = result.updatedTasks.find((t) => t.docId === "B")!;
    const taskC = result.updatedTasks.find((t) => t.docId === "C")!;

    // A: 14:00-16:00 (unchanged)
    expect(taskA.data.startDate).toBe("2024-01-15T14:00:00.000Z");
    // B: starts after A ends (16:00 → next day 8AM since channel closes at 4PM)
    expect(taskB.data.startDate).toBe("2024-01-16T08:00:00.000Z");
    expect(taskB.data.endDate).toBe("2024-01-16T09:00:00.000Z");
    // C: starts after B ends
    expect(taskC.data.startDate).toBe("2024-01-16T09:00:00.000Z");
    expect(taskC.data.endDate).toBe("2024-01-16T10:00:00.000Z");
  });
});
