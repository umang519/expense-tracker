import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

// ── Categories ────────────────────────────────────────────────────────────────

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #F97316)");

export const CategoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  color: hexColor,
  sortOrder: z.number().int().optional(),
});

export const CategoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: hexColor.optional(),
  sortOrder: z.number().int().optional(),
  isArchived: z.boolean().optional(),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;

// ── Expenses ──────────────────────────────────────────────────────────────────

export const ExpenseCreateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  categoryId: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  note: z.string().trim().max(200).optional(),
});

export const ExpenseUpdateSchema = ExpenseCreateSchema.partial();

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof ExpenseUpdateSchema>;

// ── Transactions ──────────────────────────────────────────────────────────────

export const TransactionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  amount: z.number().positive("Amount must be greater than 0"),
  type: z.enum(["Dr", "Cr"]),
  description: z.string().trim().min(1, "Description is required").max(200),
  isInvestment: z.boolean().optional(),
});

export const TransactionUpdateSchema = TransactionCreateSchema.partial();

export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof TransactionUpdateSchema>;

// ── Budgets ───────────────────────────────────────────────────────────────────

export const BudgetUpsertSchema = z.object({
  categoryId: z.string().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
});

export const BudgetUpdateSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
});

export type BudgetUpsertInput = z.infer<typeof BudgetUpsertSchema>;
export type BudgetUpdateInput = z.infer<typeof BudgetUpdateSchema>;

// ── Settings ──────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  name: z.string().trim().max(100).optional(),
  currency: z.string().length(3, "Must be a 3-letter currency code").optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});
