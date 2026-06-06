"use client";

import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatAmount } from "@/lib/format";
import { clientFetch } from "@/lib/client-fetch";

interface CategoryRow {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percentage: number;
}

interface Summary {
  total: number;
  categories: CategoryRow[];
}

async function fetchSummary(month: string): Promise<Summary> {
  const res = await clientFetch(`/api/summary/monthly?month=${month}`);
  if (!res.ok) throw new Error("Failed to load summary");
  return res.json();
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

  return (
    <div className="mb-4 space-y-3">
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

          {/* Centre label overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xs text-gray-400">{data.categories.length} categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-category breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        {data.categories.map((cat) => (
          <div key={cat.categoryId}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
              <span className="text-xs text-gray-400">{cat.percentage}%</span>
              <span className="text-sm font-semibold text-gray-800 w-20 text-right">
                {formatAmount(cat.total, currency)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-4">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
