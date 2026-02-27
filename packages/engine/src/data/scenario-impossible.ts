import type { ReflowInput } from "../reflow/types.js";

/**
 * Scenario 5a: Circular Dependency
 * Task A depends on B, B depends on A → error before scheduling
 */
export const circularDependencyScenario: ReflowInput = {
  settlementTasks: [
    {
      docId: "task-circ-1",
      docType: "settlementTask",
      data: {
        taskReference: "STL-CIRC-001",
        tradeOrderId: "trade-circ",
        settlementChannelId: "ch-swift-imp",
        startDate: "2024-01-15T09:00:00Z",
        endDate: "2024-01-15T10:00:00Z",
        durationMinutes: 60,
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-circ-2"],
        taskType: "fundTransfer",
      },
    },
    {
      docId: "task-circ-2",
      docType: "settlementTask",
      data: {
        taskReference: "STL-CIRC-002",
        tradeOrderId: "trade-circ",
        settlementChannelId: "ch-swift-imp",
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T11:00:00Z",
        durationMinutes: 60,
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-circ-1"],
        taskType: "marginCheck",
      },
    },
  ],
  settlementChannels: [
    {
      docId: "ch-swift-imp",
      docType: "settlementChannel",
      data: {
        name: "SWIFT-IMP",
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
      docId: "trade-circ",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-CIRC",
        instrumentId: "TSLA",
        quantity: 50,
        settlementDate: "2024-01-16T16:00:00Z",
      },
    },
  ],
};

/**
 * Scenario 5b: Regulatory Hold Conflict
 * A pinned regulatory hold task overlaps a blackout window → error reported
 */
export const regulatoryHoldConflictScenario: ReflowInput = {
  settlementTasks: [
    {
      docId: "task-rh-1",
      docType: "settlementTask",
      data: {
        taskReference: "STL-RH-001",
        tradeOrderId: "trade-rh",
        settlementChannelId: "ch-swift-rh",
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T12:00:00Z",
        durationMinutes: 120,
        isRegulatoryHold: true,
        dependsOnTaskIds: [],
        taskType: "regulatoryHold",
      },
    },
  ],
  settlementChannels: [
    {
      docId: "ch-swift-rh",
      docType: "settlementChannel",
      data: {
        name: "SWIFT-RH",
        operatingHours: [
          { dayOfWeek: 1, startHour: 8, endHour: 16 },
          { dayOfWeek: 2, startHour: 8, endHour: 16 },
          { dayOfWeek: 3, startHour: 8, endHour: 16 },
          { dayOfWeek: 4, startHour: 8, endHour: 16 },
          { dayOfWeek: 5, startHour: 8, endHour: 16 },
        ],
        blackoutWindows: [
          {
            startDate: "2024-01-15T11:00:00Z",
            endDate: "2024-01-15T11:30:00Z",
            reason: "Regulatory system update",
          },
        ],
      },
    },
  ],
  tradeOrders: [
    {
      docId: "trade-rh",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-RH",
        instrumentId: "AMZN",
        quantity: 75,
        settlementDate: "2024-01-16T16:00:00Z",
      },
    },
  ],
};

/**
 * Scenario 5c: Deadline Breach (SLA)
 * Cascading delays cause a task to exceed its T+2 settlement date.
 * A long chain of tasks on a channel with limited hours pushes past the deadline.
 */
export const deadlineBreachScenario: ReflowInput = {
  settlementTasks: [
    {
      docId: "task-dl-1",
      docType: "settlementTask",
      data: {
        taskReference: "STL-DL-001",
        tradeOrderId: "trade-dl",
        settlementChannelId: "ch-swift-dl",
        startDate: "2024-01-15T14:00:00Z", // Monday 2PM, late start
        endDate: "2024-01-15T16:00:00Z",
        durationMinutes: 120,
        isRegulatoryHold: false,
        dependsOnTaskIds: [],
        taskType: "complianceScreen",
      },
    },
    {
      docId: "task-dl-2",
      docType: "settlementTask",
      data: {
        taskReference: "STL-DL-002",
        tradeOrderId: "trade-dl",
        settlementChannelId: "ch-swift-dl",
        startDate: "2024-01-15T10:00:00Z",
        endDate: "2024-01-15T14:00:00Z",
        durationMinutes: 240, // 4 hours
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-dl-1"],
        taskType: "fundTransfer",
      },
    },
    {
      docId: "task-dl-3",
      docType: "settlementTask",
      data: {
        taskReference: "STL-DL-003",
        tradeOrderId: "trade-dl",
        settlementChannelId: "ch-swift-dl",
        startDate: "2024-01-15T14:00:00Z",
        endDate: "2024-01-15T16:00:00Z",
        durationMinutes: 120,
        isRegulatoryHold: false,
        dependsOnTaskIds: ["task-dl-2"],
        taskType: "reconciliation",
      },
    },
  ],
  settlementChannels: [
    {
      docId: "ch-swift-dl",
      docType: "settlementChannel",
      data: {
        name: "SWIFT-DL",
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
      docId: "trade-dl",
      docType: "tradeOrder",
      data: {
        tradeOrderNumber: "TO-DL",
        instrumentId: "NVDA",
        quantity: 400,
        settlementDate: "2024-01-16T12:00:00Z", // tight T+1 deadline at noon
      },
    },
  ],
};
