import type { ReflowInput } from "../reflow/types.js";

/**
 * Scenario 4: Channel Contention
 * 3 independent tasks (no dependency relationship) compete for the same channel.
 * Tests greedy scheduling quality — tasks must be sequenced without overlaps,
 * respecting operating hours. Verifies tie-breaking by original startDate.
 *
 * All tasks are 90 min each, channel is Mon-Fri 8AM-4PM.
 * Task A starts 8AM, B starts 8:30AM, C starts 9AM.
 * Expected: A=8:00-9:30, B=9:30-11:00, C=11:00-12:30
 */
export const channelContentionScenario: ReflowInput = {
  settlementTasks: [
    {
      docId: "task-cc-1",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-CC1",
        tradeOrderId: "trade-cc-1",
        settlementChannelId: "ch-ach",
        startDate: "2024-01-15T08:00:00Z",
        endDate: "2024-01-15T09:30:00Z",
        durationMinutes: 90,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "fundTransfer",
      },
    },
    {
      docId: "task-cc-2",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-CC2",
        tradeOrderId: "trade-cc-2",
        settlementChannelId: "ch-ach",
        startDate: "2024-01-15T08:30:00Z",
        endDate: "2024-01-15T10:00:00Z",
        durationMinutes: 90,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "marginCheck",
      },
    },
    {
      docId: "task-cc-3",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-CC3",
        tradeOrderId: "trade-cc-3",
        settlementChannelId: "ch-ach",
        startDate: "2024-01-15T09:00:00Z",
        endDate: "2024-01-15T10:30:00Z",
        durationMinutes: 90,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "disbursement",
      },
    },
  ],
  settlementChannels: [
    {
      docId: "ch-ach",
      docType: "settlementChannel",
      data: {
        name: "ACH",
        operatingHours: [
          { dayOfWeek: 1, startHour: 8, endHour: 16 },
          { dayOfWeek: 2, startHour: 8, endHour: 16 },
          { dayOfWeek: 3, startHour: 8, endHour: 16 },
          { dayOfWeek: 4, startHour: 8, endHour: 16 },
          { dayOfWeek: 5, startHour: 8, endHour: 16 },
        ],
        blackoutWindows: [],
      },
    },
  ],
  tradeOrders: [
    {
      docId: "trade-cc-1",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-20240115-CC1",
        instrumentId: "AAPL",
        quantity: 100,
        settlementDate: "2024-01-16T16:00:00Z",
      },
    },
    {
      docId: "trade-cc-2",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-20240115-CC2",
        instrumentId: "MSFT",
        quantity: 200,
        settlementDate: "2024-01-16T16:00:00Z",
      },
    },
    {
      docId: "trade-cc-3",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-20240115-CC3",
        instrumentId: "GOOGL",
        quantity: 150,
        settlementDate: "2024-01-16T16:00:00Z",
      },
    },
  ],
};
