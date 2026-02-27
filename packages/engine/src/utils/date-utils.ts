import { DateTime, Interval } from "luxon";
import type { OperatingHourSlot, BlackoutWindow } from "../reflow/types.js";

/**
 * Given a date, return the concrete operating window for that day based on the
 * recurring weekly operating hours. Returns null if no slot matches this day.
 */
export function getOperatingWindowsForDate(
  date: DateTime,
  operatingHours: OperatingHourSlot[]
): Interval[] {
  // luxon weekday: 1=Mon...7=Sun; spec dayOfWeek: 0=Sun...6=Sat
  const luxonWeekday = date.weekday; // 1-7
  const specDayOfWeek = luxonWeekday === 7 ? 0 : luxonWeekday; // convert to 0-6

  const windows: Interval[] = [];
  for (const slot of operatingHours) {
    if (slot.dayOfWeek === specDayOfWeek) {
      const start = date.startOf("day").set({ hour: slot.startHour });
      const end = date.startOf("day").set({ hour: slot.endHour });
      if (end > start) {
        windows.push(Interval.fromDateTimes(start, end));
      }
    }
  }
  // Sort by start time
  windows.sort((a, b) => a.start!.toMillis() - b.start!.toMillis());
  return windows;
}

/**
 * Convert blackout windows to luxon Intervals.
 */
export function parseBlackoutWindows(blackouts: BlackoutWindow[]): Interval[] {
  return blackouts.map((b) =>
    Interval.fromDateTimes(
      DateTime.fromISO(b.startDate, { zone: "utc" }),
      DateTime.fromISO(b.endDate, { zone: "utc" })
    )
  );
}

/**
 * Subtract blackout intervals from a set of operating windows.
 * Returns the remaining available windows after blackouts are removed.
 */
export function subtractBlackouts(
  windows: Interval[],
  blackouts: Interval[]
): Interval[] {
  let result = [...windows];
  for (const blackout of blackouts) {
    const next: Interval[] = [];
    for (const w of result) {
      if (!w.overlaps(blackout)) {
        next.push(w);
      } else {
        // Split the window around the blackout
        const diff = w.difference(blackout);
        for (const d of diff) {
          if (d.length("minutes") > 0) {
            next.push(d);
          }
        }
      }
    }
    result = next;
  }
  return result;
}

/**
 * Find the next available operating slot at or after `from`.
 * Enumerates day by day from `from`, building concrete operating windows,
 * subtracting blackouts, and returning the first window that starts at or after `from`.
 *
 * Returns the start of the next available slot, or null if no slot found within maxDays.
 */
export function findNextOperatingSlot(
  from: DateTime,
  operatingHours: OperatingHourSlot[],
  blackouts: Interval[],
  maxDays: number = 365
): DateTime | null {
  let current = from;
  for (let d = 0; d < maxDays; d++) {
    const dayWindows = getOperatingWindowsForDate(current, operatingHours);
    const available = subtractBlackouts(dayWindows, blackouts);
    for (const window of available) {
      // If `from` is within this window, return `from`
      if (window.contains(current) || window.start!.equals(current)) {
        return current;
      }
      // If window starts after `from`, return the window start
      if (window.start! > current) {
        return window.start!;
      }
    }
    // Move to start of next day
    current = current.startOf("day").plus({ days: 1 });
  }
  return null;
}

/**
 * Core function: compute the end datetime after consuming `durationMinutes` of
 * operating time starting from `startTime`.
 *
 * Walks through operating windows day by day, subtracting blackouts,
 * and consumes the duration across available windows.
 *
 * Returns the end datetime (the exact moment when all duration is consumed).
 */
export function computeEndDate(
  startTime: DateTime,
  durationMinutes: number,
  operatingHours: OperatingHourSlot[],
  blackouts: Interval[],
  maxDays: number = 365
): DateTime | null {
  if (durationMinutes <= 0) {
    return startTime;
  }

  let remaining = durationMinutes;
  let current = startTime;

  for (let d = 0; d < maxDays; d++) {
    const dayWindows = getOperatingWindowsForDate(current, operatingHours);
    const available = subtractBlackouts(dayWindows, blackouts);

    for (const window of available) {
      // Determine the effective start within this window
      let effectiveStart: DateTime;
      if (window.contains(current) || window.start!.equals(current)) {
        effectiveStart = current;
      } else if (window.start! > current) {
        effectiveStart = window.start!;
      } else {
        // Window ends before current time, skip
        continue;
      }

      const availableMinutes = window.end!.diff(effectiveStart, "minutes").minutes;
      if (availableMinutes <= 0) continue;

      if (remaining <= availableMinutes) {
        return effectiveStart.plus({ minutes: remaining });
      }

      remaining -= availableMinutes;
    }

    // Move to start of next day
    current = current.startOf("day").plus({ days: 1 });
  }

  return null; // Could not schedule within maxDays
}

/**
 * Count total available operating minutes between two datetimes on a channel.
 * Used for utilization metrics.
 */
export function countAvailableMinutes(
  from: DateTime,
  to: DateTime,
  operatingHours: OperatingHourSlot[],
  blackouts: Interval[]
): number {
  let total = 0;
  let current = from;
  const maxDays = Math.ceil(to.diff(from, "days").days) + 1;

  for (let d = 0; d < maxDays; d++) {
    const dayWindows = getOperatingWindowsForDate(current, operatingHours);
    const available = subtractBlackouts(dayWindows, blackouts);

    for (const window of available) {
      const effectiveStart = DateTime.max(window.start!, from);
      const effectiveEnd = DateTime.min(window.end!, to);
      if (effectiveEnd > effectiveStart) {
        total += effectiveEnd.diff(effectiveStart, "minutes").minutes;
      }
    }

    current = current.startOf("day").plus({ days: 1 });
    if (current > to) break;
  }

  return total;
}

/**
 * Check if a time range overlaps with any blackout window.
 */
export function overlapsBlackout(
  start: DateTime,
  end: DateTime,
  blackouts: Interval[]
): boolean {
  const taskInterval = Interval.fromDateTimes(start, end);
  return blackouts.some((b) => taskInterval.overlaps(b));
}
