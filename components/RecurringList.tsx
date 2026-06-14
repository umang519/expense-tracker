"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatAmount } from "@/lib/format";
import { clientFetch } from "@/lib/client-fetch";

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface RecurringEntry {
  _id: string;
  categoryId: Category;
  amount: number;
  note?: string;
  frequency: "monthly" | "weekly" | "weekdays";
  startDate: string;
  endDate: string | null;
  lastGeneratedDate: string | null;
  isActive: boolean;
}

interface Props {
  currency?: string;
}

async function fetchRecurring(): Promise<RecurringEntry[]> {
  const res = await clientFetch("/api/recurring");
  if (!res.ok) throw new Error("Failed to load");
  return (await res.json()).recurring;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await clientFetch("/api/categories");
  if (!res.ok) throw new Error("Failed");
  return (await res.json()).categories;
}

function ordinalSuffix(n: number) {
  if (n >= 11 && n <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function describeSchedule(freq: string, startDate: string): string {
  const d = new Date(startDate);
  if (freq === "monthly") return `Monthly · ${ordinalSuffix(d.getUTCDate())}`;
  if (freq === "weekdays") return "Mon – Fri (weekdays)";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  return `Weekly · ${d.toLocaleDateString("en-IN", opts)}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FormState {
  categoryId: string;
  amount: string;
  note: string;
  frequency: "monthly" | "weekly" | "weekdays";
  startDate: string;
  endDate: string;
}

const emptyForm: FormState = {
  categoryId: "",
  amount: "",
  note: "",
  frequency: "monthly",
  startDate: todayISO(),
  endDate: "",
};

const FREQUENCIES: { value: FormState["frequency"]; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
];

export default function RecurringList({ currency = "INR" }: Props) {
  const qc = useQueryClient();

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ["recurring"],
    queryFn: fetchRecurring,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 60_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const res = await clientFetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: data.categoryId,
          amount: parseFloat(data.amount),
          note: data.note || undefined,
          frequency: data.frequency,
          startDate: data.startDate,
          endDate: data.endDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError("");
      sessionStorage.removeItem("recurring_generated");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormState & { isActive: boolean }> }) => {
      const body: Record<string, unknown> = {};
      if (data.categoryId !== undefined) body.categoryId = data.categoryId;
      if (data.amount !== undefined) body.amount = typeof data.amount === "string" ? parseFloat(data.amount) : data.amount;
      if (data.note !== undefined) body.note = data.note || undefined;
      if (data.frequency !== undefined) body.frequency = data.frequency;
      if (data.startDate !== undefined) body.startDate = data.startDate;
      if ("endDate" in data) body.endDate = (data.endDate as string) || null;
      if (data.isActive !== undefined) body.isActive = data.isActive;

      const res = await clientFetch(`/api/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      setEditId(null);
      setForm(emptyForm);
      setFormError("");
      sessionStorage.removeItem("recurring_generated");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await clientFetch(`/api/recurring/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });

  function startEdit(entry: RecurringEntry) {
    setEditId(entry._id);
    setMenuId(null);
    setShowForm(false);
    setFormError("");
    setForm({
      categoryId: entry.categoryId._id,
      amount: String(entry.amount),
      note: entry.note ?? "",
      frequency: entry.frequency,
      startDate: new Date(entry.startDate).toISOString().substring(0, 10),
      endDate: entry.endDate ? new Date(entry.endDate).toISOString().substring(0, 10) : "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.categoryId) { setFormError("Pick a category"); return; }
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setFormError("Enter a valid amount"); return; }
    if (form.endDate && form.endDate <= form.startDate) {
      setFormError("End date must be after start date");
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const startDateLabel =
    form.frequency === "monthly"
      ? "First occurrence (fixes the day of month)"
      : form.frequency === "weekdays"
      ? "Start from"
      : "First occurrence (fixes the weekday)";

  const FormPanel = (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-violet-100 p-4 space-y-3"
    >
      <p className="text-sm font-semibold text-gray-800">
        {editId ? "Edit recurring expense" : "New recurring expense"}
      </p>

      {/* Category */}
      <select
        value={form.categoryId}
        onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
      >
        <option value="">Select category…</option>
        {categories.map((c) => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>

      {/* Amount */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">₹</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      {/* Note */}
      <input
        type="text"
        placeholder="Note (optional)"
        value={form.note}
        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
      />

      {/* Frequency */}
      <div className="flex gap-2">
        {FREQUENCIES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setForm((f) => ({ ...f, frequency: value }))}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
              form.frequency === value
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-violet-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Weekdays helper text */}
      {form.frequency === "weekdays" && (
        <p className="text-xs text-gray-400 -mt-1">
          Logs one entry every Mon – Fri. Weekends are skipped automatically.
        </p>
      )}

      {/* Start date */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">{startDateLabel}</label>
        <input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      {/* End date (optional) */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          End date <span className="text-gray-300">(optional — leave blank to repeat indefinitely)</span>
        </label>
        <input
          type="date"
          value={form.endDate}
          min={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      {formError && <p className="text-xs text-red-500">{formError}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Saving…" : editId ? "Save changes" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); setFormError(""); }}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-3">
      {!showForm && !editId && (
        <button
          onClick={() => { setShowForm(true); setForm({ ...emptyForm, startDate: todayISO() }); }}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-violet-200 text-violet-500 text-sm font-medium hover:border-violet-400 hover:bg-violet-50 transition-colors"
        >
          + Add recurring expense
        </button>
      )}

      {showForm && FormPanel}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-white rounded-2xl border border-red-100 p-6 text-center">
          <p className="text-sm text-red-500">Could not load recurring expenses.</p>
        </div>
      )}

      {!isLoading && !isError && entries.length === 0 && !showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400 text-sm">No recurring expenses yet.</p>
          <p className="text-gray-300 text-xs mt-1">Add rent, SIPs, or subscriptions above.</p>
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry._id}>
          {editId === entry._id ? FormPanel : (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${!entry.isActive ? "opacity-30" : ""}`}
                style={{ backgroundColor: entry.categoryId.color }}
              />

              <div className={`flex-1 min-w-0 ${!entry.isActive ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{entry.categoryId.name}</span>
                  {!entry.isActive && (
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      PAUSED
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {describeSchedule(entry.frequency, entry.startDate)}
                  {entry.note ? ` · ${entry.note}` : ""}
                  {entry.endDate ? ` · until ${shortDate(entry.endDate)}` : ""}
                </p>
              </div>

              <span className="text-sm font-semibold text-gray-800 flex-shrink-0">
                {formatAmount(entry.amount, currency)}
              </span>

              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuId(menuId === entry._id ? null : entry._id)}
                  className="text-gray-300 hover:text-gray-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-50 text-lg leading-none"
                >
                  ⋮
                </button>
                {menuId === entry._id && (
                  <>
                    <div className="fixed inset-0 z-[5]" onClick={() => setMenuId(null)} />
                    <div className="absolute right-0 top-8 bg-white rounded-xl border border-gray-100 shadow-lg z-10 min-w-[160px] py-1">
                      <button
                        onClick={() => startEdit(entry)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                      >
                        <span className="text-base leading-none">✎</span> Edit
                      </button>
                      <button
                        onClick={() => {
                          updateMutation.mutate({ id: entry._id, data: { isActive: !entry.isActive } });
                          setMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                      >
                        <span className="text-base leading-none">{entry.isActive ? "⏸" : "▶"}</span>
                        {entry.isActive ? "Pause" : "Resume"}
                      </button>
                      <button
                        onClick={() => { deleteMutation.mutate(entry._id); setMenuId(null); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5"
                      >
                        <span className="text-base leading-none">✕</span> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {entries.length > 0 && (
        <div className="bg-violet-50 rounded-2xl border border-violet-100 px-4 py-3">
          <p className="text-xs text-violet-600">
            Expenses are logged automatically when you open the app. Paused or expired entries are skipped.
          </p>
        </div>
      )}
    </div>
  );
}
