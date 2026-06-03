"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatAmount } from "@/lib/format";
import { clientFetch } from "@/lib/client-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transaction {
  _id: string;
  date: string;
  amount: number;
  type: "Dr" | "Cr";
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTxDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function fetchTransactions(): Promise<Transaction[]> {
  const res = await clientFetch("/api/transactions");
  if (!res.ok) throw new Error("Failed to load transactions");
  return (await res.json()).transactions;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [sheetMode, setSheetMode] = useState<null | "add" | Transaction>(null);

  const { data: transactions = [], isLoading, isError } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
  });

  // ── Delete ───────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const prev = qc.getQueryData<Transaction[]>(["transactions"]);
      qc.setQueryData<Transaction[]>(["transactions"], (old) =>
        (old ?? []).filter((t) => t._id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["transactions"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  // ── Summary ──────────────────────────────────────────────────────────────

  const totalDr = transactions
    .filter((t) => t.type === "Dr")
    .reduce((s, t) => s + t.amount, 0);
  const totalCr = transactions
    .filter((t) => t.type === "Cr")
    .reduce((s, t) => s + t.amount, 0);
  const net = totalCr - totalDr;

  // ── Group by year ────────────────────────────────────────────────────────

  const groups = transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
    const year = t.date.substring(0, 4);
    (acc[year] ??= []).push(t);
    return acc;
  }, {});
  const years = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
            <p className="text-sm text-gray-500">Major one-off entries</p>
          </div>
          <button
            onClick={() => setSheetMode("add")}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span> Add
          </button>
        </div>

        {/* Summary card */}
        {transactions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Debit</p>
              <p className="text-sm font-bold text-red-500">
                {formatAmount(totalDr)}
              </p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Credit</p>
              <p className="text-sm font-bold text-emerald-500">
                {formatAmount(totalCr)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">Net</p>
              <p
                className={`text-sm font-bold ${net >= 0 ? "text-emerald-500" : "text-red-500"}`}
              >
                {net >= 0 ? "+" : ""}
                {formatAmount(Math.abs(net))}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
            <p className="text-sm text-red-500">Could not load transactions. Try refreshing.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && transactions.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
            No transactions yet. Tap + Add to record one.
          </div>
        )}

        {/* Grouped list */}
        {!isLoading && !isError && years.map((year) => {
          const yearTxs = groups[year];
          const yearDr = yearTxs.filter((t) => t.type === "Dr").reduce((s, t) => s + t.amount, 0);
          const yearCr = yearTxs.filter((t) => t.type === "Cr").reduce((s, t) => s + t.amount, 0);

          return (
            <div key={year} className="mb-6">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {year}
                </span>
                <span className="text-xs text-gray-400">
                  Dr {formatAmount(yearDr)} · Cr {formatAmount(yearCr)}
                </span>
              </div>

              <ul className="space-y-2">
                {yearTxs.map((tx) => (
                  <li
                    key={tx._id}
                    className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3 group"
                  >
                    {/* Type badge */}
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                        tx.type === "Dr"
                          ? "bg-red-50 text-red-500"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {tx.type}
                    </span>

                    {/* Description + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {tx.description}
                      </p>
                      <p className="text-xs text-gray-400">{formatTxDate(tx.date)}</p>
                    </div>

                    {/* Amount */}
                    <span
                      className={`text-sm font-bold flex-shrink-0 ${
                        tx.type === "Dr" ? "text-red-500" : "text-emerald-600"
                      }`}
                    >
                      {tx.type === "Dr" ? "−" : "+"}
                      {formatAmount(tx.amount)}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setSheetMode(tx)}
                        className="text-gray-400 hover:text-violet-500 p-1 rounded"
                        aria-label="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(tx._id)}
                        disabled={deleteMutation.isPending}
                        className="text-gray-400 hover:text-red-500 p-1 rounded disabled:opacity-30"
                        aria-label="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Add / Edit sheet */}
      {sheetMode !== null && (
        <TransactionSheet
          initial={sheetMode === "add" ? undefined : sheetMode}
          onClose={() => setSheetMode(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["transactions"] });
            setSheetMode(null);
          }}
        />
      )}
    </main>
  );
}

// ── Add / Edit sheet ──────────────────────────────────────────────────────────

function TransactionSheet({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(
    initial ? initial.date.substring(0, 10) : todayString()
  );
  const [type, setType] = useState<"Dr" | "Cr">(initial?.type ?? "Dr");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    setSaving(true);
    const payload = { date, type, amount: parsedAmount, description: description.trim() };
    const url = initial ? `/api/transactions/${initial._id}` : "/api/transactions";
    const method = initial ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Something went wrong");
      return;
    }

    onSaved();
  }

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
            {initial ? "Edit Transaction" : "Add Transaction"}
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
          {/* Dr / Cr toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("Dr")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  type === "Dr"
                    ? "border-red-400 bg-red-50 text-red-500"
                    : "border-gray-200 text-gray-400 hover:border-gray-300"
                }`}
              >
                Dr — Debit
              </button>
              <button
                type="button"
                onClick={() => setType("Cr")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  type === "Cr"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                    : "border-gray-200 text-gray-400 hover:border-gray-300"
                }`}
              >
                Cr — Credit
              </button>
            </div>
          </div>

          {/* Amount */}
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
              autoFocus={!initial}
              placeholder="0"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="e.g. FD created for 444 days"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors text-base"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Add Transaction"}
          </button>
        </form>
      </div>
    </div>
  );
}
