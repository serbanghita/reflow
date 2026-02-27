import { describe, it, expect } from "vitest";
import { computeMetrics } from "../reflow/metrics.js";
import type {
  SettlementTask,
  SettlementChannel,
  TradeOrder,
} from "../reflow/types.js";

function makeChannel(id: string = "ch-1"): SettlementChannel {
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
      blackoutWindows: [],
    },
  };
}

function makeTask(
  id: string,
  startDate: string,
  endDate: string,
  duration: number = 60,
  channelId: string = "ch-1"
): SettlementTask {
  return {
    docId: id,
    docType: "settlementTask",
    data: {
      taskReference: `STL-${id}`,
      tradeOrderId: "trade-1",
      settlementChannelId: channelId,
      startDate,
      endDate,
      durationMinutes: duration,
      isRegulatoryHold: false,
      dependsOnTaskIds: [],
      taskType: "fundTransfer",
    },
  };
}

function makeTradeOrder(
  id: string,
  settlementDate: string
): TradeOrder {
  return {
    docId: id,
    docType: "tradeOrder",
    data: {
      tradeOrderNumber: `TO-${id}`,
      instrumentId: "AAPL",
      quantity: 100,
      settlementDate,
    },
  };
}

describe("computeMetrics", () => {
  it("computes delay correctly (positive delay)", () => {
    const original = [
      makeTask("A", "2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
    ];
    const updated = [
      makeTask("A", "2024-01-15T11:00:00Z", "2024-01-15T12:00:00Z"),
    ];
    const channels = [makeChannel()];

    const metrics = computeMetrics(original, updated, channels, []);
    expect(metrics.totalDelayMinutes).toBe(60);
    expect(metrics.tasksAffected).toBe(1);
  });

  it("computes zero delay for unchanged task", () => {
    const original = [
      makeTask("A", "2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
    ];
    const updated = [
      makeTask("A", "2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
    ];
    const channels = [makeChannel()];

    const metrics = computeMetrics(original, updated, channels, []);
    expect(metrics.totalDelayMinutes).toBe(0);
    expect(metrics.tasksAffected).toBe(0);
  });

  it("computes channel utilization", () => {
    // One 60-min task in an 8-hour window = 60/480 = 0.125
    const original = [
      makeTask("A", "2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
    ];
    const updated = [...original];
    const channels = [makeChannel()];

    const metrics = computeMetrics(original, updated, channels, []);
    // Utilization is processingMin / availableMin in the task's span
    // span = 10AM-11AM = 60 available min, task = 60 min → utilization = 1.0
    expect(metrics.channelUtilization["ch-1"]).toBe(1);
  });

  it("computes channel idle time between tasks", () => {
    // Two 60-min tasks with 60-min gap
    const original = [
      makeTask("A", "2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
      makeTask("B", "2024-01-15T12:00:00Z", "2024-01-15T13:00:00Z"),
    ];
    const updated = [...original];
    const channels = [makeChannel()];

    const metrics = computeMetrics(original, updated, channels, []);
    expect(metrics.channelIdleMinutes["ch-1"]).toBe(60);
  });

  it("detects SLA breach", () => {
    const original = [
      makeTask("A", "2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
    ];
    // Task delayed past settlement date
    const updated = [
      makeTask("A", "2024-01-16T10:00:00Z", "2024-01-16T11:00:00Z"),
    ];
    const channels = [makeChannel()];
    const tradeOrders = [
      makeTradeOrder("trade-1", "2024-01-15T16:00:00Z"), // T+1 deadline
    ];

    const metrics = computeMetrics(original, updated, channels, tradeOrders);
    expect(metrics.slaBreaches).toHaveLength(1);
    expect(metrics.slaBreaches[0].taskId).toBe("A");
    expect(metrics.slaBreaches[0].breachMinutes).toBeGreaterThan(0);
  });

  it("no SLA breach when task finishes on time", () => {
    const original = [
      makeTask("A", "2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
    ];
    const updated = [...original];
    const channels = [makeChannel()];
    const tradeOrders = [
      makeTradeOrder("trade-1", "2024-01-15T16:00:00Z"),
    ];

    const metrics = computeMetrics(original, updated, channels, tradeOrders);
    expect(metrics.slaBreaches).toHaveLength(0);
  });
});
