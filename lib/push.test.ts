import { afterEach, describe, expect, it, vi } from "vitest";
import { isPastReminderTimeIST } from "./push";

// Reminder fires at 19:30 IST = 14:00 UTC (IST is UTC+5:30).
describe("isPastReminderTimeIST", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is false just before 19:30 IST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T13:59:00.000Z"));
    expect(isPastReminderTimeIST()).toBe(false);
  });

  it("is true exactly at 19:30 IST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T14:00:00.000Z"));
    expect(isPastReminderTimeIST()).toBe(true);
  });

  it("is true well after 19:30 IST", () => {
    vi.useFakeTimers();
    // 16:00 UTC = 21:30 IST, same calendar day (IST rolls to the next day at 18:30 UTC).
    vi.setSystemTime(new Date("2026-01-15T16:00:00.000Z"));
    expect(isPastReminderTimeIST()).toBe(true);
  });

  it("is false early in the IST day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T02:00:00.000Z"));
    expect(isPastReminderTimeIST()).toBe(false);
  });
});
