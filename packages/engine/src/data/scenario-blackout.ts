import type { ReflowInput } from "../reflow/types.js";

/**
 * Scenario 2: Market Hours + Blackout
 * A 120-min settlement task starts Mon 3PM on a channel with Mon-Fri 8AM-4PM hours.
 * Tuesday 8-9AM has a Fedwire blackout.
 * Task pauses at 4PM Mon → resumes Tue 9AM (skipping blackout) → completes Tue 10AM.
 */
export const blackoutScenario: ReflowInput = {
  settlementTasks: [
    {
      docId: "task-1",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-010",
        tradeOrderId: "trade-2",
        settlementChannelId: "ch-fedwire",
        startDate: "2024-01-15T15:00:00Z", // Monday 3PM
        endDate: "2024-01-15T17:00:00Z", // naive: 3PM + 2h = 5PM (wrong!)
        durationMinutes: 120,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "fundTransfer",
      },
    },
  ],
  settlementChannels: [
    {
      docId: "ch-fedwire",
      docType: "settlementChannel",
      data: {
        name: "Fedwire",
        operatingHours: [
          { dayOfWeek: 1, startHour: 8, endHour: 16 },
          { dayOfWeek: 2, startHour: 8, endHour: 16 },
          { dayOfWeek: 3, startHour: 8, endHour: 16 },
          { dayOfWeek: 4, startHour: 8, endHour: 16 },
          { dayOfWeek: 5, startHour: 8, endHour: 16 },
        ],
        blackoutWindows: [
          {
            startDate: "2024-01-16T08:00:00Z",
            endDate: "2024-01-16T09:00:00Z",
            reason: "Fedwire scheduled maintenance",
          },
        ],
      },
    },
  ],
  tradeOrders: [
    {
      docId: "trade-2",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-20240115-002",
        instrumentId: "MSFT",
        quantity: 200,
        settlementDate: "2024-01-17T16:00:00Z", // T+2
      },
    },
  ],
};
