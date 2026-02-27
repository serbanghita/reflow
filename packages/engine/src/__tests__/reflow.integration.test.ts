import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { ReflowService } from "../reflow/reflow.service.js";
import { checkConstraints } from "../reflow/constraint-checker.js";
import { delayCascadeScenario } from "../data/scenario-delay-cascade.js";
import { blackoutScenario } from "../data/scenario-blackout.js";
import { multiConstraintScenario } from "../data/scenario-multi-constraint.js";
import { channelContentionScenario } from "../data/scenario-channel-contention.js";
import {
  circularDependencyScenario,
  regulatoryHoldConflictScenario,
  deadlineBreachScenario,
} from "../data/scenario-impossible.js";

const service = new ReflowService();

function utc(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: "utc" });
}

describe("Integration: Scenario 1 — Delay Cascade", () => {
  const result = service.reflow(delayCascadeScenario);

  it("produces no constraint violations in updated tasks", () => {
    const violations = checkConstraints(
      result.updatedTasks,
      delayCascadeScenario.settlementChannels
    );
    expect(violations).toHaveLength(0);
  });

  it("has changes for downstream tasks", () => {
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("maintains dependency ordering: fundTransfer → marginCheck → disbursement → reconciliation", () => {
    const tasks = result.updatedTasks;
    const byId = new Map(tasks.map((t) => [t.docId, t]));

    const t1End = utc(byId.get("task-1")!.data.endDate);
    const t2Start = utc(byId.get("task-2")!.data.startDate);
    const t2End = utc(byId.get("task-2")!.data.endDate);
    const t3Start = utc(byId.get("task-3")!.data.startDate);
    const t3End = utc(byId.get("task-3")!.data.endDate);
    const t4Start = utc(byId.get("task-4")!.data.startDate);

    expect(t2Start >= t1End).toBe(true);
    expect(t3Start >= t2End).toBe(true);
    expect(t4Start >= t3End).toBe(true);
  });

  it("has human-readable explanations", () => {
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.explanation.some((e) => e.includes("STL-"))).toBe(true);
  });

  it("metrics show affected tasks and positive delay", () => {
    expect(result.metrics.tasksAffected).toBeGreaterThan(0);
    expect(result.metrics.totalDelayMinutes).toBeGreaterThan(0);
  });
});

describe("Integration: Scenario 2 — Market Hours + Blackout", () => {
  const result = service.reflow(blackoutScenario);

  it("produces no constraint violations", () => {
    const violations = checkConstraints(
      result.updatedTasks,
      blackoutScenario.settlementChannels
    );
    expect(violations).toHaveLength(0);
  });

  it("correctly schedules 120-min task across Mon close + Tue blackout", () => {
    const task = result.updatedTasks[0];
    // Start: Mon 3PM (unchanged)
    expect(task.data.startDate).toBe("2024-01-15T15:00:00.000Z");
    // End: Tue 10AM (1h Mon 3-4PM + skip blackout 8-9AM + 1h Tue 9-10AM)
    expect(task.data.endDate).toBe("2024-01-16T10:00:00.000Z");
  });

  it("has change records for the end date", () => {
    const endChange = result.changes.find((c) => c.field === "endDate");
    expect(endChange).toBeDefined();
  });
});

describe("Integration: Scenario 3 — Multi-Constraint", () => {
  const result = service.reflow(multiConstraintScenario);

  it("produces no constraint violations", () => {
    const violations = checkConstraints(
      result.updatedTasks,
      multiConstraintScenario.settlementChannels
    );
    expect(violations).toHaveLength(0);
  });

  it("task B starts after blackout ends", () => {
    const taskB = result.updatedTasks.find((t) => t.docId === "task-mc-2")!;
    expect(utc(taskB.data.startDate) >= utc("2024-01-15T10:00:00Z")).toBe(true);
  });

  it("task C starts after task B ends (channel conflict)", () => {
    const taskB = result.updatedTasks.find((t) => t.docId === "task-mc-2")!;
    const taskC = result.updatedTasks.find((t) => t.docId === "task-mc-3")!;
    expect(utc(taskC.data.startDate) >= utc(taskB.data.endDate)).toBe(true);
  });

  it("no tasks process during the 9-10AM blackout", () => {
    for (const task of result.updatedTasks) {
      const start = utc(task.data.startDate);
      const end = utc(task.data.endDate);
      const blackoutStart = utc("2024-01-15T09:00:00Z");
      const blackoutEnd = utc("2024-01-15T10:00:00Z");

      // Task should not span the blackout (start before, end after)
      if (start < blackoutEnd && end > blackoutStart) {
        // If it overlaps, the task's wall-clock range must not include processing during blackout
        // For non-spanning tasks, start should be >= blackoutEnd or end <= blackoutStart
        expect(start >= blackoutEnd || end <= blackoutStart).toBe(true);
      }
    }
  });
});

describe("Integration: Scenario 4 — Channel Contention", () => {
  const result = service.reflow(channelContentionScenario);

  it("produces no constraint violations", () => {
    const violations = checkConstraints(
      result.updatedTasks,
      channelContentionScenario.settlementChannels
    );
    expect(violations).toHaveLength(0);
  });

  it("sequences tasks without overlaps", () => {
    const sorted = [...result.updatedTasks].sort((a, b) =>
      utc(a.data.startDate).toMillis() - utc(b.data.startDate).toMillis()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(
        utc(sorted[i + 1].data.startDate) >= utc(sorted[i].data.endDate)
      ).toBe(true);
    }
  });

  it("respects original startDate ordering (tie-breaking)", () => {
    const sorted = [...result.updatedTasks].sort((a, b) =>
      utc(a.data.startDate).toMillis() - utc(b.data.startDate).toMillis()
    );
    // CC1 (8AM) should be first, CC2 (8:30AM) second, CC3 (9AM) third
    expect(sorted[0].docId).toBe("task-cc-1");
    expect(sorted[1].docId).toBe("task-cc-2");
    expect(sorted[2].docId).toBe("task-cc-3");
  });

  it("task A starts at original time (no conflict for first)", () => {
    const taskA = result.updatedTasks.find((t) => t.docId === "task-cc-1")!;
    expect(taskA.data.startDate).toBe("2024-01-15T08:00:00.000Z");
    expect(taskA.data.endDate).toBe("2024-01-15T09:30:00.000Z");
  });
});

describe("Integration: Scenario 5a — Circular Dependency", () => {
  const result = service.reflow(circularDependencyScenario);

  it("reports error about circular dependency", () => {
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Circular dependency");
  });

  it("makes no changes", () => {
    expect(result.changes).toHaveLength(0);
  });
});

describe("Integration: Scenario 5b — Regulatory Hold Conflict", () => {
  const result = service.reflow(regulatoryHoldConflictScenario);

  it("reports error about regulatory hold overlapping blackout", () => {
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("Regulatory hold"))).toBe(true);
    expect(result.errors.some((e) => e.includes("blackout"))).toBe(true);
  });

  it("does not move the regulatory hold task", () => {
    const task = result.updatedTasks[0];
    expect(task.data.startDate).toBe("2024-01-15T10:00:00Z");
    expect(task.data.endDate).toBe("2024-01-15T12:00:00Z");
  });
});

describe("Integration: Scenario 5c — Deadline Breach", () => {
  const result = service.reflow(deadlineBreachScenario);

  it("detects SLA breach", () => {
    expect(result.metrics.slaBreaches.length).toBeGreaterThan(0);
  });

  it("breach is for the final task exceeding trade order settlement date", () => {
    const breach = result.metrics.slaBreaches.find(
      (b) => b.taskId === "task-dl-3"
    );
    expect(breach).toBeDefined();
    expect(breach!.breachMinutes).toBeGreaterThan(0);
  });
});
