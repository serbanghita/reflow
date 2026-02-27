import { DateTime, Interval } from "luxon";
import type {
  SettlementTask,
  SettlementChannel,
  TradeOrder,
  ReflowMetrics,
  SLABreach,
} from "./types.js";
import {
  countAvailableMinutes,
  parseBlackoutWindows,
} from "../utils/date-utils.js";

/**
 * Compute reflow metrics by comparing original vs updated tasks.
 */
export function computeMetrics(
  originalTasks: SettlementTask[],
  updatedTasks: SettlementTask[],
  channels: SettlementChannel[],
  tradeOrders: TradeOrder[]
): ReflowMetrics {
  const originalMap = new Map(originalTasks.map((t) => [t.docId, t]));
  const tradeOrderMap = new Map(tradeOrders.map((o) => [o.docId, o]));
  const channelMap = new Map(channels.map((c) => [c.docId, c]));

  // Delay and affected count
  let totalDelayMinutes = 0;
  let tasksAffected = 0;

  for (const updated of updatedTasks) {
    const original = originalMap.get(updated.docId);
    if (!original) continue;

    const origEnd = DateTime.fromISO(original.data.endDate, { zone: "utc" });
    const newEnd = DateTime.fromISO(updated.data.endDate, { zone: "utc" });
    const delta = newEnd.diff(origEnd, "minutes").minutes;

    if (Math.abs(delta) > 0.001) {
      totalDelayMinutes += delta;
      tasksAffected++;
    }
  }

  // Channel utilization and idle time
  const channelUtilization: Record<string, number> = {};
  const channelIdleMinutes: Record<string, number> = {};

  // Group updated tasks by channel
  const tasksByChannel = new Map<string, SettlementTask[]>();
  for (const task of updatedTasks) {
    const chId = task.data.settlementChannelId;
    if (!tasksByChannel.has(chId)) tasksByChannel.set(chId, []);
    tasksByChannel.get(chId)!.push(task);
  }

  for (const [channelId, channelTasks] of tasksByChannel) {
    const channel = channelMap.get(channelId);
    if (!channel || channelTasks.length === 0) continue;

    // Sort by start time
    const sorted = [...channelTasks].sort((a, b) => {
      const da = DateTime.fromISO(a.data.startDate, { zone: "utc" });
      const db = DateTime.fromISO(b.data.startDate, { zone: "utc" });
      return da.toMillis() - db.toMillis();
    });

    const firstStart = DateTime.fromISO(sorted[0].data.startDate, { zone: "utc" });
    const lastEnd = sorted.reduce((max, t) => {
      const end = DateTime.fromISO(t.data.endDate, { zone: "utc" });
      return end > max ? end : max;
    }, DateTime.fromISO(sorted[0].data.endDate, { zone: "utc" }));

    const blackouts = parseBlackoutWindows(channel.data.blackoutWindows);

    // Total available minutes in the span
    const availableMinutes = countAvailableMinutes(
      firstStart,
      lastEnd,
      channel.data.operatingHours,
      blackouts
    );

    // Total processing minutes (sum of effective durations)
    let processingMinutes = 0;
    for (const task of channelTasks) {
      processingMinutes +=
        (task.data.prepTimeMinutes ?? 0) + task.data.durationMinutes;
    }

    channelUtilization[channelId] =
      availableMinutes > 0
        ? Math.round((processingMinutes / availableMinutes) * 100) / 100
        : 0;

    // Idle time: gaps between consecutive tasks within operating hours
    let idleMinutes = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = DateTime.fromISO(sorted[i].data.endDate, { zone: "utc" });
      const nextStart = DateTime.fromISO(sorted[i + 1].data.startDate, {
        zone: "utc",
      });
      if (nextStart > currentEnd) {
        // Count operating minutes in the gap
        const gapMinutes = countAvailableMinutes(
          currentEnd,
          nextStart,
          channel.data.operatingHours,
          blackouts
        );
        idleMinutes += gapMinutes;
      }
    }
    channelIdleMinutes[channelId] = Math.round(idleMinutes);
  }

  // SLA breaches
  const slaBreaches: SLABreach[] = [];
  for (const updated of updatedTasks) {
    const tradeOrder = tradeOrderMap.get(updated.data.tradeOrderId);
    if (!tradeOrder) continue;

    const targetDate = DateTime.fromISO(tradeOrder.data.settlementDate, {
      zone: "utc",
    });
    const actualEnd = DateTime.fromISO(updated.data.endDate, { zone: "utc" });

    if (actualEnd > targetDate) {
      const breachMinutes = actualEnd.diff(targetDate, "minutes").minutes;
      slaBreaches.push({
        taskId: updated.docId,
        tradeOrderId: tradeOrder.docId,
        targetDate: tradeOrder.data.settlementDate,
        actualEndDate: updated.data.endDate,
        breachMinutes: Math.round(breachMinutes),
      });
    }
  }

  return {
    totalDelayMinutes: Math.round(totalDelayMinutes),
    tasksAffected,
    channelUtilization,
    channelIdleMinutes,
    slaBreaches,
  };
}
