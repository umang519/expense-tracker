"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatAmount } from "@/lib/format";

interface CategoryRow {
  categoryId: string;
  name: string;
  color: string;
  total: number;
}

interface Props {
  categories: CategoryRow[];
  currency: string;
}

export default function MonthDonutChart({ categories, currency }: Props) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={categories}
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
            {categories.map((cat) => (
              <Cell key={cat.categoryId} fill={cat.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              typeof value === "number" ? [formatAmount(value, currency), ""] : [value, ""]
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
          <p className="text-xs text-gray-400 dark:text-gray-500">{categories.length} categories</p>
        </div>
      </div>
    </div>
  );
}
