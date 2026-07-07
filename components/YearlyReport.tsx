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

interface TxMonthRow {
  month: number;
  label: string;
  received: number;
  spent: number;
  invested: number;
}

interface BiggestExpense {
  amount: number;
  note: string | null;
  categoryName: string;
  categoryColor: string;
  date: string;
}

interface YearlySummary {
  year: number;
  grandTotal: number;
  months: MonthRow[];
  categories: CategoryYear[];
  transactions: {
    totalReceived: number;
    totalSpent: number;
    totalInvested: number;
    byMonth: TxMonthRow[];
  };
  biggestExpense: BiggestExpense | null;
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

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[Number(m) - 1]}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InsightCard({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex-shrink-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3 min-w-[140px]">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-bold ${accent ?? "text-gray-900 dark:text-gray-100"} leading-tight`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
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

  // Build chart data
  const chartData = (data?.months ?? []).map((m) => {
    const entry: Record<string, number | string> = { label: m.label };
    for (const cat of m.categories) entry[cat.categoryId] = cat.total;
    return entry;
  });

  const allCatIds = data?.categories.map((c) => c.categoryId) ?? [];

  // ── Derived insights ──────────────────────────────────────────────────────
  const activeMonths = (data?.months ?? []).filter((m) => m.total > 0);
  const highestMonth = activeMonths.length
    ? activeMonths.reduce((a, b) => (b.total > a.total ? b : a))
    : null;
  const lowestMonth = activeMonths.length > 1
    ? activeMonths.reduce((a, b) => (b.total < a.total ? b : a))
    : null;
  const topCategory = data?.categories[0] ?? null;

  const tx = data?.transactions;
  const hasTx = tx && (tx.totalReceived > 0 || tx.totalSpent > 0 || tx.totalInvested > 0);
  const txNetMovement = tx ? tx.totalReceived - tx.totalSpent - tx.totalInvested : 0;
  const activeTxMonths = (tx?.byMonth ?? []).filter(
    (m) => m.received > 0 || m.spent > 0 || m.invested > 0
  );

  return (
    <div className="space-y-4">
      {/* Year navigation */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-5 py-3">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10 text-sm"
        >
          ← {year - 1}
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{year}</p>
          {year === currentYear && (
            <p className="text-xs text-violet-500 dark:text-violet-400 font-medium">This year</p>
          )}
        </div>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          className="text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 disabled:text-gray-300 disabled:cursor-default transition-colors px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:hover:bg-transparent text-sm"
        >
          {year + 1} →
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900/50 p-8 text-center">
          <p className="text-sm text-red-500 dark:text-red-400">Could not load report. Try refreshing.</p>
        </div>
      )}

      {!isLoading && !isError && data && data.grandTotal === 0 && !hasTx && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 font-medium mb-1.5">No data in {year}</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Add expenses from the dashboard and your yearly report will appear here.
          </p>
        </div>
      )}

      {!isLoading && !isError && data && (data.grandTotal > 0 || hasTx) && (
        <>
          {/* Grand total */}
          {data.grandTotal > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                  Total expenses
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {formatAmount(data.grandTotal, currency)}
                </p>
                {activeMonths.length > 0 && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    avg{" "}
                    {formatAmount(
                      Math.round(data.grandTotal / activeMonths.length),
                      currency
                    )}{" "}
                    / active month
                  </p>
                )}
              </div>
              <a
                href={`/api/expenses/export?year=${year}`}
                download
                title={`Download ${year} expenses as CSV`}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 border border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 rounded-xl px-3 py-2 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </a>
            </div>
          )}

          {/* ── Insights strip ────────────────────────────────────────────── */}
          {data.grandTotal > 0 && (
            <div className="overflow-x-auto -mx-0 pb-1">
              <div className="flex gap-3 px-0">
                {topCategory && (
                  <InsightCard
                    label="Top category"
                    value={topCategory.name}
                    sub={`${topCategory.percentage}% · ${formatAmount(topCategory.total, currency)}`}
                    accent="text-gray-900 dark:text-gray-100"
                  />
                )}
                {highestMonth && (
                  <InsightCard
                    label="Highest month"
                    value={highestMonth.label}
                    sub={formatAmount(highestMonth.total, currency)}
                    accent="text-red-500 dark:text-red-400"
                  />
                )}
                {lowestMonth && (
                  <InsightCard
                    label="Lowest month"
                    value={lowestMonth.label}
                    sub={formatAmount(lowestMonth.total, currency)}
                    accent="text-emerald-600 dark:text-emerald-400"
                  />
                )}
                {data.biggestExpense && (
                  <InsightCard
                    label="Biggest expense"
                    value={formatAmount(data.biggestExpense.amount, currency)}
                    sub={`${data.biggestExpense.categoryName}${data.biggestExpense.note ? ` · ${data.biggestExpense.note}` : ""} · ${shortDate(data.biggestExpense.date)}`}
                    accent="text-gray-900 dark:text-gray-100"
                  />
                )}
              </div>
            </div>
          )}

          {/* Monthly trend: stacked bar chart */}
          {data.grandTotal > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
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
                        typeof value === "number" ? formatAmount(value, currency) : value,
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
                        cat.categoryId === data.categories[data.categories.length - 1].categoryId
                          ? [3, 3, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category summary */}
          {data.grandTotal > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
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
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-8 text-right">{cat.percentage}%</span>
                      <span
                        className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right"
                        title="Average per active month"
                      >
                        avg {formatAmount(cat.monthlyAvg, currency)}/mo
                      </span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 w-20 text-right">
                        {formatAmount(cat.total, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden ml-4">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Major Transactions ────────────────────────────────────────── */}
          {hasTx && tx && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Major transactions
              </p>

              {/* 3 summary cards */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">Received</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {formatAmount(tx.totalReceived, currency)}
                  </p>
                </div>
                <div className="bg-violet-50 dark:bg-violet-500/10 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-medium mb-0.5">Invested</p>
                  <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
                    {formatAmount(tx.totalInvested, currency)}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-xs text-red-500 dark:text-red-400 font-medium mb-0.5">Debited</p>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">
                    {formatAmount(tx.totalSpent, currency)}
                  </p>
                </div>
              </div>

              {/* Net movement */}
              <div className="flex items-center justify-between px-1 mb-4">
                <span className="text-xs text-gray-400 dark:text-gray-500">Net movement (received − debits)</span>
                <span
                  className={`text-sm font-bold ${
                    txNetMovement >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {txNetMovement >= 0 ? "+" : ""}
                  {formatAmount(txNetMovement, currency)}
                </span>
              </div>

              {/* Month-level breakdown (only months with tx activity) */}
              {activeTxMonths.length > 0 && (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Month</th>
                        <th className="text-right py-2 px-2 font-medium text-emerald-600 dark:text-emerald-400">Received</th>
                        <th className="text-right py-2 px-2 font-medium text-violet-600 dark:text-violet-400">Invested</th>
                        <th className="text-right py-2 px-2 font-medium text-red-500 dark:text-red-400">Debited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTxMonths.map((m) => (
                        <tr key={m.month} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300">{m.label}</td>
                          <td className="text-right py-2 px-2 text-emerald-600 dark:text-emerald-400">
                            {m.received > 0 ? formatAmount(m.received, currency) : "—"}
                          </td>
                          <td className="text-right py-2 px-2 text-violet-600 dark:text-violet-400">
                            {m.invested > 0 ? formatAmount(m.invested, currency) : "—"}
                          </td>
                          <td className="text-right py-2 px-2 text-red-500 dark:text-red-400">
                            {m.spent > 0 ? formatAmount(m.spent, currency) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Month-by-month expense table */}
          {data.grandTotal > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Month breakdown
              </p>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-900">
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
                      <th className="text-right py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.months
                      .filter((m) => m.total > 0)
                      .map((m) => {
                        const catLookup = new Map(m.categories.map((c) => [c.categoryId, c.total]));
                        const monthStr = `${year}-${String(m.month).padStart(2, "0")}`;
                        return (
                          <tr
                            key={m.month}
                            className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-900">
                              {m.label}
                            </td>
                            {allCatIds.map((id) => (
                              <td key={id} className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">
                                {catLookup.has(id) ? formatAmount(catLookup.get(id)!, currency) : "—"}
                              </td>
                            ))}
                            <td className="text-right py-2 px-2 font-semibold text-gray-800 dark:text-gray-100">
                              {formatAmount(m.total, currency)}
                            </td>
                            <td className="py-2 px-1 text-center">
                              <a
                                href={`/api/expenses/export?month=${monthStr}`}
                                download
                                title={`Download ${m.label} CSV`}
                                className="text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors inline-flex"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                      <td className="py-2 px-2 font-bold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-900">Total</td>
                      {data.categories.map((cat) => (
                        <td
                          key={cat.categoryId}
                          className="text-right py-2 px-2 font-semibold"
                          style={{ color: cat.color }}
                        >
                          {formatAmount(cat.total, currency)}
                        </td>
                      ))}
                      <td className="text-right py-2 px-2 font-bold text-gray-900 dark:text-gray-100">
                        {formatAmount(data.grandTotal, currency)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
