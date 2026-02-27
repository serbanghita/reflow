import type { ReflowInput } from "../reflow/types.js";

/**
 * Scenario 1: Delay Cascade
 * A fund transfer arrives 3 hours late → margin check, disbursement,
 * and reconciliation all shift downstream.
 *
 * Chain: fundTransfer → marginCheck → disbursement → reconciliation
 * All on the same channel (SWIFT), Mon-Fri 8AM-4PM.
 * Fund transfer was supposed to start at 9AM but starts at 12PM (3h late).
 */
export const delayCascadeScenario: ReflowInput = {
  settlementTasks: [
    {
      docId: "task-1",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-001",
        tradeOrderId: "trade-1",
        settlementChannelId: "ch-swift",
        startDate: "2024-01-15T12:00:00Z", // 3h late (was 9AM)
        endDate: "2024-01-15T13:00:00Z",
        durationMinutes: 60,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "fundTransfer",
      },
    },
    {
      docId: "task-2",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-002",
        tradeOrderId: "trade-1",
        settlementChannelId: "ch-swift",
        startDate: "2024-01-15T10:00:00Z", // originally after 9AM transfer
        endDate: "2024-01-15T11:00:00Z",
        durationMinutes: 60,
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-1"],
        taskType: "marginCheck",
      },
    },
    {
      docId: "task-3",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-003",
        tradeOrderId: "trade-1",
        settlementChannelId: "ch-swift",
        startDate: "2024-01-15T11:00:00Z",
        endDate: "2024-01-15T12:30:00Z",
        durationMinutes: 90,
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-2"],
        taskType: "disbursement",
      },
    },
    {
      docId: "task-4",
      docType: "settlementTask",
      data: {
        taskReference: "STL-20240115-004",
        tradeOrderId: "trade-1",
        settlementChannelId: "ch-swift",
        startDate: "2024-01-15T12:30:00Z",
        endDate: "2024-01-15T13:00:00Z",
        durationMinutes: 30,
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-3"],
        taskType: "reconciliation",
      },
    },
  ],
  settlementChannels: [
    {
      docId: "ch-swift",
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
    },
  ],
  tradeOrders: [
    {
      docId: "trade-1",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-20240115-001",
        instrumentId: "AAPL",
        quantity: 500,
        settlementDate: "2024-01-16T16:00:00Z", // T+1
      },
    },
  ],
};
