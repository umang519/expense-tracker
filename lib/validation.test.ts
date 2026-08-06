import { describe, expect, it } from "vitest";
import {
  BudgetUpsertSchema,
  CategoryCreateSchema,
  ExpenseCreateSchema,
  LoginSchema,
  RegisterSchema,
  TransactionCreateSchema,
} from "./validation";

describe("RegisterSchema", () => {
  it("accepts a valid registration", () => {
    expect(
      RegisterSchema.safeParse({ email: "a@b.com", password: "password123" }).success
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      RegisterSchema.safeParse({ email: "not-an-email", password: "password123" }).success
    ).toBe(false);
  });

  it("rejects a short password", () => {
    expect(
      RegisterSchema.safeParse({ email: "a@b.com", password: "short" }).success
    ).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("defaults rememberMe to true when omitted", () => {
    const result = LoginSchema.parse({ email: "a@b.com", password: "x" });
    expect(result.rememberMe).toBe(true);
  });

  it("respects an explicit rememberMe: false", () => {
    const result = LoginSchema.parse({ email: "a@b.com", password: "x", rememberMe: false });
    expect(result.rememberMe).toBe(false);
  });
});

describe("CategoryCreateSchema", () => {
  it("accepts a valid hex color", () => {
    expect(
      CategoryCreateSchema.safeParse({ name: "Food", color: "#F97316" }).success
    ).toBe(true);
  });

  it("rejects a malformed hex color", () => {
    expect(
      CategoryCreateSchema.safeParse({ name: "Food", color: "orange" }).success
    ).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(
      CategoryCreateSchema.safeParse({ name: "", color: "#F97316" }).success
    ).toBe(false);
  });
});

describe("ExpenseCreateSchema (CLAUDE.md rule 7: amount > 0)", () => {
  const base = { date: "2026-01-15", categoryId: "abc123", amount: 100 };

  it("accepts a positive amount", () => {
    expect(ExpenseCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(ExpenseCreateSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(ExpenseCreateSchema.safeParse({ ...base, amount: -50 }).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(ExpenseCreateSchema.safeParse({ ...base, date: "15-01-2026" }).success).toBe(false);
  });

  it("rejects a missing categoryId", () => {
    expect(
      ExpenseCreateSchema.safeParse({ ...base, categoryId: "" }).success
    ).toBe(false);
  });
});

describe("TransactionCreateSchema", () => {
  const base = { date: "2026-01-15", amount: 500, type: "Dr" as const, description: "FD created" };

  it("accepts a valid Dr transaction", () => {
    expect(TransactionCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(TransactionCreateSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(
      TransactionCreateSchema.safeParse({ ...base, type: "XX" }).success
    ).toBe(false);
  });
});

describe("BudgetUpsertSchema", () => {
  it("accepts a null categoryId for an overall budget", () => {
    expect(
      BudgetUpsertSchema.safeParse({ categoryId: null, amount: 10000 }).success
    ).toBe(true);
  });

  it("rejects a zero amount", () => {
    expect(
      BudgetUpsertSchema.safeParse({ categoryId: null, amount: 0 }).success
    ).toBe(false);
  });
});
