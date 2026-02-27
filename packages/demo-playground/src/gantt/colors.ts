const TASK_COLORS: Record<string, string> = {
  fundTransfer: "#3B82F6",
  marginCheck: "#F59E0B",
  disbursement: "#10B981",
  complianceScreen: "#8B5CF6",
  reconciliation: "#6366F1",
  regulatoryHold: "#EF4444",
};

export function getTaskColor(taskType: string): string {
  return TASK_COLORS[taskType] ?? "#64748b";
}
