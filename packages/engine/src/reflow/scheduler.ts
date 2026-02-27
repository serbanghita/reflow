import { DateTime, Interval } from "luxon";
import type {
  SettlementTask,
  SettlementChannel,
  ScheduleChange,
} from "./types.js";
import { topologicalSort } from "./dag.js";
import {
  computeEndDate,
  findNextOperatingSlot,
  parseBlackoutWindows,
  overlapsBlackout,
} from "../utils/date-utils.js";

export interface ScheduleResult {
  updatedTasks: SettlementTask[];
  changes: ScheduleChange[];
  errors: string[];
}

/**
 * Core scheduling algorithm: greedy earliest-fit.
 *
 * 1. Topological sort tasks (pins regulatory holds in place)
 * 2. For each non-pinned task in topo order:
 *    effectiveStart = max(allDepsCompleted, channelNextAvailable, nextOperatingSlot)
 * 3. Compute end date using operating hours engine
 * 4. Record changes
 */
export function scheduleTasks(
  tasks: SettlementTask[],
  channels: SettlementChannel[]
): ScheduleResult {
  const errors: string[] = [];
  const changes: ScheduleChange[] = [];

  if (tasks.length === 0) {
    return { updatedTasks: [], changes: [], errors: [] };
  }

  // Build lookup maps
  const channelMap = new Map(channels.map((c) => [c.docId, c]));
  const taskMap = new Map(tasks.map((t) => [t.docId, t]));

  // Per-channel blackouts as Intervals
  const channelBlackouts = new Map<string, Interval[]>();
  for (const ch of channels) {
    channelBlackouts.set(ch.docId, parseBlackoutWindows(ch.data.blackoutWindows));
  }

  // Topological sort
  const sortedIds = topologicalSort(tasks);

  // Track: per-channel next available time (greedy scheduling)
  const channelNextAvailable = new Map<string, DateTime>();

  // Pre-seed channelNextAvailable from regulatory holds so non-hold tasks
  // schedule around them even when there's no dependency between them.
  for (const task of tasks) {
    if (!task.data.isRegulatoryHold) continue;
    const channelId = task.data.settlementChannelId;
    const holdEnd = DateTime.fromISO(task.data.endDate, { zone: "utc" });
    const currentAvail = channelNextAvailable.get(channelId);
    if (!currentAvail || holdEnd > currentAvail) {
      channelNextAvailable.set(channelId, holdEnd);
    }
  }

  // Track: per-task computed end time (for dependency resolution)
  const taskEndTimes = new Map<string, DateTime>();

  // Deep copy tasks for mutation
  const updatedTasks = new Map<string, SettlementTask>();
  for (const task of tasks) {
    updatedTasks.set(task.docId, structuredClone(task));
  }

  for (const taskId of sortedIds) {
    const original = taskMap.get(taskId)!;
    const updated = updatedTasks.get(taskId)!;
    const channelId = original.data.settlementChannelId;
    const channel = channelMap.get(channelId);

    if (!channel) {
      errors.push(
        `Task ${original.data.taskReference} references unknown channel ${channelId}`
      );
      // Still record end time so downstream deps can reference it
      taskEndTimes.set(
        taskId,
        DateTime.fromISO(original.data.endDate, { zone: "utc" })
      );
      continue;
    }

    const blackouts = channelBlackouts.get(channelId) ?? [];
    const operatingHours = channel.data.operatingHours;

    // Regulatory hold: pinned — don't move
    if (original.data.isRegulatoryHold) {
      const holdStart = DateTime.fromISO(original.data.startDate, { zone: "utc" });
      const holdEnd = DateTime.fromISO(original.data.endDate, { zone: "utc" });

      // Validate: does it overlap a blackout?
      if (overlapsBlackout(holdStart, holdEnd, blackouts)) {
        errors.push(
          `Regulatory hold ${original.data.taskReference} overlaps blackout window on channel ${channel.data.name}`
        );
      }

      // Update channel availability past this hold
      const currentAvail = channelNextAvailable.get(channelId);
      if (!currentAvail || holdEnd > currentAvail) {
        channelNextAvailable.set(channelId, holdEnd);
      }

      taskEndTimes.set(taskId, holdEnd);
      continue;
    }

    // Compute effective start
    const originalStart = DateTime.fromISO(original.data.startDate, { zone: "utc" });
    const effectiveDuration =
      (original.data.prepTimeMinutes ?? 0) + original.data.durationMinutes;

    // 1. Dependency constraint: start after all deps complete
    let earliest = originalStart;
    for (const depId of original.data.dependsOnTaskIds) {
      const depEnd = taskEndTimes.get(depId);
      if (depEnd && depEnd > earliest) {
        earliest = depEnd;
      }
    }

    // 2. Channel conflict: start after channel is free
    const channelAvail = channelNextAvailable.get(channelId);
    if (channelAvail && channelAvail > earliest) {
      earliest = channelAvail;
    }

    // 3. Operating hours: snap to next operating slot
    const effectiveStart = findNextOperatingSlot(
      earliest,
      operatingHours,
      blackouts
    );
    if (!effectiveStart) {
      errors.push(
        `Cannot find operating slot for task ${original.data.taskReference} within 365 days`
      );
      taskEndTimes.set(taskId, earliest);
      continue;
    }

    // 4. Compute end date
    const effectiveEnd = computeEndDate(
      effectiveStart,
      effectiveDuration,
      operatingHours,
      blackouts
    );
    if (!effectiveEnd) {
      errors.push(
        `Cannot compute end date for task ${original.data.taskReference} within 365 days`
      );
      taskEndTimes.set(taskId, effectiveStart);
      continue;
    }

    // Record changes — compare as DateTime to avoid ISO format mismatches
    const newStartISO = effectiveStart.toISO()!;
    const newEndISO = effectiveEnd.toISO()!;
    const originalEnd = DateTime.fromISO(original.data.endDate, { zone: "utc" });

    const startChanged = !effectiveStart.equals(originalStart);
    const endChanged = !effectiveEnd.equals(originalEnd);

    if (startChanged) {
      const deltaMinutes = effectiveStart
        .diff(originalStart, "minutes").minutes;
      changes.push({
        taskId,
        taskReference: original.data.taskReference,
        field: "startDate",
        oldValue: original.data.startDate,
        newValue: newStartISO,
        deltaMinutes: Math.round(deltaMinutes),
        reason: buildReason(original, earliest, channelAvail, effectiveStart, tasks, taskEndTimes),
      });
    }

    if (endChanged) {
      const deltaMinutes = effectiveEnd.diff(originalEnd, "minutes").minutes;
      changes.push({
        taskId,
        taskReference: original.data.taskReference,
        field: "endDate",
        oldValue: original.data.endDate,
        newValue: newEndISO,
        deltaMinutes: Math.round(deltaMinutes),
        reason: buildReason(original, earliest, channelAvail, effectiveStart, tasks, taskEndTimes),
      });
    }

    // Update the task
    updated.data.startDate = newStartISO;
    updated.data.endDate = newEndISO;

    // Update channel availability
    channelNextAvailable.set(channelId, effectiveEnd);
    taskEndTimes.set(taskId, effectiveEnd);
  }

  return {
    updatedTasks: sortedIds.map((id) => updatedTasks.get(id)!),
    changes,
    errors,
  };
}

function buildReason(
  task: SettlementTask,
  earliest: DateTime,
  channelAvail: DateTime | undefined,
  effectiveStart: DateTime,
  allTasks: SettlementTask[],
  taskEndTimes: Map<string, DateTime>
): string {
  const reasons: string[] = [];
  const originalStart = DateTime.fromISO(task.data.startDate, { zone: "utc" });

  // Check dependency push
  for (const depId of task.data.dependsOnTaskIds) {
    const depEnd = taskEndTimes.get(depId);
    if (depEnd && depEnd > originalStart) {
      const depTask = allTasks.find((t) => t.docId === depId);
      const depRef = depTask?.data.taskReference ?? depId;
      reasons.push(`dependency ${depRef} completes later than original start`);
    }
  }

  // Check channel contention
  if (channelAvail && channelAvail > originalStart) {
    reasons.push("channel occupied by earlier task");
  }

  // Check operating hours snap
  if (effectiveStart > earliest) {
    reasons.push("adjusted to next operating hours window");
  }

  if (reasons.length === 0) {
    reasons.push("cascading schedule adjustment");
  }

  return reasons.join("; ");
}
