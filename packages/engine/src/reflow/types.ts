// Base document wrapper (spec p.4-6)
export interface Document<T extends string, D> {
  docId: string;
  docType: T;
  data: D;
}

// Settlement Task (spec p.4-5)
export interface SettlementTaskData {
  taskReference: string;
  tradeOrderId: string;
  settlementChannelId: string;
  startDate: string; // ISO 8601, UTC
  endDate: string; // ISO 8601, UTC
  durationMinutes: number;
  isRegulatoryHold: boolean;
  dependsOnTaskIds: string[]; // docIds of upstream tasks
  taskType:
    | "marginCheck"
    | "fundTransfer"
    | "disbursement"
    | "complianceScreen"
    | "reconciliation"
    | "regulatoryHold";
  prepTimeMinutes?: number;
}
export type SettlementTask = Document<"settlementTask", SettlementTaskData>;

// Settlement Channel (spec p.5)
export interface OperatingHourSlot {
  dayOfWeek: number; // 0-6, Sunday=0 (recurring weekly)
  startHour: number; // 0-23
  endHour: number; // 0-23
}

export interface BlackoutWindow {
  startDate: string; // ISO 8601, UTC (absolute)
  endDate: string; // ISO 8601, UTC (absolute)
  reason?: string;
}

export interface SettlementChannelData {
  name: string;
  operatingHours: OperatingHourSlot[];
  blackoutWindows: BlackoutWindow[];
}
export type SettlementChannel = Document<
  "settlementChannel",
  SettlementChannelData
>;

// Trade Order (spec p.6)
export interface TradeOrderData {
  tradeOrderNumber: string;
  instrumentId: string;
  quantity: number;
  settlementDate: string; // target date (T+1, T+2 etc.)
}
export type TradeOrder = Document<"tradeOrder", TradeOrderData>;

// Output types
export interface ScheduleChange {
  taskId: string;
  taskReference: string;
  field: "startDate" | "endDate";
  oldValue: string;
  newValue: string;
  deltaMinutes: number;
  reason: string;
}

export interface SLABreach {
  taskId: string;
  tradeOrderId: string;
  targetDate: string;
  actualEndDate: string;
  breachMinutes: number;
}

export interface ReflowMetrics {
  totalDelayMinutes: number;
  tasksAffected: number;
  channelUtilization: Record<string, number>;
  channelIdleMinutes: Record<string, number>;
  slaBreaches: SLABreach[];
}

export interface ReflowResult {
  updatedTasks: SettlementTask[];
  changes: ScheduleChange[];
  explanation: string[];
  metrics: ReflowMetrics;
  errors: string[];
}

export interface ReflowInput {
  settlementTasks: SettlementTask[];
  settlementChannels: SettlementChannel[];
  tradeOrders: TradeOrder[];
}
