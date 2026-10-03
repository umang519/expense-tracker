// Pure schedule math for recurring expenses — no DB access, so it's shared by
// the generate route (server) and RecurringList's "this will log N past
// entries" preview (client).

export type RecurringFrequency = "monthly" | "weekly" | "weekdays";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function clampDay(year: number, month: number, day: number): Date {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth)));
}

function nextMonth(d: Date, day: number): Date {
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth() + 1;
  if (m > 11) { m = 0; y++; }
  return clampDay(y, m, day);
}

function isWeekday(d: Date): boolean {
  const dow = d.getUTCDay(); // 0=Sun, 6=Sat
  return dow >= 1 && dow <= 5;
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Every date in (lastGeneratedDate, min(endDate, today)] that the schedule
// lands on, and never before startDate. lastGeneratedDate is the hard floor:
// edits to a running template (amount, start date, …) apply going forward
// only and must never re-log a day that was already generated.
export function getDueDates(
  frequency: RecurringFrequency,
  startDate: Date,
  endDate: Date | null,
  lastGeneratedDate: Date | null,
  today: Date
): Date[] {
  const ceiling = endDate && endDate < today ? endDate : today;
  const dates: Date[] = [];
  const isNew = (d: Date) => d >= startDate && (!lastGeneratedDate || d > lastGeneratedDate);

  if (frequency === "weekdays") {
    // Every Mon-Fri, one entry per day
    let d = lastGeneratedDate && addDays(lastGeneratedDate, 1) > startDate
      ? addDays(lastGeneratedDate, 1)
      : new Date(startDate);
    while (d <= ceiling) {
      if (isWeekday(d)) dates.push(new Date(d));
      d = addDays(d, 1);
    }
  } else if (frequency === "weekly") {
    // Every 7 days from startDate (startDate fixes the weekday)
    let d = new Date(startDate);
    while (d <= ceiling) {
      if (isNew(d)) dates.push(new Date(d));
      d = addDays(d, 7);
    }
  } else {
    // monthly — same calendar day each month (clamped to month length)
    const day = startDate.getUTCDate();
    let d = new Date(startDate);
    while (d <= ceiling) {
      if (isNew(d)) dates.push(new Date(d));
      d = nextMonth(d, day);
    }
  }

  return dates;
}
