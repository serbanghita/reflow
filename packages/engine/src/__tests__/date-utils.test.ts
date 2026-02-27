import { describe, it, expect } from "vitest";
import { DateTime, Interval } from "luxon";
import {
  getOperatingWindowsForDate,
  parseBlackoutWindows,
  subtractBlackouts,
  findNextOperatingSlot,
  computeEndDate,
  countAvailableMinutes,
  overlapsBlackout,
} from "../utils/date-utils.js";
import type { OperatingHourSlot, BlackoutWindow } from "../reflow/types.js";

// Standard Mon-Fri 8AM-4PM operating hours
const weekdayHours: OperatingHourSlot[] = [
  { dayOfWeek: 1, startHour: 8, endHour: 16 }, // Monday
  { dayOfWeek: 2, startHour: 8, endHour: 16 }, // Tuesday
  { dayOfWeek: 3, startHour: 8, endHour: 16 }, // Wednesday
  { dayOfWeek: 4, startHour: 8, endHour: 16 }, // Thursday
  { dayOfWeek: 5, startHour: 8, endHour: 16 }, // Friday
];

function utc(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: "utc" });
}

describe("getOperatingWindowsForDate", () => {
  it("returns windows for a matching weekday", () => {
    // 2024-01-15 is a Monday (dayOfWeek=1)
    const monday = utc("2024-01-15T10:00:00Z");
    const windows = getOperatingWindowsForDate(monday, weekdayHours);
    expect(windows).toHaveLength(1);
    expect(windows[0].start!.toISO()).toBe("2024-01-15T08:00:00.000Z");
    expect(windows[0].end!.toISO()).toBe("2024-01-15T16:00:00.000Z");
  });

  it("returns empty for a weekend day", () => {
    // 2024-01-13 is a Saturday
    const saturday = utc("2024-01-13T10:00:00Z");
    const windows = getOperatingWindowsForDate(saturday, weekdayHours);
    expect(windows).toHaveLength(0);
  });

  it("returns empty for Sunday", () => {
    // 2024-01-14 is a Sunday (dayOfWeek=0 in spec)
    const sunday = utc("2024-01-14T10:00:00Z");
    const windows = getOperatingWindowsForDate(sunday, weekdayHours);
    expect(windows).toHaveLength(0);
  });

  it("handles multiple slots on the same day", () => {
    const splitDay: OperatingHourSlot[] = [
      { dayOfWeek: 1, startHour: 8, endHour: 12 },
      { dayOfWeek: 1, startHour: 13, endHour: 17 },
    ];
    const monday = utc("2024-01-15T10:00:00Z");
    const windows = getOperatingWindowsForDate(monday, splitDay);
    expect(windows).toHaveLength(2);
    expect(windows[0].start!.hour).toBe(8);
    expect(windows[0].end!.hour).toBe(12);
    expect(windows[1].start!.hour).toBe(13);
    expect(windows[1].end!.hour).toBe(17);
  });
});

describe("parseBlackoutWindows", () => {
  it("converts blackout specs to intervals", () => {
    const blackouts: BlackoutWindow[] = [
      {
        startDate: "2024-01-16T08:00:00Z",
        endDate: "2024-01-16T09:00:00Z",
        reason: "Fedwire maintenance",
      },
    ];
    const intervals = parseBlackoutWindows(blackouts);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].start!.toISO()).toBe("2024-01-16T08:00:00.000Z");
    expect(intervals[0].end!.toISO()).toBe("2024-01-16T09:00:00.000Z");
  });
});

describe("subtractBlackouts", () => {
  it("returns windows unchanged when no overlap", () => {
    const window = Interval.fromDateTimes(
      utc("2024-01-15T08:00:00Z"),
      utc("2024-01-15T16:00:00Z")
    );
    const blackout = Interval.fromDateTimes(
      utc("2024-01-16T08:00:00Z"),
      utc("2024-01-16T09:00:00Z")
    );
    const result = subtractBlackouts([window], [blackout]);
    expect(result).toHaveLength(1);
    expect(result[0].start!.toISO()).toBe("2024-01-15T08:00:00.000Z");
  });

  it("splits window around a blackout in the middle", () => {
    const window = Interval.fromDateTimes(
      utc("2024-01-15T08:00:00Z"),
      utc("2024-01-15T16:00:00Z")
    );
    const blackout = Interval.fromDateTimes(
      utc("2024-01-15T11:00:00Z"),
      utc("2024-01-15T12:00:00Z")
    );
    const result = subtractBlackouts([window], [blackout]);
    expect(result).toHaveLength(2);
    expect(result[0].end!.toISO()).toBe("2024-01-15T11:00:00.000Z");
    expect(result[1].start!.toISO()).toBe("2024-01-15T12:00:00.000Z");
  });

  it("removes window entirely when blackout fully covers it", () => {
    const window = Interval.fromDateTimes(
      utc("2024-01-15T08:00:00Z"),
      utc("2024-01-15T16:00:00Z")
    );
    const blackout = Interval.fromDateTimes(
      utc("2024-01-15T07:00:00Z"),
      utc("2024-01-15T17:00:00Z")
    );
    const result = subtractBlackouts([window], [blackout]);
    expect(result).toHaveLength(0);
  });

  it("trims window start when blackout overlaps beginning", () => {
    const window = Interval.fromDateTimes(
      utc("2024-01-15T08:00:00Z"),
      utc("2024-01-15T16:00:00Z")
    );
    const blackout = Interval.fromDateTimes(
      utc("2024-01-15T07:00:00Z"),
      utc("2024-01-15T10:00:00Z")
    );
    const result = subtractBlackouts([window], [blackout]);
    expect(result).toHaveLength(1);
    expect(result[0].start!.toISO()).toBe("2024-01-15T10:00:00.000Z");
    expect(result[0].end!.toISO()).toBe("2024-01-15T16:00:00.000Z");
  });
});

