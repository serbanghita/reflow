import type { ReflowInput } from "../reflow/types.js";

/**
 * Scenario 3: Multi-Constraint
 * Two tasks on the same channel, one has an upstream dependency that
 * completes during a blackout. Tests all constraints simultaneously:
 * dependencies + channel conflict + operating hours + blackout.
 *
 * Setup:
 * - Task A (complianceScreen): 8AM-9AM Mon on Fedwire (no deps)
 * - Task B (fundTransfer): originally 9AM-10AM Mon, depends on A
 *   → A completes at 9AM, but channel has 9-10AM blackout on Monday
 *   → B should start at 10AM
 * - Task C (disbursement): originally 9:30AM-10:30AM Mon, same channel, no dep on A/B
 *   → But channel is occupied by B from 10-11AM
 *   → C should start at 11AM
 */
export const multiConstraintScenario: ReflowInput = {
  settlementTasks: [
    {
      docId: "task-mc-1",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-MC1",
        tradeOrderId: "trade-mc",
        settlementChannelId: "ch-fedwire-mc",
        startDate: "2024-01-15T08:00:00Z",
        endDate: "2024-01-15T09:00:00Z",
        durationMinutes: 60,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "complianceScreen",
      },
    },
    {
      docId: "task-mc-2",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-MC2",
        tradeOrderId: "trade-mc",
        settlementChannelId: "ch-fedwire-mc",
        startDate: "2024-01-15T09:00:00Z",
        endDate: "2024-01-15T10:00:00Z",
        durationMinutes: 60,
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-mc-1"],
        taskType: "fundTransfer",
      },
    },
    {
      docId: "task-mc-3",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-MC3",
        tradeOrderId: "trade-mc",
        settlementChannelId: "ch-fedwire-mc",
        startDate: "2024-01-15T09:30:00Z",
        endDate: "2024-01-15T10:30:00Z",
        durationMinutes: 60,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "disbursement",
      },
    },
  ],
  settlementChannels: [
    {
      docId: "ch-fedwire-mc",
      docType: "settlementChannel",
      data: {
        name: "Fedwire-MC",
        operatingHours: [
          { dayOfWeek: 1, startHour: 8, endHour: 16 },
          { dayOfWeek: 2, startHour: 8, endHour: 16 },
          { dayOfWeek: 3, startHour: 8, endHour: 16 },
          { dayOfWeek: 4, startHour: 8, endHour: 16 },
          { dayOfWeek: 5, startHour: 8, endHour: 16 },
        ],
        blackoutWindows: [
          {
            startDate: "2024-01-15T09:00:00Z",
            endDate: "2024-01-15T10:00:00Z",
            reason: "System maintenance",
          },
        ],
      },
    },
  ],
  tradeOrders: [
    {
      docId: "trade-mc",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-20240115-MC",
        instrumentId: "GOOGL",
        quantity: 300,
        settlementDate: "2024-01-16T16:00:00Z",
      },
    },
  ],
};
