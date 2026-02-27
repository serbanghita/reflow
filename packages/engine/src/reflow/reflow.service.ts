import type {
  ReflowInput,
  ReflowResult,
  SettlementTask,
} from "./types.js";
import { scheduleTasks } from "./scheduler.js";
import { checkConstraints } from "./constraint-checker.js";
import { computeMetrics } from "./metrics.js";
import { CycleError } from "./dag.js";

export class ReflowService {
  reflow(input: ReflowInput): ReflowResult {
    const { settlementTasks, settlementChannels, tradeOrders } = input;

    // Handle empty input
    if (settlementTasks.length === 0) {
      return {
        updatedTasks: [],
        changes: [],
        explanation: ["No tasks to schedule."],
        metrics: {
          totalDelayMinutes: 0,
          tasksAffected: 0,
          channelUtilization: {},
          channelIdleMinutes: {},
          slaBreaches: [],
        },
        errors: [],
      };
    }

    // Deep copy originals for comparison
    const originalTasks: SettlementTask[] = structuredClone(settlementTasks);

    try {
      // Run scheduler
      const scheduleResult = scheduleTasks(settlementTasks, settlementChannels);

      // Post-reflow constraint validation
      const violations = checkConstraints(
        scheduleResult.updatedTasks,
        settlementChannels,
        originalTasks
      );
      const constraintErrors = violations.map((v) => v.message);

      // Compute metrics
      const metrics = computeMetrics(
        originalTasks,
        scheduleResult.updatedTasks,
        settlementChannels,
        tradeOrders
      );

      // Build human-readable explanations
      const explanation = buildExplanation(
        scheduleResult.changes,
        metrics,
        scheduleResult.errors,
        constraintErrors
      );

      return {
        updatedTasks: scheduleResult.updatedTasks,
        changes: scheduleResult.changes,
        explanation,
        metrics,
        errors: [...scheduleResult.errors, ...constraintErrors],
      };
    } catch (err) {
      if (err instanceof CycleError) {
        return {
          updatedTasks: originalTasks,
          changes: [],
          explanation: [
            `Scheduling aborted: ${err.message}`,
            "Please resolve circular dependencies before reflow.",
          ],
          metrics: {
            totalDelayMinutes: 0,
            tasksAffected: 0,
            channelUtilization: {},
            channelIdleMinutes: {},
            slaBreaches: [],
          },
          errors: [err.message],
        };
      }
      throw err;
    }
  }
}

function buildExplanation(
  changes: ReflowResult["changes"],
  metrics: ReflowResult["metrics"],
  schedulerErrors: string[],
  constraintErrors: string[]
): string[] {
  const lines: string[] = [];

  if (changes.length === 0 && schedulerErrors.length === 0) {
    lines.push("No schedule changes were necessary. All tasks remain as originally scheduled.");
    return lines;
  }

  // Group changes by task
  const byTask = new Map<string, typeof changes>();
  for (const change of changes) {
    if (!byTask.has(change.taskReference)) byTask.set(change.taskReference, []);
    byTask.get(change.taskReference)!.push(change);
  }

  for (const [taskRef, taskChanges] of byTask) {
    const startChange = taskChanges.find((c) => c.field === "startDate");
    const endChange = taskChanges.find((c) => c.field === "endDate");

    if (startChange && endChange) {
      lines.push(
        `${taskRef}: moved from ${startChange.oldValue} → ${startChange.newValue} ` +
        `(+${startChange.deltaMinutes} min). Reason: ${startChange.reason}`
      );
    } else if (endChange) {
      lines.push(
        `${taskRef}: end date changed from ${endChange.oldValue} → ${endChange.newValue} ` +
        `(+${endChange.deltaMinutes} min). Reason: ${endChange.reason}`
      );
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${metrics.tasksAffected} task(s) affected, ` +
    `total delay: ${metrics.totalDelayMinutes} minutes.`
  );

  if (metrics.slaBreaches.length > 0) {
    lines.push(
      `WARNING: ${metrics.slaBreaches.length} SLA breach(es) detected.`
    );
    for (const breach of metrics.slaBreaches) {
      lines.push(
        `  - Task ${breach.taskId}: exceeds target ${breach.targetDate} by ${breach.breachMinutes} minutes`
      );
    }
  }

  if (schedulerErrors.length > 0 || constraintErrors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const err of [...schedulerErrors, ...constraintErrors]) {
      lines.push(`  - ${err}`);
    }
  }

  return lines;
}
