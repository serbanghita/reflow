/**
 * Pure utility: converts between DateTime (as ISO strings/timestamps)
 * and pixel positions on the Gantt chart X-axis.
 */
export interface TimeScaleConfig {
  /** Start of the visible time range (ms since epoch) */
  startMs: number;
  /** End of the visible time range (ms since epoch) */
  endMs: number;
  /** Pixels per minute */
  pixelsPerMinute: number;
  /** Left padding in pixels for channel labels */
  leftPadding: number;
}

export function createTimeScale(config: TimeScaleConfig) {
  const { startMs, pixelsPerMinute, leftPadding } = config;

  function dateToX(isoOrMs: string | number): number {
    const ms = typeof isoOrMs === "string" ? new Date(isoOrMs).getTime() : isoOrMs;
    const minutesFromStart = (ms - startMs) / 60000;
    return leftPadding + minutesFromStart * pixelsPerMinute;
  }

  function xToDate(x: number): number {
    const minutesFromStart = (x - leftPadding) / pixelsPerMinute;
    return startMs + minutesFromStart * 60000;
  }

  function durationToWidth(durationMinutes: number): number {
    return durationMinutes * pixelsPerMinute;
  }

  function getTotalWidth(): number {
    const totalMinutes = (config.endMs - startMs) / 60000;
    return leftPadding + totalMinutes * pixelsPerMinute + 40;
  }

  return { dateToX, xToDate, durationToWidth, getTotalWidth };
}

export type TimeScale = ReturnType<typeof createTimeScale>;

/**
 * Compute the time bounds from a set of tasks, with padding.
 */
export function computeTimeBounds(
  tasks: Array<{ data: { startDate: string; endDate: string } }>,
  paddingMinutes: number = 60
): { startMs: number; endMs: number } {
  if (tasks.length === 0) {
    const now = Date.now();
    return { startMs: now, endMs: now + 8 * 3600000 };
  }

  let minMs = Infinity;
  let maxMs = -Infinity;

  for (const task of tasks) {
    const s = new Date(task.data.startDate).getTime();
    const e = new Date(task.data.endDate).getTime();
    if (s < minMs) minMs = s;
    if (e > maxMs) maxMs = e;
  }

  return {
    startMs: minMs - paddingMinutes * 60000,
    endMs: maxMs + paddingMinutes * 60000,
  };
}
