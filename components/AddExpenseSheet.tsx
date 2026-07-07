"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, PopulatedExpense } from "@/lib/types";
import { clientFetch } from "@/lib/client-fetch";
import { enqueue } from "@/lib/offlineQueue";

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await clientFetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return (await res.json()).categories;
}

function getRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("recentCategories") ?? "[]"); }
  catch { return []; }
}

function saveRecentId(id: string) {
  const prev = getRecentIds().filter((x) => x !== id);
  localStorage.setItem("recentCategories", JSON.stringify([id, ...prev].slice(0, 6)));
}

function sortByRecent(cats: Category[]): Category[] {
  const ids = getRecentIds();
  return [...cats].sort((a, b) => {
    const ai = ids.indexOf(a._id), bi = ids.indexOf(b._id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialExpense?: PopulatedExpense;
}

export default function AddExpenseSheet({ isOpen, onClose, initialExpense }: Props) {
  const qc = useQueryClient();
  const isEdit = !!initialExpense;
  const keepOpenRef = useRef(false);

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    enabled: isOpen,
  });

  const categories = allCategories.filter(
    (c) => !c.isArchived || (isEdit && c._id === initialExpense?.categoryId._id)
  );
  const sortedCategories = sortByRecent(categories);

  // Quick-fill: last 3 unique (category + amount) combos from this month's cache
  const cachedExpenses =
    qc.getQueryData<PopulatedExpense[]>(["expenses", todayString().substring(0, 7)]) ?? [];
  const quickFills = cachedExpenses
    .reduce<PopulatedExpense[]>((acc, exp) => {
      const key = `${exp.categoryId._id}|${exp.amount}`;
      if (!acc.find((e) => `${e.categoryId._id}|${e.amount}` === key)) acc.push(exp);
      return acc;
    }, [])
    .slice(0, 3);

  const [date, setDate] = useState(todayString);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [mergeCandidate, setMergeCandidate] = useState<PopulatedExpense | null>(null);

  // Pre-select first (most-recent) category when categories load
  useEffect(() => {
    if (sortedCategories.length > 0 && !categoryId && !isEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId(sortedCategories[0]._id);
    }
  }, [sortedCategories, categoryId, isEdit]);

  // Reset / pre-fill when sheet opens or edit target changes
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setMergeCandidate(null);
    if (initialExpense) {
      setDate(initialExpense.date.substring(0, 10));
      setCategoryId(initialExpense.categoryId._id);
      setAmount(String(initialExpense.amount));
      setNote(initialExpense.note ?? "");
    } else {
      setDate(todayString());
      setAmount("");
      setNote("");
      setCategoryId(sortByRecent(categories)[0]?._id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialExpense]);

  // ── Keypad ─────────────────────────────────────────────────────────────────

  function handleKey(key: string) {
    setError("");
    if (key === "⌫") { setAmount((p) => p.slice(0, -1)); return; }
    if (key === ".") {
      if (amount.includes(".")) return;
      setAmount((p) => (p === "" ? "0." : p + "."));
      return;
    }
    const parts = amount.split(".");
    if (parts.length === 2 && parts[1].length >= 2) return; // max 2 decimal places
    if (amount === "0") { setAmount(key); return; }
    setAmount((p) => p + key);
  }

  function applyQuickFill(exp: PopulatedExpense) {
    setAmount(String(exp.amount));
    setCategoryId(exp.categoryId._id);
    setNote(exp.note ?? "");
    setError("");
  }

  // ── Add mutation ────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async (data: {
      date: string; categoryId: string; amount: number; note?: string;
    }) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to add expense"); }
      return (await res.json()).expense as PopulatedExpense;
    },
    onMutate: async (newData) => {
      const m = newData.date.substring(0, 7);
      await qc.cancelQueries({ queryKey: ["expenses", m] });
      const prev = qc.getQueryData<PopulatedExpense[]>(["expenses", m]);
      const cat = categories.find((c) => c._id === newData.categoryId);
      const optimistic: PopulatedExpense = {
        _id: `optimistic-${Date.now()}`,
        date: newData.date + "T00:00:00.000Z",
        amount: newData.amount,
        note: newData.note,
        categoryId: cat
          ? { _id: cat._id, name: cat.name, color: cat.color }
          : { _id: newData.categoryId, name: "…", color: "#d1d5db" },
      };
      qc.setQueryData<PopulatedExpense[]>(["expenses", m], (old) => [optimistic, ...(old ?? [])]);
      return { prev, month: m };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(["expenses", ctx.month], ctx.prev);
      setError(err.message);
    },
    onSuccess: (_data, vars) => {
      saveRecentId(vars.categoryId);
      if (keepOpenRef.current) {
        setAmount("");
        setNote("");
        setError("");
        keepOpenRef.current = false;
      } else {
        onClose();
      }
    },
    onSettled: (_data, _err, vars) => {
      const m = vars.date.substring(0, 7);
      qc.invalidateQueries({ queryKey: ["expenses", m] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  // ── Edit mutation ────────────────────────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async (data: {
      date: string; categoryId: string; amount: number; note?: string;
    }) => {
      const res = await fetch(`/api/expenses/${initialExpense!._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to update expense"); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  // ── Merge mutation ──────────────────────────────────────────────────────────

  const mergeMutation = useMutation({
    mutationFn: async (data: {
      id: string; date: string; categoryId: string; amount: number; note?: string;
    }) => {
      const res = await fetch(`/api/expenses/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: data.date, categoryId: data.categoryId, amount: data.amount, note: data.note }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to merge"); }
    },
    onSuccess: (_data, vars) => {
      saveRecentId(vars.categoryId);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const isPending = addMutation.isPending || editMutation.isPending || mergeMutation.isPending;

  function handleSave(keepOpen: boolean) {
    setError("");
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount"); return; }
    if (!categoryId) { setError("Select a category"); return; }

    // Detect same-category + same-date entry and prompt to merge
    if (!isEdit) {
      const duplicate = cachedExpenses.find(
        (e) => e.categoryId._id === categoryId && e.date.substring(0, 10) === date
      );
      if (duplicate) { setMergeCandidate(duplicate); return; }
    }

    const payload = { date, categoryId, amount: parsed, note: note.trim() };

    // Offline path: queue expense and add optimistic item to cache
    if (!navigator.onLine && !isEdit) {
      const cat = categories.find((c) => c._id === categoryId);
      const m = date.substring(0, 7);
      const pending = enqueue(payload);
      const optimistic: PopulatedExpense = {
        _id: `pending-${pending.id}`,
        date: date + "T00:00:00.000Z",
        amount: parsed,
        note: note.trim() || undefined,
        categoryId: cat
          ? { _id: cat._id, name: cat.name, color: cat.color }
          : { _id: categoryId, name: "…", color: "#d1d5db" },
      };
      qc.setQueryData<PopulatedExpense[]>(["expenses", m], (old) => [optimistic, ...(old ?? [])]);
      saveRecentId(categoryId);
      if (keepOpen) {
        setAmount("");
        setNote("");
        setError("");
      } else {
        onClose();
      }
      return;
    }

    keepOpenRef.current = keepOpen;
    if (isEdit) editMutation.mutate(payload);
    else addMutation.mutate(payload);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white dark:bg-gray-900 rounded-t-2xl max-h-[92vh] overflow-y-auto max-w-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? "Edit Expense" : "Add Expense"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Quick-fill chips */}
        {!isEdit && quickFills.length > 0 && (
          <div className="px-5 pb-3">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Repeat recent</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {quickFills.map((exp) => (
                <button
                  key={exp._id}
                  type="button"
                  onClick={() => applyQuickFill(exp)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-500/10 active:bg-violet-100 transition-colors select-none"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: exp.categoryId.color }} />
                  <span className="font-semibold">₹{exp.amount}</span>
                  <span className="text-gray-400 dark:text-gray-500">{exp.categoryId.name}{exp.note ? ` · ${exp.note}` : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount display */}
        <div className="px-5 pb-3 text-center">
          <div className={`text-4xl font-bold tracking-tight transition-colors ${amount ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600"}`}>
            ₹{amount || "0"}
          </div>
        </div>

        {/* Category */}
        <div className="px-5 pb-3">
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {sortedCategories.map((cat) => (
              <button
                key={cat._id}
                type="button"
                onClick={() => setCategoryId(cat._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors select-none ${
                  categoryId === cat._id
                    ? "border-transparent text-white font-medium"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                style={categoryId === cat._id ? { backgroundColor: cat.color } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Date + Note side by side */}
        <div className="px-5 pb-3 flex gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
              Note <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. lunch…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="px-5 pb-2">
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {/* Merge prompt */}
        {mergeCandidate && (
          <div className="px-5 pb-3">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2.5">
                ₹{mergeCandidate.amount} {mergeCandidate.categoryId.name} already logged on this date
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={mergeMutation.isPending}
                  onClick={() =>
                    mergeMutation.mutate({
                      id: mergeCandidate._id,
                      date: mergeCandidate.date.substring(0, 10),
                      categoryId: mergeCandidate.categoryId._id,
                      amount: mergeCandidate.amount + parseFloat(amount),
                      note: mergeCandidate.note,
                    })
                  }
                  className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {mergeMutation.isPending ? "Merging…" : `Merge → ₹${mergeCandidate.amount + (parseFloat(amount) || 0)}`}
                </button>
                <button
                  type="button"
                  disabled={addMutation.isPending}
                  onClick={() => {
                    setMergeCandidate(null);
                    keepOpenRef.current = false;
                    addMutation.mutate({ date, categoryId, amount: parseFloat(amount), note: note.trim() });
                  }}
                  className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Keep separate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 border-t border-gray-100 dark:border-gray-800">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKey(key)}
              className={`py-2.5 text-lg font-medium transition-colors select-none active:bg-gray-100
                ${key === "⌫" ? "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" : "text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"}
                border-b border-r border-gray-100 dark:border-gray-800 last:border-r-0
              `}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="px-5 pt-3 pb-8 space-y-2">
          {!isEdit && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isPending}
              className="w-full py-3 rounded-xl border-2 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Save &amp; add another
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isPending}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors text-base"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
