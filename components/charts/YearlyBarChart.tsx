"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatAmount } from "@/lib/format";

interface CategoryYear {
  categoryId: string;
  name: string;
  color: string;
  total: number;
}

interface Props {
  chartData: Record<string, number | string>[];
  categories: CategoryYear[];
  currency: string;
}

function yAxisTick(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

export default function YearlyBarChart({ chartData, categories, currency }: Props) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 0, right: 4, left: -10, bottom: 0 }} barSize={18}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={yAxisTick}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          formatter={(value, name) => {
            const cat = categories.find((c) => c.categoryId === name);
            return [typeof value === "number" ? formatAmount(value, currency) : value, cat?.name ?? String(name)];
          }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 4px rgba(0,0,0,.08)",
          }}
        />
        {categories.map((cat) => (
          <Bar
            key={cat.categoryId}
            dataKey={cat.categoryId}
            stackId="a"
            fill={cat.color}
            name={cat.name}
            radius={cat.categoryId === categories[categories.length - 1].categoryId ? [3, 3, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
