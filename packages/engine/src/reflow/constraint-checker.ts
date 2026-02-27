import { DateTime, Interval } from "luxon";
import type { SettlementTask, SettlementChannel } from "./types.js";
import {
  parseBlackoutWindows,
  overlapsBlackout,
  countAvailableMinutes,
  findNextOperatingSlot,
} from "../utils/date-utils.js";

export interface ConstraintViolation {
  type:
    | "channel_overlap"
    | "outside_operating_hours"
    | "blackout_overlap"
    | "dependency_violated"
    | "regulatory_hold_moved";
  taskId: string;
  taskReference: string;
  message: string;
}

/**
 * Post-reflow constraint validation.
 * Checks all hard constraints on the scheduled output to prove correctness.
 *
 * @param tasks - Updated tasks after scheduling
 * @param channels - Settlement channels
 * @param originalTasks - Original tasks before scheduling (for regulatory hold moved check)
 */
export function checkConstraints(
  tasks: SettlementTask[],
  channels: SettlementChannel[],
  originalTasks?: SettlementTask[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const channelMap = new Map(channels.map((c) => [c.docId, c]));
  const taskMap = new Map(tasks.map((t) => [t.docId, t]));

  // Spec order: Dependencies → Channel → Operating Hours → Blackouts → Regulatory Hold Moved
  // 1. Check dependency ordering
  violations.push(...checkDependencies(tasks, taskMap));

  // 2. Check channel overlaps
  violations.push(...checkChannelOverlaps(tasks));

  // 3. Check operating hours
  violations.push(...checkOperatingHours(tasks, channelMap));

  // 4. Check blackout overlaps
  violations.push(...checkBlackoutOverlaps(tasks, channelMap));

  // 5. Check regulatory holds weren't moved
  if (originalTasks) {
    violations.push(...checkRegulatoryHoldMoved(tasks, originalTasks));
  }

  return violations;
}

/**
 * Check that no two non-regulatory-hold tasks on the same channel overlap in time.
 */
function checkChannelOverlaps(tasks: SettlementTask[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  // Group tasks by channel
  const byChannel = new Map<string, SettlementTask[]>();
  for (const task of tasks) {
    const channelId = task.data.settlementChannelId;
    if (!byChannel.has(channelId)) byChannel.set(channelId, []);
    byChannel.get(channelId)!.push(task);
  }

  for (const [, channelTasks] of byChannel) {
    // Sort by start date
    const sorted = [...channelTasks].sort((a, b) => {
      const da = DateTime.fromISO(a.data.startDate, { zone: "utc" });
      const db = DateTime.fromISO(b.data.startDate, { zone: "utc" });
      return da.toMillis() - db.toMillis();
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = DateTime.fromISO(sorted[i].data.endDate, { zone: "utc" });
      const nextStart = DateTime.fromISO(sorted[i + 1].data.startDate, {
        zone: "utc",
      });

      if (currentEnd > nextStart) {
        violations.push({
          type: "channel_overlap",
          taskId: sorted[i + 1].docId,
          taskReference: sorted[i + 1].data.taskReference,
          message: `Task ${sorted[i + 1].data.taskReference} overlaps with ${sorted[i].data.taskReference} on the same channel`,
        });
      }
    }
  }

  return violations;
}

/**
 * Check that all task processing falls within operating hours.
 *
 * A task is valid if:
 * 1. Its start time falls within (or at the boundary of) an operating window
 * 2. Its end time falls within (or at the boundary of) an operating window
 * 3. The available operating minutes between start and end equals
 *    the task's effective duration (prep + processing)
 *
 * This correctly handles tasks that span overnight or weekends by pausing
 * at close and resuming at open.
 */
function checkOperatingHours(
  tasks: SettlementTask[],
  channelMap: Map<string, SettlementChannel>
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const task of tasks) {
    if (task.data.isRegulatoryHold) continue;

    const channel = channelMap.get(task.data.settlementChannelId);
    if (!channel) continue;

    const start = DateTime.fromISO(task.data.startDate, { zone: "utc" });
    const end = DateTime.fromISO(task.data.endDate, { zone: "utc" });
    const blackouts = parseBlackoutWindows(channel.data.blackoutWindows);
    const effectiveDuration =
      (task.data.prepTimeMinutes ?? 0) + task.data.durationMinutes;

    // Check that start is at a valid operating slot
    const nextSlot = findNextOperatingSlot(
      start,
      channel.data.operatingHours,
      blackouts
    );
    if (!nextSlot || !nextSlot.equals(start)) {
      violations.push({
        type: "outside_operating_hours",
        taskId: task.docId,
        taskReference: task.data.taskReference,
        message: `Task ${task.data.taskReference} starts outside operating hours`,
      });
      continue;
    }

    // Check that available operating minutes between start and end
    // matches the effective duration
    const available = countAvailableMinutes(
      start,
      end,
      channel.data.operatingHours,
      blackouts
    );
    if (Math.abs(available - effectiveDuration) > 0.5) {
      violations.push({
        type: "outside_operating_hours",
        taskId: task.docId,
        taskReference: task.data.taskReference,
        message: `Task ${task.data.taskReference} has processing time outside operating hours (expected ${effectiveDuration} min, found ${Math.round(available)} available min in range)`,
      });
    }
  }

  return violations;
}

/**
 * Check blackout overlaps for regulatory hold tasks only.
 *
 * Non-regulatory tasks that span a blackout are valid — they pause during
 * the blackout and resume after. The operating hours check already verifies
 * that their effective duration matches available operating minutes (which
 * excludes blackouts). So blackout overlap is only a problem for pinned
 * regulatory hold tasks that cannot be moved.
 */
function checkBlackoutOverlaps(
  tasks: SettlementTask[],
  channelMap: Map<string, SettlementChannel>
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const task of tasks) {
    // Only check regulatory holds — they are pinned and can't avoid blackouts
    if (!task.data.isRegulatoryHold) continue;

    const channel = channelMap.get(task.data.settlementChannelId);
    if (!channel) continue;

    const start = DateTime.fromISO(task.data.startDate, { zone: "utc" });
    const end = DateTime.fromISO(task.data.endDate, { zone: "utc" });
    const blackouts = parseBlackoutWindows(channel.data.blackoutWindows);

    if (overlapsBlackout(start, end, blackouts)) {
      violations.push({
        type: "blackout_overlap",
        taskId: task.docId,
        taskReference: task.data.taskReference,
        message: `Regulatory hold ${task.data.taskReference} overlaps a blackout window and cannot be moved`,
      });
    }
  }

  return violations;
}

/**
 * Check that all dependencies are satisfied: upstream task ends before downstream starts.
 */
function checkDependencies(
  tasks: SettlementTask[],
  taskMap: Map<string, SettlementTask>
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const task of tasks) {
    for (const depId of task.data.dependsOnTaskIds) {
      const upstream = taskMap.get(depId);
      if (!upstream) continue;

      const upstreamEnd = DateTime.fromISO(upstream.data.endDate, { zone: "utc" });
      const downstreamStart = DateTime.fromISO(task.data.startDate, {
        zone: "utc",
      });

      if (downstreamStart < upstreamEnd) {
        violations.push({
          type: "dependency_violated",
          taskId: task.docId,
          taskReference: task.data.taskReference,
          message: `Task ${task.data.taskReference} starts before dependency ${upstream.data.taskReference} completes`,
        });
      }
    }
  }

  return violations;
}

/**
 * Check that regulatory hold tasks were not moved from their original dates.
 * Defense-in-depth: the scheduler should never move holds, but we verify.
 */
function checkRegulatoryHoldMoved(
  updatedTasks: SettlementTask[],
  originalTasks: SettlementTask[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const originalMap = new Map(originalTasks.map((t) => [t.docId, t]));

  for (const task of updatedTasks) {
    if (!task.data.isRegulatoryHold) continue;

    const original = originalMap.get(task.docId);
    if (!original) continue;

    if (
      task.data.startDate !== original.data.startDate ||
      task.data.endDate !== original.data.endDate
    ) {
      violations.push({
        type: "regulatory_hold_moved",
        taskId: task.docId,
        taskReference: task.data.taskReference,
        message: `Regulatory hold ${task.data.taskReference} was moved from its original schedule (${original.data.startDate} - ${original.data.endDate} → ${task.data.startDate} - ${task.data.endDate})`,
      });
    }
  }

  return violations;
}
