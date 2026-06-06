"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, PopulatedExpense } from "@/lib/types";
import { clientFetch } from "@/lib/client-fetch";

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await clientFetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return (await res.json()).categories;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialExpense?: PopulatedExpense; // when set = edit mode
}

export default function AddExpenseSheet({ isOpen, onClose, initialExpense }: Props) {
  const qc = useQueryClient();
  const isEdit = !!initialExpense;

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    enabled: isOpen,
  });

  // In edit mode, include the expense's category even if archived
  const categories = allCategories.filter(
    (c) => !c.isArchived || (isEdit && c._id === initialExpense?.categoryId._id)
  );

  const [date, setDate] = useState(todayString);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // Pre-select first category once loaded (add mode only)
  useEffect(() => {
    if (categories.length > 0 && !categoryId && !isEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId(categories[0]._id);
    }
  }, [categories, categoryId, isEdit]);

  // Reset / pre-fill when sheet opens or target expense changes
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("");
      if (initialExpense) {
        setDate(initialExpense.date.substring(0, 10));
        setCategoryId(initialExpense.categoryId._id);
        setAmount(String(initialExpense.amount));
        setNote(initialExpense.note ?? "");
      } else {
        setDate(todayString());
        setAmount("");
        setNote("");
        setCategoryId(categories[0]?._id ?? "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialExpense]);

  // ── Add mutation ────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async (data: {
      date: string;
      categoryId: string;
      amount: number;
      note?: string;
    }) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to add expense");
      }
      return (await res.json()).expense as PopulatedExpense;
    },
    onMutate: async (newData) => {
      const month = newData.date.substring(0, 7);
      await qc.cancelQueries({ queryKey: ["expenses", month] });
      const prev = qc.getQueryData<PopulatedExpense[]>(["expenses", month]);

      const cat = categories.find((c) => c._id === newData.categoryId);
      const optimistic: PopulatedExpense = {
        _id: `optimistic-${Date.now()}`, // eslint-disable-line react-hooks/purity
        date: newData.date + "T00:00:00.000Z",
        amount: newData.amount,
        note: newData.note,
        categoryId: cat
          ? { _id: cat._id, name: cat.name, color: cat.color }
          : { _id: newData.categoryId, name: "…", color: "#d1d5db" },
      };

      qc.setQueryData<PopulatedExpense[]>(["expenses", month], (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { prev, month };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(["expenses", ctx.month], ctx.prev);
      setError(err.message);
    },
    onSuccess: () => {
      onClose();
    },
    onSettled: (_data, _err, vars) => {
      const month = vars.date.substring(0, 7);
      qc.invalidateQueries({ queryKey: ["expenses", month] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  // ── Edit mutation ────────────────────────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async (data: {
      date: string;
      categoryId: string;
      amount: number;
      note?: string;
    }) => {
      const res = await fetch(`/api/expenses/${initialExpense!._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update expense");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const isPending = addMutation.isPending || editMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!categoryId) {
      setError("Select a category");
      return;
    }
    const payload = {
      date,
      categoryId,
      amount: parsedAmount,
      note: note.trim(),
    };
    if (isEdit) {
      editMutation.mutate(payload);
    } else {
      addMutation.mutate(payload);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-2xl p-5 pb-8 max-w-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "Edit Expense" : "Add Expense"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount — most prominent field */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              inputMode="decimal"
              required
              min="0.01"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              placeholder="0"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setCategoryId(cat._id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    categoryId === cat._id
                      ? "border-transparent text-white font-medium"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  style={
                    categoryId === cat._id
                      ? { backgroundColor: cat.color }
                      : {}
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. lunch, petrol…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors text-base"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}
