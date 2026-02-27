import { describe, it, expect } from "vitest";
import { checkConstraints } from "../reflow/constraint-checker.js";
import type {
  SettlementTask,
  SettlementChannel,
} from "../reflow/types.js";

function makeChannel(
  id: string = "ch-1",
  blackouts: { startDate: string; endDate: string; reason?: string }[] = []
): SettlementChannel {
  return {
    docId: id,
    docType: "settlementChannel",
    data: {
      name: "SWIFT",
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

describe("checkConstraints", () => {
  it("valid schedule passes all checks", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
      }),
      makeTask("B", {
        deps: ["A"],
        startDate: "2024-01-15T11:00:00Z",
        endDate: "2024-01-15T12:00:00Z",
      }),
    ];
    const channels = [makeChannel()];
    const violations = checkConstraints(tasks, channels);
    expect(violations).toHaveLength(0);
  });

  it("detects overlapping tasks on same channel", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:30:00Z",
      }),
      makeTask("B", {
        startDate: "2024-01-15T11:00:00Z",
        endDate: "2024-01-15T12:00:00Z",
      }),
    ];
    const channels = [makeChannel()];
    const violations = checkConstraints(tasks, channels);
    const overlaps = violations.filter((v) => v.type === "channel_overlap");
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it("detects task outside operating hours", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T18:00:00Z", // past 4PM close
        duration: 480,
      }),
    ];
    const channels = [makeChannel()];
    const violations = checkConstraints(tasks, channels);
    const opHours = violations.filter(
      (v) => v.type === "outside_operating_hours"
    );
    expect(opHours.length).toBeGreaterThan(0);
  });

  it("detects non-reg task with incorrect duration spanning a blackout", () => {
    // Task claims 120 min but the range 10AM-12PM with a 30-min blackout
    // only has 90 available operating minutes → operating hours violation
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T12:00:00Z",
        duration: 120,
      }),
    ];
    const channels = [
      makeChannel("ch-1", [
        {
          startDate: "2024-01-15T11:00:00Z",
          endDate: "2024-01-15T11:30:00Z",
          reason: "Maintenance",
        },
      ]),
    ];
    const violations = checkConstraints(tasks, channels);
    const opHours = violations.filter(
      (v) => v.type === "outside_operating_hours"
    );
    expect(opHours.length).toBeGreaterThan(0);
  });

  it("detects regulatory hold overlapping blackout", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T12:00:00Z",
        isRegulatoryHold: true,
      }),
    ];
    const channels = [
      makeChannel("ch-1", [
        {
          startDate: "2024-01-15T11:00:00Z",
          endDate: "2024-01-15T11:30:00Z",
          reason: "Maintenance",
        },
      ]),
    ];
    const violations = checkConstraints(tasks, channels);
    const blackouts = violations.filter((v) => v.type === "blackout_overlap");
    expect(blackouts.length).toBeGreaterThan(0);
  });

  it("detects dependency violation", () => {
    // B starts before A ends
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
      }),
      makeTask("B", {
        deps: ["A"],
        startDate: "2024-01-15T10:30:00Z",
        endDate: "2024-01-15T11:30:00Z",
      }),
    ];
    const channels = [makeChannel()];
    const violations = checkConstraints(tasks, channels);
    const depViolations = violations.filter(
      (v) => v.type === "dependency_violated"
    );
    expect(depViolations.length).toBeGreaterThan(0);
  });

  it("detects regulatory hold that was moved", () => {
    const originalTasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        isRegulatoryHold: true,
      }),
    ];
    // Simulate the hold being moved (should never happen, but defense-in-depth)
    const updatedTasks = [
      makeTask("A", {
        startDate: "2024-01-15T11:00:00Z",
        endDate: "2024-01-15T12:00:00Z",
        isRegulatoryHold: true,
      }),
    ];
    const channels = [makeChannel()];
    const violations = checkConstraints(updatedTasks, channels, originalTasks);
    const holdMoved = violations.filter(
      (v) => v.type === "regulatory_hold_moved"
    );
    expect(holdMoved.length).toBeGreaterThan(0);
    expect(holdMoved[0].message).toContain("was moved");
  });

  it("does not flag unmoved regulatory hold", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        isRegulatoryHold: true,
      }),
    ];
    const channels = [makeChannel()];
    const violations = checkConstraints(tasks, channels, tasks);
    const holdMoved = violations.filter(
      (v) => v.type === "regulatory_hold_moved"
    );
    expect(holdMoved).toHaveLength(0);
  });

  it("skips operating hours check for regulatory holds", () => {
    const tasks = [
      makeTask("A", {
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T18:00:00Z",
        isRegulatoryHold: true,
      }),
    ];
    const channels = [makeChannel()];
    const violations = checkConstraints(tasks, channels);
    const opHours = violations.filter(
      (v) => v.type === "outside_operating_hours"
    );
    expect(opHours).toHaveLength(0);
  });
});
