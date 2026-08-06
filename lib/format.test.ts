import { describe, expect, it } from "vitest";
import { adjacentMonths, currentMonth, formatAmount, monthLabel } from "./format";

describe("formatAmount", () => {
  it("formats INR by default with no fraction digits", () => {
    expect(formatAmount(1234)).toBe("₹1,234");
  });

  it("formats a different currency code when passed", () => {
    expect(formatAmount(1234, "USD")).toContain("1,234");
  });

  it("formats zero", () => {
    expect(formatAmount(0)).toBe("₹0");
  });
});

describe("monthLabel", () => {
  it("renders a full month name and year", () => {
    expect(monthLabel("2026-01")).toBe("January 2026");
  });

  it("handles December", () => {
    expect(monthLabel("2025-12")).toBe("December 2025");
  });
});

describe("adjacentMonths", () => {
  it("computes prev/next within a year", () => {
    expect(adjacentMonths("2026-06")).toEqual({ prev: "2026-05", next: "2026-07" });
  });

  it("rolls over from January to previous December", () => {
    expect(adjacentMonths("2026-01").prev).toBe("2025-12");
  });

  it("rolls over from December to next January", () => {
    expect(adjacentMonths("2025-12").next).toBe("2026-01");
  });
});

describe("currentMonth", () => {
  it("returns a YYYY-MM string matching the system clock", () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    expect(currentMonth()).toBe(expected);
  });
});
