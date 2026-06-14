"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/client-fetch";
import { formatAmount } from "@/lib/format";

interface Category {
  _id: string;
  name: string;
  color: string;
  sortOrder: number;
  isArchived: boolean;
}

interface Budget {
  _id: string;
  categoryId: string | null;
  amount: number;
}

const PRESET_COLORS = [
  "#F97316", "#EF4444", "#EC4899", "#A855F7",
  "#6366F1", "#3B82F6", "#06B6D4", "#10B981",
  "#84CC16", "#EAB308", "#F59E0B", "#78716C",
];

async function fetchCategories(): Promise<Category[]> {
  const res = await clientFetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  const data = await res.json();
  return data.categories;
}

async function fetchBudgets(): Promise<Budget[]> {
  const res = await clientFetch("/api/budgets");
  if (!res.ok) throw new Error("Failed to load budgets");
  const data = await res.json();
  return data.budgets;
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: fetchBudgets,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(""); // categoryId or "overall"

  const active = categories.filter((c) => !c.isArchived);
  const archived = categories.filter((c) => c.isArchived);

  // Build lookup: categoryId → budget
  const budgetMap = new Map<string, Budget>();
  let overallBudget: Budget | null = null;
  for (const b of budgets) {
    if (b.categoryId === null || b.categoryId == null) {
      overallBudget = b;
    } else {
      budgetMap.set(b.categoryId, b);
    }
  }

  // ── Category mutations ─────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setShowAddForm(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; color?: string } }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
      setArchiveConfirmId(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: archive ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: archive ? undefined : JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  // ── Budget mutations ───────────────────────────────────────────────────────

  const upsertBudget = useMutation({
    mutationFn: async ({ categoryId, amount }: { categoryId: string | null; amount: number }) => {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, amount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save budget");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      setEditingBudgetId("");
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to remove budget");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      setEditingBudgetId("");
    },
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto space-y-2 pt-20">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto pt-20">
          <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
            <p className="text-sm text-red-500">Could not load categories. Try refreshing.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-4">
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          {!showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); }}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span> Add
            </button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && (
          <CategoryForm
            onSave={(data) => addMutation.mutate(data)}
            onCancel={() => setShowAddForm(false)}
            saving={addMutation.isPending}
            error={addMutation.error?.message}
          />
        )}

        {/* Active categories */}
        {active.length === 0 && !showAddForm ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
            No categories yet. Add one above.
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((cat) =>
              editingId === cat._id ? (
                <li key={cat._id}>
                  <CategoryForm
                    initial={{ name: cat.name, color: cat.color }}
                    onSave={(data) => editMutation.mutate({ id: cat._id, data })}
                    onCancel={() => setEditingId(null)}
                    saving={editMutation.isPending}
                    error={editMutation.error?.message}
                  />
                </li>
              ) : (
                <li key={cat._id} className="bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-gray-800">
                      {cat.name}
                    </span>

                    {archiveConfirmId === cat._id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Archive?</span>
                        <button
                          onClick={() => {
                            archiveMutation.mutate({ id: cat._id, archive: true });
                            setArchiveConfirmId(null);
                          }}
                          className="text-xs text-red-500 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setArchiveConfirmId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Budget chip */}
                        {budgetMap.has(cat._id) ? (
                          <button
                            onClick={() => setEditingBudgetId(
                              editingBudgetId === cat._id ? "" : cat._id
                            )}
                            className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium hover:bg-violet-100 transition-colors"
                          >
                            ₹{formatAmount(budgetMap.get(cat._id)!.amount, "INR")}
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingBudgetId(
                              editingBudgetId === cat._id ? "" : cat._id
                            )}
                            className="text-xs text-gray-300 hover:text-violet-500 transition-colors px-1"
                            title="Set budget"
                          >
                            + budget
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(cat._id);
                            setShowAddForm(false);
                            setArchiveConfirmId(null);
                            setEditingBudgetId("");
                          }}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded"
                          aria-label="Edit category"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => setArchiveConfirmId(cat._id)}
                          disabled={archiveMutation.isPending}
                          className="text-gray-400 hover:text-red-500 p-1 rounded disabled:opacity-50"
                          aria-label="Archive category"
                        >
                          ⊖
                        </button>
                      </>
                    )}
                  </div>

                  {/* Inline budget editor */}
                  {editingBudgetId === cat._id && (
                    <BudgetInlineForm
                      current={budgetMap.get(cat._id) ?? null}
                      onSave={(amount) =>
                        upsertBudget.mutate({ categoryId: cat._id, amount })
                      }
                      onRemove={
                        budgetMap.has(cat._id)
                          ? () => deleteBudget.mutate(budgetMap.get(cat._id)!._id)
                          : undefined
                      }
                      onCancel={() => setEditingBudgetId("")}
                      saving={upsertBudget.isPending || deleteBudget.isPending}
                    />
                  )}
                </li>
              )
            )}
          </ul>
        )}

        {/* ── Monthly Budgets summary ──────────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Monthly Budgets
            </h2>
          </div>

          {/* Overall budget */}
          <div className="bg-white rounded-xl border border-gray-100 mb-2">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="w-4 h-4 rounded-full bg-violet-200 flex-shrink-0" />
              <span className="flex-1 text-sm font-medium text-gray-700">Overall (all categories)</span>
              {overallBudget ? (
                <button
                  onClick={() => setEditingBudgetId(
                    editingBudgetId === "overall" ? "" : "overall"
                  )}
                  className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium hover:bg-violet-100 transition-colors"
                >
                  ₹{formatAmount(overallBudget.amount, "INR")}
                </button>
              ) : (
                <button
                  onClick={() => setEditingBudgetId(
                    editingBudgetId === "overall" ? "" : "overall"
                  )}
                  className="text-xs text-gray-300 hover:text-violet-500 transition-colors px-1"
                >
                  + budget
                </button>
              )}
            </div>
            {editingBudgetId === "overall" && (
              <BudgetInlineForm
                current={overallBudget}
                onSave={(amount) => upsertBudget.mutate({ categoryId: null, amount })}
                onRemove={
                  overallBudget
                    ? () => deleteBudget.mutate(overallBudget!._id)
                    : undefined
                }
                onCancel={() => setEditingBudgetId("")}
                saving={upsertBudget.isPending || deleteBudget.isPending}
              />
            )}
          </div>

          <p className="text-xs text-gray-400 px-1">
            Budgets repeat every month. Set per-category limits above on each category row.
          </p>
        </div>

        {/* Archived section */}
        {archived.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              Archived ({archived.length})
            </h2>
            <ul className="space-y-2">
              {archived.map((cat) => (
                <li
                  key={cat._id}
                  className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3 opacity-60"
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-sm text-gray-500 line-through">{cat.name}</span>
                  <button
                    onClick={() => archiveMutation.mutate({ id: cat._id, archive: false })}
                    disabled={archiveMutation.isPending}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium px-2 py-1 rounded disabled:opacity-50"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Category add/edit form ─────────────────────────────────────────────────────

function CategoryForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: { name: string; color: string };
  onSave: (data: { name: string; color: string }) => void;
  onCancel: () => void;
  saving: boolean;
  error?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const normalized = trimmed[0].toUpperCase() + trimmed.slice(1);
    onSave({ name: normalized, color });
  }

  return (
    <div className="bg-white rounded-xl border border-violet-200 p-4 space-y-3 mb-2">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          placeholder="e.g. Groceries"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${
                color === c ? "ring-2 ring-offset-1 ring-violet-500 scale-110" : ""
              }`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Custom:</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs text-gray-500 font-mono">{color}</span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {saving ? "Saving…" : initial ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}

// ── Inline budget editor ───────────────────────────────────────────────────────

function BudgetInlineForm({
  current,
  onSave,
  onRemove,
  onCancel,
  saving,
}: {
  current: { amount: number } | null;
  onSave: (amount: number) => void;
  onRemove?: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(current ? String(current.amount) : "");

  function handleSave() {
    const n = parseFloat(value);
    if (!n || n <= 0) return;
    onSave(n);
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
      <p className="text-xs text-gray-500 mb-2">Monthly budget</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 5000"
            autoFocus
            className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !value || parseFloat(value) <= 0}
          className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {saving ? "…" : "Save"}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 text-sm transition-colors"
            title="Remove budget"
          >
            Remove
          </button>
        )}
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-sm transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
