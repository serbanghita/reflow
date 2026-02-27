// Mirror of engine types for the client side.
// These match the JSON shapes returned by the server API.

export interface SettlementTaskData {
  taskReference: string;
  tradeOrderId: string;
  settlementChannelId: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  isRegulatoryHold: boolean;
  dependsOnTaskIds: string[];
  taskType:
    | "marginCheck"
    | "fundTransfer"
    | "disbursement"
    | "complianceScreen"
    | "reconciliation"
    | "regulatoryHold";
  prepTimeMinutes?: number;
}

export interface SettlementTask {
  docId: string;
  docType: "settlementTask";
  data: SettlementTaskData;
}

export interface OperatingHourSlot {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
}

export interface BlackoutWindow {
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface SettlementChannelData {
  name: string;
  operatingHours: OperatingHourSlot[];
  blackoutWindows: BlackoutWindow[];
}

export interface SettlementChannel {
  docId: string;
  docType: "settlementChannel";
  data: SettlementChannelData;
}

export interface TradeOrderData {
  tradeOrderNumber: string;
  instrumentId: string;
  quantity: number;
  settlementDate: string;
}

export interface TradeOrder {
  docId: string;
  docType: "tradeOrder";
  data: TradeOrderData;
}

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

export interface ScenarioMeta {
  key: string;
  name: string;
  description: string;
}
