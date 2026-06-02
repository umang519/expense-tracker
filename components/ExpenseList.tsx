"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PopulatedExpense } from "@/lib/types";
import { formatAmount } from "@/lib/format";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

async function fetchExpenses(month: string): Promise<PopulatedExpense[]> {
  const res = await fetch(`/api/expenses?month=${month}`);
  if (!res.ok) throw new Error("Failed to load expenses");
  return (await res.json()).expenses;
}

interface Props {
  month: string; // YYYY-MM
  currency?: string;
}

export default function ExpenseList({ month, currency = "INR" }: Props) {
  const qc = useQueryClient();
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => fetchExpenses(month),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["expenses", month] });
      const prev = qc.getQueryData<PopulatedExpense[]>(["expenses", month]);
      qc.setQueryData<PopulatedExpense[]>(["expenses", month], (old) =>
        (old ?? []).filter((e) => e._id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["expenses", month], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["expenses", month] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm mt-2">
        No expenses this month yet.
      </div>
    );
  }

  // Group by date (YYYY-MM-DD)
  const groups = expenses.reduce<Record<string, PopulatedExpense[]>>((acc, e) => {
    const key = e.date.substring(0, 10);
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4 mt-2">
      {sortedDays.map((day) => {
        const dayExpenses = groups[day];
        const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);

        return (
          <div key={day}>
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {formatDate(day)}
              </span>
              <span className="text-xs text-gray-400">
                {formatAmount(dayTotal, currency)}
              </span>
            </div>

            <ul className="space-y-1">
              {dayExpenses.map((expense) => (
                <li
                  key={expense._id}
                  className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3 group"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: expense.categoryId.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {expense.categoryId.name}
                      </span>
                      {expense.note && (
                        <span className="text-xs text-gray-400 truncate">
                          {expense.note}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-800 flex-shrink-0">
                    {formatAmount(expense.amount, currency)}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(expense._id)}
                    disabled={deleteMutation.isPending}
                    className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 disabled:opacity-30"
                    aria-label="Delete expense"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
