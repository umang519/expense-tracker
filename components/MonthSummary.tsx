"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { formatAmount } from "@/lib/format";
import { clientFetch } from "@/lib/client-fetch";

// Recharts is a large dependency that's only needed once summary data has
// loaded; dynamic-importing it keeps it out of the initial JS payload for
// the dashboard/month pages.
const MonthDonutChart = dynamic(() => import("./charts/MonthDonutChart"), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-50 dark:bg-gray-800/50 rounded-xl animate-pulse" />,
});

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
    return { text: `Over by ${formatAmount(spent - budget, currency)}`, color: "text-red-500 dark:text-red-400" };
  }
  if (spent >= budget * 0.8) {
    return { text: `${formatAmount(budget - spent, currency)} left`, color: "text-orange-500" };
  }
  return { text: `${formatAmount(budget - spent, currency)} left`, color: "text-gray-400 dark:text-gray-500" };
}

interface Props {
  month: string;
  currency?: string;
  initialData?: Summary;
}

export default function MonthSummary({ month, currency = "INR", initialData }: Props) {
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["summary", "monthly", month],
    queryFn: () => fetchSummary(month),
    staleTime: 30_000,
    initialData,
  });

  if (isLoading || isFetching) {
    return (
      <div className="space-y-3 mb-4">
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mb-4 bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900/50 p-6 text-center">
        <p className="text-sm text-red-500 dark:text-red-400">Could not load summary. Try refreshing.</p>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="mb-4 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-7 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Nothing spent this month yet</p>
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
              ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800/60"
              : data.total >= ob.amount * 0.8
              ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-800"
              : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Monthly budget
            </p>
            <p
              className={`text-xs font-semibold ${
                data.total > ob.amount
                  ? "text-red-500 dark:text-red-400"
                  : data.total >= ob.amount * 0.8
                  ? "text-orange-500"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {data.total > ob.amount
                ? `Over by ${formatAmount(data.total - ob.amount, currency)}`
                : `${formatAmount(ob.amount - data.total, currency)} left`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
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
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 w-28 text-right">
              {formatAmount(data.total, currency)} / {formatAmount(ob.amount, currency)}
            </span>
          </div>
        </div>
      )}

      {/* Over-budget alert — categories that exceed their budget */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/60 rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Over budget</p>
          <p className="text-xs text-red-500 dark:text-red-400">
            {overBudgetCategories.map((c) => c.name).join(", ")}{" "}
            {overBudgetCategories.length === 1 ? "has" : "have"} exceeded the monthly limit.
          </p>
        </div>
      )}

      {/* Total + donut */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
          Total spent
        </p>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {formatAmount(data.total, currency)}
        </p>

        <MonthDonutChart categories={data.categories} currency={currency} />
      </div>

      {/* Per-category breakdown */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
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
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                {hasBudget ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatAmount(cat.total, currency)}
                    <span className="text-gray-300 dark:text-gray-600 mx-1">/</span>
                    {formatAmount(cat.budget!.amount, currency)}
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{cat.percentage}%</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 w-20 text-right">
                      {formatAmount(cat.total, currency)}
                    </span>
                  </>
                )}
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden ml-4">
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
