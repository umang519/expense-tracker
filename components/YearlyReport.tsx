"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatAmount } from "@/lib/format";
import { clientFetch } from "@/lib/client-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthlyCat {
  categoryId: string;
  name: string;
  color: string;
  total: number;
}

interface MonthRow {
  month: number;
  label: string;
  total: number;
  categories: MonthlyCat[];
}

interface CategoryYear {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
  monthlyAvg: number;
}

interface YearlySummary {
  year: number;
  grandTotal: number;
  months: MonthRow[];
  categories: CategoryYear[];
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchYearly(year: number): Promise<YearlySummary> {
  const res = await clientFetch(`/api/summary/yearly?year=${year}`);
  if (!res.ok) throw new Error("Failed to load report");
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function yAxisTick(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function YearlyReport({
  initialYear,
  currency = "INR",
}: {
  initialYear: number;
  currency?: string;
}) {
  const [year, setYear] = useState(initialYear);
  const currentYear = new Date().getFullYear();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["summary", "yearly", year],
    queryFn: () => fetchYearly(year),
  });

  // Build chart data: one entry per month, keys = categoryIds
  const chartData = (data?.months ?? []).map((m) => {
    const entry: Record<string, number | string> = { label: m.label };
    for (const cat of m.categories) {
      entry[cat.categoryId] = cat.total;
    }
    return entry;
  });

  // Build a lookup: categoryId → amount per month (for the table)
  const allCatIds = data?.categories.map((c) => c.categoryId) ?? [];

  return (
    <div className="space-y-4">
      {/* Year navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-5 py-3">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="text-gray-500 hover:text-violet-600 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50 text-sm"
        >
          ← {year - 1}
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-gray-900">{year}</p>
          {year === currentYear && (
            <p className="text-xs text-violet-500 font-medium">This year</p>
          )}
        </div>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          className="text-gray-500 hover:text-violet-600 disabled:text-gray-300 disabled:cursor-default transition-colors px-2 py-1 rounded-lg hover:bg-violet-50 disabled:hover:bg-transparent text-sm"
        >
          {year + 1} →
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
          <p className="text-sm text-red-500">Could not load report. Try refreshing.</p>
        </div>
      )}

      {!isLoading && !isError && data && data.grandTotal === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-600 font-medium mb-1.5">No expenses in {year}</p>
          <p className="text-gray-400 text-sm">
            Add expenses from the dashboard and your yearly report will appear here.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.grandTotal > 0 && (
        <>
          {/* Grand total */}
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Year total
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {formatAmount(data.grandTotal, currency)}
            </p>
            {data.months.filter((m) => m.total > 0).length > 0 && (
              <p className="text-sm text-gray-400 mt-0.5">
                avg{" "}
                {formatAmount(
                  Math.round(
                    data.grandTotal /
                      data.months.filter((m) => m.total > 0).length
                  ),
                  currency
                )}{" "}
                / active month
              </p>
            )}
          </div>

          {/* Monthly trend: stacked bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Monthly trend
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={chartData}
                margin={{ top: 0, right: 4, left: -16, bottom: 0 }}
                barSize={18}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yAxisTick}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const cat = data.categories.find((c) => c.categoryId === name);
                    return [
                      typeof value === "number"
                        ? formatAmount(value, currency)
                        : value,
                      cat?.name ?? String(name),
                    ];
                  }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 1px 4px rgba(0,0,0,.08)",
                  }}
                />
                {data.categories.map((cat) => (
                  <Bar
                    key={cat.categoryId}
                    dataKey={cat.categoryId}
                    stackId="a"
                    fill={cat.color}
                    name={cat.name}
                    radius={
                      cat.categoryId ===
                      data.categories[data.categories.length - 1].categoryId
                        ? [3, 3, 0, 0]
                        : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              By category
            </p>
            <div className="space-y-3">
              {data.categories.map((cat) => (
                <div key={cat.categoryId}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">
                      {cat.percentage}%
                    </span>
                    <span
                      className="text-xs text-gray-400 w-20 text-right"
                      title="Average per active month (months with at least one expense)"
                    >
                      avg {formatAmount(cat.monthlyAvg, currency)}/mo
                    </span>
                    <span className="text-sm font-semibold text-gray-800 w-20 text-right">
                      {formatAmount(cat.total, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-4">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Month-by-month table */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Month breakdown
            </p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs min-w-max">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-medium text-gray-500 sticky left-0 bg-white">
                      Month
                    </th>
                    {data.categories.map((cat) => (
                      <th
                        key={cat.categoryId}
                        className="text-right py-2 px-2 font-medium whitespace-nowrap"
                        style={{ color: cat.color }}
                      >
                        {cat.name}
                      </th>
                    ))}
                    <th className="text-right py-2 px-2 font-semibold text-gray-700">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.months
                    .filter((m) => m.total > 0)
                    .map((m) => {
                      const catLookup = new Map(
                        m.categories.map((c) => [c.categoryId, c.total])
                      );
                      return (
                        <tr
                          key={m.month}
                          className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-2 px-2 font-medium text-gray-700 sticky left-0 bg-white">
                            {m.label}
                          </td>
                          {allCatIds.map((id) => (
                            <td
                              key={id}
                              className="text-right py-2 px-2 text-gray-600"
                            >
                              {catLookup.has(id)
                                ? formatAmount(catLookup.get(id)!, currency)
                                : "—"}
                            </td>
                          ))}
                          <td className="text-right py-2 px-2 font-semibold text-gray-800">
                            {formatAmount(m.total, currency)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="py-2 px-2 font-bold text-gray-700 sticky left-0 bg-white">
                      Total
                    </td>
                    {data.categories.map((cat) => (
                      <td
                        key={cat.categoryId}
                        className="text-right py-2 px-2 font-semibold"
                        style={{ color: cat.color }}
                      >
                        {formatAmount(cat.total, currency)}
                      </td>
                    ))}
                    <td className="text-right py-2 px-2 font-bold text-gray-900">
                      {formatAmount(data.grandTotal, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
