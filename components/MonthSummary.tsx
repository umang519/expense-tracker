"use client";

import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatAmount } from "@/lib/format";
import { clientFetch } from "@/lib/client-fetch";

interface BudgetRef {
  _id: string;
  amount: number;
}

interface CategoryRow {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
  budget: BudgetRef | null;
}

interface Summary {
  total: number;
  overallBudget: BudgetRef | null;
  categories: CategoryRow[];
}

async function fetchSummary(month: string): Promise<Summary> {
  const res = await clientFetch(`/api/summary/monthly?month=${month}`);
  if (!res.ok) throw new Error("Failed to load summary");
  return res.json();
}

function budgetBarColor(spent: number, budget: number): string {
  const pct = spent / budget;
  if (pct >= 1) return "#ef4444";   // red — over
  if (pct >= 0.8) return "#f97316"; // orange — warning
  return "";                         // empty = use category color
}

function budgetStatus(spent: number, budget: number, currency: string) {
  if (spent > budget) {
    return { text: `Over by ${formatAmount(spent - budget, currency)}`, color: "text-red-500" };
  }
  if (spent >= budget * 0.8) {
    return { text: `${formatAmount(budget - spent, currency)} left`, color: "text-orange-500" };
  }
  return { text: `${formatAmount(budget - spent, currency)} left`, color: "text-gray-400" };
}

interface Props {
  month: string;
  currency?: string;
}

export default function MonthSummary({ month, currency = "INR" }: Props) {
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["summary", "monthly", month],
    queryFn: () => fetchSummary(month),
    staleTime: 30_000,
  });

  if (isLoading || isFetching) {
    return (
      <div className="space-y-3 mb-4">
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mb-4 bg-white rounded-2xl border border-red-100 p-6 text-center">
        <p className="text-sm text-red-500">Could not load summary. Try refreshing.</p>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="mb-4 bg-white rounded-2xl border border-dashed border-gray-200 p-7 text-center">
        <p className="text-gray-400 text-sm">Nothing spent this month yet</p>
      </div>
    );
  }

  const ob = data.overallBudget;
  const overBudgetCategories = data.categories.filter(
    (c) => c.budget && c.total > c.budget.amount
  );

  return (
    <div className="mb-4 space-y-3">
      {/* Overall budget banner — shown only when set */}
      {ob && (
        <div
          className={`rounded-2xl border px-4 py-3 ${
            data.total > ob.amount
              ? "bg-red-50 border-red-200"
              : data.total >= ob.amount * 0.8
              ? "bg-orange-50 border-orange-200"
              : "bg-white border-gray-100"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Monthly budget
            </p>
            <p
              className={`text-xs font-semibold ${
                data.total > ob.amount
                  ? "text-red-500"
                  : data.total >= ob.amount * 0.8
                  ? "text-orange-500"
                  : "text-gray-500"
              }`}
            >
              {data.total > ob.amount
                ? `Over by ${formatAmount(data.total - ob.amount, currency)}`
                : `${formatAmount(ob.amount - data.total, currency)} left`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((data.total / ob.amount) * 100, 100)}%`,
                  backgroundColor:
                    data.total > ob.amount
                      ? "#ef4444"
                      : data.total >= ob.amount * 0.8
                      ? "#f97316"
                      : "#7c3aed",
                }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0 w-28 text-right">
              {formatAmount(data.total, currency)} / {formatAmount(ob.amount, currency)}
            </span>
          </div>
        </div>
      )}

      {/* Over-budget alert — categories that exceed their budget */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold text-red-600 mb-1">Over budget</p>
          <p className="text-xs text-red-500">
            {overBudgetCategories.map((c) => c.name).join(", ")}{" "}
            {overBudgetCategories.length === 1 ? "has" : "have"} exceeded the monthly limit.
          </p>
        </div>
      )}

      {/* Total + donut */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          Total spent
        </p>
        <p className="text-3xl font-bold text-gray-900 mb-4">
          {formatAmount(data.total, currency)}
        </p>

        <div className="relative">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={data.categories}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                strokeWidth={2}
                stroke="#f9fafb"
                paddingAngle={2}
              >
                {data.categories.map((cat) => (
                  <Cell key={cat.categoryId} fill={cat.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  typeof value === "number"
                    ? [formatAmount(value, currency), ""]
                    : [value, ""]
                }
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 1px 4px rgba(0,0,0,.08)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xs text-gray-400">{data.categories.length} categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-category breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        {data.categories.map((cat) => {
          const hasBudget = cat.budget !== null;
          const barPct = hasBudget
            ? Math.min((cat.total / cat.budget!.amount) * 100, 100)
            : cat.percentage;
          const barColor = hasBudget
            ? budgetBarColor(cat.total, cat.budget!.amount) || cat.color
            : cat.color;
          const status = hasBudget
            ? budgetStatus(cat.total, cat.budget!.amount, currency)
            : null;

          return (
            <div key={cat.categoryId}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                {hasBudget ? (
                  <span className="text-xs text-gray-500">
                    {formatAmount(cat.total, currency)}
                    <span className="text-gray-300 mx-1">/</span>
                    {formatAmount(cat.budget!.amount, currency)}
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-gray-400">{cat.percentage}%</span>
                    <span className="text-sm font-semibold text-gray-800 w-20 text-right">
                      {formatAmount(cat.total, currency)}
                    </span>
                  </>
                )}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-4">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: barColor }}
                />
              </div>
              {status && (
                <p className={`text-xs mt-0.5 ml-4 ${status.color}`}>{status.text}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
