"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Category {
  _id: string;
  name: string;
  color: string;
  sortOrder: number;
  isArchived: boolean;
}

const PRESET_COLORS = [
  "#F97316", "#EF4444", "#EC4899", "#A855F7",
  "#6366F1", "#3B82F6", "#06B6D4", "#10B981",
  "#84CC16", "#EAB308", "#F59E0B", "#78716C",
];

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  const data = await res.json();
  return data.categories;
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = categories.filter((c) => !c.isArchived);
  const archived = categories.filter((c) => c.isArchived);

  // ── Add ────────────────────────────────────────────────────────────────────

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

  // ── Edit ───────────────────────────────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; color?: string };
    }) => {
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
    },
  });

  // ── Archive / Unarchive / Delete ───────────────────────────────────────────

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

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto pt-8 text-center text-gray-400 text-sm">
          Loading…
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
              onClick={() => {
                setShowAddForm(true);
                setEditingId(null);
              }}
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
                    onSave={(data) =>
                      editMutation.mutate({ id: cat._id, data })
                    }
                    onCancel={() => setEditingId(null)}
                    saving={editMutation.isPending}
                    error={editMutation.error?.message}
                  />
                </li>
              ) : (
                <li
                  key={cat._id}
                  className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3"
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-800">
                    {cat.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(cat._id);
                      setShowAddForm(false);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded"
                    aria-label="Edit"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() =>
                      archiveMutation.mutate({ id: cat._id, archive: true })
                    }
                    disabled={archiveMutation.isPending}
                    className="text-gray-400 hover:text-red-500 p-1 rounded disabled:opacity-50"
                    aria-label="Archive"
                  >
                    ⊖
                  </button>
                </li>
              )
            )}
          </ul>
        )}

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
                  <span className="flex-1 text-sm text-gray-500 line-through">
                    {cat.name}
                  </span>
                  <button
                    onClick={() =>
                      archiveMutation.mutate({ id: cat._id, archive: false })
                    }
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

// ── Reusable add/edit form ─────────────────────────────────────────────────────

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
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  }

  return (
    <div className="bg-white rounded-xl border border-violet-200 p-4 space-y-3 mb-2">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
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
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Color
        </label>
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
