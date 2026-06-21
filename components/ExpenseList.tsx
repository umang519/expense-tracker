"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PopulatedExpense, Category } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { clientFetch } from "@/lib/client-fetch";
import AddExpenseSheet from "./AddExpenseSheet";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

async function fetchExpenses(month: string): Promise<PopulatedExpense[]> {
  const res = await clientFetch(`/api/expenses?month=${month}`);
  if (!res.ok) throw new Error("Failed to load expenses");
  return (await res.json()).expenses;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await clientFetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return (await res.json()).categories;
}

interface Props {
  month: string;
  currency?: string;
}

export default function ExpenseList({ month, currency = "INR" }: Props) {
  const qc = useQueryClient();
  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ["expenses", month],
    queryFn: () => fetchExpenses(month),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 60_000,
  });

  // Filters
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterNote, setFilterNote] = useState("");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<PopulatedExpense | null>(null);
  const [undoExpense, setUndoExpense] = useState<PopulatedExpense | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["expenses", month] });
      setDeleteError("Could not delete. Please try again.");
      setTimeout(() => setDeleteError(""), 4000);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["expenses", month] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  function handleDeleteConfirmed(expense: PopulatedExpense) {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      if (undoExpense) deleteMutation.mutate(undoExpense._id);
    }

    qc.setQueryData<PopulatedExpense[]>(["expenses", month], (old) =>
      (old ?? []).filter((e) => e._id !== expense._id)
    );

    setUndoExpense(expense);
    setActiveMenuId(null);
    setConfirmDeleteId(null);

    undoTimerRef.current = setTimeout(() => {
      deleteMutation.mutate(expense._id);
      setUndoExpense(null);
      undoTimerRef.current = null;
    }, 5000);
  }

  function handleUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    qc.invalidateQueries({ queryKey: ["expenses", month] });
    qc.invalidateQueries({ queryKey: ["summary"] });
    setUndoExpense(null);
  }

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = expenses;
    if (filterCategoryId) {
      result = result.filter((e) => e.categoryId._id === filterCategoryId);
    }
    if (filterNote.trim()) {
      const q = filterNote.trim().toLowerCase();
      result = result.filter((e) => e.note?.toLowerCase().includes(q));
    }
    return result;
  }, [expenses, filterCategoryId, filterNote]);

  const hasFilters = filterCategoryId !== "" || filterNote.trim() !== "";

  // Build export URL from current filters
  function exportUrl() {
    const params = new URLSearchParams({ month });
    if (filterCategoryId) params.set("categoryId", filterCategoryId);
    if (filterNote.trim()) params.set("note", filterNote.trim());
    return `/api/expenses/export?${params.toString()}`;
  }

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-6 text-center mt-2">
        <p className="text-sm text-red-500">Could not load expenses. Try refreshing.</p>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center mt-2">
        <p className="text-gray-400 text-sm">No expenses this month yet.</p>
        <p className="text-gray-300 text-xs mt-1">Tap + to add your first expense.</p>
      </div>
    );
  }

  const groups = filtered.reduce<Record<string, PopulatedExpense[]>>((acc, e) => {
    const key = e.date.substring(0, 10);
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <>
      {activeMenuId && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={() => {
            setActiveMenuId(null);
            setConfirmDeleteId(null);
          }}
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mt-2 mb-1">
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="search"
          placeholder="Search notes…"
          value={filterNote}
          onChange={(e) => setFilterNote(e.target.value)}
          className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white placeholder-gray-300 text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />

        <a
          href={exportUrl()}
          download
          title="Download CSV"
          className="flex-shrink-0 flex items-center justify-center w-8 h-[30px] border border-gray-200 rounded-lg bg-white text-gray-400 hover:text-violet-600 hover:border-violet-300 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>

      {/* No-results state when filters are active */}
      {filtered.length === 0 && hasFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center mt-2">
          <p className="text-gray-400 text-sm">No expenses match your filters.</p>
          <button
            onClick={() => { setFilterCategoryId(""); setFilterNote(""); }}
            className="mt-2 text-xs text-violet-500 hover:text-violet-700"
          >
            Clear filters
          </button>
        </div>
      )}

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
                    className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3"
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

                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeMenuId === expense._id) {
                            setActiveMenuId(null);
                            setConfirmDeleteId(null);
                          } else {
                            setActiveMenuId(expense._id);
                            setConfirmDeleteId(null);
                          }
                        }}
                        className="text-gray-300 hover:text-gray-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-50 text-lg leading-none"
                        aria-label="More options"
                        title="More options"
                      >
                        ⋮
                      </button>

                      {activeMenuId === expense._id && (
                        <div
                          className="absolute right-0 top-8 bg-white rounded-xl border border-gray-100 shadow-lg z-10 min-w-[160px] py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {confirmDeleteId === expense._id ? (
                            <div className="px-3 py-2.5">
                              <p className="text-xs font-medium text-gray-700 mb-2.5">
                                Delete this expense?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteConfirmed(expense)}
                                  className="flex-1 py-1.5 bg-red-500 text-white text-xs rounded-lg font-medium hover:bg-red-600"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmDeleteId(null);
                                    setActiveMenuId(null);
                                  }}
                                  className="flex-1 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditExpense(expense);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                              >
                                <span className="text-base leading-none">✎</span>
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(expense._id)}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5"
                              >
                                <span className="text-base leading-none">✕</span>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <AddExpenseSheet
        isOpen={!!editExpense}
        onClose={() => setEditExpense(null)}
        initialExpense={editExpense ?? undefined}
      />

      {undoExpense && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 bg-gray-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-lg mx-auto">
          <span className="flex-1">Expense deleted</span>
          <button
            onClick={handleUndo}
            className="text-violet-300 font-semibold hover:text-violet-200 py-0.5 px-2 rounded"
          >
            Undo
          </button>
        </div>
      )}

      {deleteError && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-lg mx-auto">
          <span className="flex-1">{deleteError}</span>
          <button onClick={() => setDeleteError("")} className="font-semibold hover:opacity-80 py-0.5 px-2 rounded">✕</button>
        </div>
      )}
    </>
  );
}
