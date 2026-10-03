const QUEUE_KEY = "et:pendingExpenses";
const QUEUE_EVENT = "et:queue-changed";

export interface PendingExpense {
  id: string;
  date: string;
  categoryId: string;
  amount: number;
  note?: string;
  queuedAt: number;
}

function dispatch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
  }
}

export function getQueue(): PendingExpense[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function enqueue(payload: Omit<PendingExpense, "id" | "queuedAt">): PendingExpense {
  const item: PendingExpense = {
    ...payload,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queuedAt: Date.now(),
  };
  const queue = getQueue();
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, item]));
  dispatch();
  return item;
}

export function dequeue(id: string) {
  const queue = getQueue().filter((item) => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  dispatch();
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
  dispatch();
}

// POSTs every queued expense; successful ones are dequeued, failures (still
// offline, server error) stay queued. Returns how many were synced.
export async function flushQueue(): Promise<number> {
  let synced = 0;
  for (const item of getQueue()) {
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: item.date,
          categoryId: item.categoryId,
          amount: item.amount,
          note: item.note || undefined,
        }),
      });
      if (res.ok) {
        dequeue(item.id);
        synced++;
      }
    } catch {
      // Still offline for this item — leave in queue
    }
  }
  return synced;
}

export const QUEUE_CHANGED_EVENT = QUEUE_EVENT;