describe("findNextOperatingSlot", () => {
  const noBlackouts: Interval[] = [];

  it("returns same time if already in an operating window", () => {
    const time = utc("2024-01-15T10:00:00Z"); // Monday 10AM
    const result = findNextOperatingSlot(time, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-15T10:00:00.000Z");
  });

  it("returns window start if before operating hours", () => {
    const time = utc("2024-01-15T06:00:00Z"); // Monday 6AM
    const result = findNextOperatingSlot(time, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-15T08:00:00.000Z");
  });

  it("skips to next day if after operating hours", () => {
    const time = utc("2024-01-15T17:00:00Z"); // Monday 5PM
    const result = findNextOperatingSlot(time, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-16T08:00:00.000Z"); // Tuesday 8AM
  });

  it("skips weekend", () => {
    const time = utc("2024-01-13T10:00:00Z"); // Saturday
    const result = findNextOperatingSlot(time, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-15T08:00:00.000Z"); // Monday 8AM
  });

  it("skips past blackout at window start", () => {
    const blackout = Interval.fromDateTimes(
      utc("2024-01-15T08:00:00Z"),
      utc("2024-01-15T09:00:00Z")
    );
    const time = utc("2024-01-15T06:00:00Z"); // Before hours
    const result = findNextOperatingSlot(time, weekdayHours, [blackout]);
    expect(result!.toISO()).toBe("2024-01-15T09:00:00.000Z");
  });

  it("returns exact window boundary", () => {
    const time = utc("2024-01-15T08:00:00Z"); // Exactly at opening
    const result = findNextOperatingSlot(time, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-15T08:00:00.000Z");
  });
});

describe("computeEndDate", () => {
  const noBlackouts: Interval[] = [];

  it("handles task fully within a single operating window", () => {
    const start = utc("2024-01-15T10:00:00Z"); // Monday 10AM
    const result = computeEndDate(start, 60, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-15T11:00:00.000Z");
  });

  it("handles task spanning overnight (pauses at close, resumes at open)", () => {
    const start = utc("2024-01-15T15:00:00Z"); // Monday 3PM, 1h left in window
    const result = computeEndDate(start, 120, weekdayHours, noBlackouts); // 2 hours
    // 1h Mon (3-4PM), then 1h Tue (8-9AM)
    expect(result!.toISO()).toBe("2024-01-16T09:00:00.000Z");
  });

  it("handles task spanning a weekend", () => {
    const start = utc("2024-01-19T15:00:00Z"); // Friday 3PM, 1h left
    const result = computeEndDate(start, 120, weekdayHours, noBlackouts);
    // 1h Fri (3-4PM), skip Sat+Sun, 1h Mon (8-9AM)
    expect(result!.toISO()).toBe("2024-01-22T09:00:00.000Z");
  });

  it("handles task hitting a blackout mid-window", () => {
    // The spec's key scenario: 120-min task starting Mon 3PM,
    // channel has Mon-Fri 8-4, Tuesday 8-9 blackout
    const start = utc("2024-01-15T15:00:00Z"); // Monday 3PM
    const blackout = Interval.fromDateTimes(
      utc("2024-01-16T08:00:00Z"),
      utc("2024-01-16T09:00:00Z")
    );
    const result = computeEndDate(start, 120, weekdayHours, [blackout]);
    // 1h Mon (3-4PM), Tue 8-9 blocked, resume Tue 9AM, 1h (9-10AM)
    expect(result!.toISO()).toBe("2024-01-16T10:00:00.000Z");
  });

  it("handles task starting outside operating hours (snaps to next window)", () => {
    const start = utc("2024-01-15T06:00:00Z"); // Monday 6AM
    const result = computeEndDate(start, 60, weekdayHours, noBlackouts);
    // Snaps to 8AM, then 1h → 9AM
    expect(result!.toISO()).toBe("2024-01-15T09:00:00.000Z");
  });

  it("handles task starting exactly at window boundary", () => {
    const start = utc("2024-01-15T08:00:00Z");
    const result = computeEndDate(start, 480, weekdayHours, noBlackouts); // Full 8h day
    expect(result!.toISO()).toBe("2024-01-15T16:00:00.000Z");
  });

  it("handles blackout fully covering an operating window", () => {
    // Tuesday's entire window is blacked out
    const blackout = Interval.fromDateTimes(
      utc("2024-01-16T07:00:00Z"),
      utc("2024-01-16T17:00:00Z")
    );
    const start = utc("2024-01-15T15:00:00Z"); // Monday 3PM
    const result = computeEndDate(start, 120, weekdayHours, [blackout]);
    // 1h Mon (3-4PM), skip Tue entirely, 1h Wed (8-9AM)
    expect(result!.toISO()).toBe("2024-01-17T09:00:00.000Z");
  });

  it("handles zero-duration task", () => {
    const start = utc("2024-01-15T10:00:00Z");
    const result = computeEndDate(start, 0, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-15T10:00:00.000Z");
  });

  it("handles multi-day task", () => {
    const start = utc("2024-01-15T08:00:00Z"); // Monday 8AM
    // 8h * 3 = 24 hours of operating time = 3 full days
    const result = computeEndDate(start, 1440, weekdayHours, noBlackouts);
    expect(result!.toISO()).toBe("2024-01-17T16:00:00.000Z"); // Wed 4PM
  });

  it("returns null when no operating hours available", () => {
    const start = utc("2024-01-15T10:00:00Z");
    const result = computeEndDate(start, 60, [], noBlackouts);
    expect(result).toBeNull();
  });
});

describe("countAvailableMinutes", () => {
  const noBlackouts: Interval[] = [];

  it("counts minutes within a single day", () => {
    const from = utc("2024-01-15T08:00:00Z");
    const to = utc("2024-01-15T16:00:00Z");
    const result = countAvailableMinutes(from, to, weekdayHours, noBlackouts);
    expect(result).toBe(480);
  });

  it("counts minutes across two days", () => {
    const from = utc("2024-01-15T14:00:00Z"); // Mon 2PM
    const to = utc("2024-01-16T10:00:00Z"); // Tue 10AM
    const result = countAvailableMinutes(from, to, weekdayHours, noBlackouts);
    // Mon: 2PM-4PM = 2h = 120min, Tue: 8AM-10AM = 2h = 120min
    expect(result).toBe(240);
  });

  it("subtracts blackout overlap", () => {
    const from = utc("2024-01-15T08:00:00Z");
    const to = utc("2024-01-15T16:00:00Z");
    const blackout = Interval.fromDateTimes(
      utc("2024-01-15T11:00:00Z"),
      utc("2024-01-15T12:00:00Z")
    );
    const result = countAvailableMinutes(from, to, weekdayHours, [blackout]);
    expect(result).toBe(420); // 480 - 60
  });
});

describe("overlapsBlackout", () => {
  it("detects overlap", () => {
    const blackout = Interval.fromDateTimes(
      utc("2024-01-15T10:00:00Z"),
      utc("2024-01-15T12:00:00Z")
    );
    expect(
      overlapsBlackout(utc("2024-01-15T11:00:00Z"), utc("2024-01-15T13:00:00Z"), [
        blackout,
      ])
    ).toBe(true);
  });

  it("returns false for non-overlapping", () => {
    const blackout = Interval.fromDateTimes(
      utc("2024-01-15T10:00:00Z"),
      utc("2024-01-15T12:00:00Z")
    );
    expect(
      overlapsBlackout(utc("2024-01-15T13:00:00Z"), utc("2024-01-15T14:00:00Z"), [
        blackout,
      ])
    ).toBe(false);
  });
});

describe("computeEndDate — additional coverage", () => {
  const noBlackouts: Interval[] = [];

  it("handles task spanning weekend with Friday blackout", () => {
    // Friday 2024-01-19, blackout 14:00-16:00 (last 2h of Friday)
    // Start Friday 13:00, 120 min task
    // Available Fri: 13:00-14:00 = 60 min, then blackout kills rest of Fri
    // Remaining 60 min → Monday 8:00-9:00
    const blackout = Interval.fromDateTimes(
      utc("2024-01-19T14:00:00Z"),
      utc("2024-01-19T16:00:00Z")
    );
    const start = utc("2024-01-19T13:00:00Z"); // Friday 1PM
    const result = computeEndDate(start, 120, weekdayHours, [blackout]);
    // 1h Fri (1-2PM), Fri 2-4PM blacked out, skip Sat+Sun, 1h Mon (8-9AM)
    expect(result!.toISO()).toBe("2024-01-22T09:00:00.000Z");
  });

  it("handles multiple blackouts within one operating day", () => {
    // Monday 2024-01-15, two blackouts: 9-10AM and 12-13PM
    // Start 8AM, 360 min (6h) task
    // Available: 8-9 (60), skip 9-10, 10-12 (120), skip 12-13, 13-16 (180) = 360 min total
    const blackouts = [
      Interval.fromDateTimes(utc("2024-01-15T09:00:00Z"), utc("2024-01-15T10:00:00Z")),
      Interval.fromDateTimes(utc("2024-01-15T12:00:00Z"), utc("2024-01-15T13:00:00Z")),
    ];
    const start = utc("2024-01-15T08:00:00Z");
    const result = computeEndDate(start, 360, weekdayHours, blackouts);
    // 60 + 120 + 180 = 360 min consumed by 4PM
    expect(result!.toISO()).toBe("2024-01-15T16:00:00.000Z");
  });
});

