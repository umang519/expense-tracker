# Expense Tracker — Project Roadmap

A mobile-first web app to replace a manual expense spreadsheet. Lets any user sign up,
record daily expenses across their own custom categories, log major one-off
transactions, and view monthly/yearly summaries — all from a phone or laptop.

> **Status:** ✅ MVP shipped and deployed (Phases 0–8 complete). Live on Vercel + MongoDB Atlas.
> The sections below from "Build Phases" onward now track what's done and what's next.

---

## 1. Goals

- **Primary:** Record an expense in under 5 seconds from a phone (the spreadsheet's job).
- Replace the manual Excel sheet entirely: daily tracking, yearly rollups, major transactions.
- Multi-user from day one — anyone can sign up; each user only ever sees their own data.
- Responsive and fast on mobile; usable on desktop.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | One codebase for UI + API |
| Backend | **Next.js Route Handlers (run on Node.js)** | This *is* the Node backend — no separate server needed |
| Database | **MongoDB Atlas (free tier) + Mongoose** | As requested; schemas + aggregation for summaries |
| Auth | **Email + password**, bcrypt hashing, JWT in an httpOnly cookie | Self-owned, simple, secure |
| Validation | **Zod** | One schema reused on client and server |
| Styling | **Tailwind CSS** (mobile-first) | Fast, consistent, responsive |
| Data fetching | **TanStack Query (React Query)** | Caching, optimistic updates for fast entry |
| Charts | **Recharts** | Category breakdowns, monthly trends |
| Deployment | **Vercel** (app + API) + **MongoDB Atlas** | Single deploy, free tiers |

---

## 3. Data Model

All summaries (totals, %, averages) are **computed at query time** via MongoDB aggregation.
They are never stored — expenses are the single source of truth.

### User
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `email` | string | unique, lowercased |
| `passwordHash` | string | bcrypt |
| `name` | string | optional |
| `currency` | string | default `"INR"` |
| `createdAt` / `updatedAt` | Date | |

### Category (per user)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | indexed |
| `name` | string | e.g. Food, Travel, Investments, Extras, or custom |
| `color` | string | hex, for charts/UI |
| `sortOrder` | number | display order |
| `isArchived` | boolean | hide without deleting (preserves history) |

> On signup, seed the four defaults: **Food, Travel, Investments, Extras**. Users add/edit/archive freely.

### Expense (the core record — one per individual expense, NOT one per day)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | indexed |
| `date` | Date | the day it occurred |
| `categoryId` | ObjectId | ref Category |
| `amount` | number | > 0 |
| `note` | string | optional — maps to the old "Reason" column |
| `createdAt` / `updatedAt` | Date | |

Compound index: `{ userId: 1, date: -1 }`.

### Transaction (major one-off transactions — the "Major Transactions" log)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | indexed |
| `date` | Date | |
| `amount` | number | |
| `type` | `"Dr"` \| `"Cr"` | debit / credit |
| `description` | string | e.g. "FD created for 444 days" |

---

## 4. Pages / Screens

1. **/register, /login** — email + password. Redirect to dashboard on success.
2. **/ (Dashboard)** — current month at a glance: total spent, per-category breakdown (donut),
   recent entries, and a prominent **+ Add Expense** button. The default mobile landing screen.
3. **Add Expense (modal/sheet)** — date (defaults to today), category dropdown, amount, optional note.
4. **/month/[yyyy-mm]** — all entries grouped by day, monthly total, per-category totals.
5. **/reports** — yearly view: month-by-month table, category %, averages, trend chart.
6. **/categories** — manage custom categories (add, rename, recolor, archive).
7. **/transactions** — major transactions list + add (date, amount, Dr/Cr, description).
8. **/settings** — name, currency, change password, logout.

---

## 5. API Endpoints (under `/app/api`)

```
POST   /api/auth/register      create user + seed default categories
POST   /api/auth/login         set httpOnly JWT cookie
POST   /api/auth/logout        clear cookie
GET    /api/auth/me            current user

GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id     (archive if it has expenses)

GET    /api/expenses?month=YYYY-MM        list for a month
POST   /api/expenses
PATCH  /api/expenses/:id
DELETE /api/expenses/:id

GET    /api/summary/monthly?month=YYYY-MM aggregated category totals
GET    /api/summary/yearly?year=YYYY      month-by-month + category %/avg

GET    /api/transactions
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
```

Every endpoint except register/login reads `userId` from the JWT and scopes all
queries to that user. A user can never query another user's data.

---

## 6. Build Phases — ✅ COMPLETE

- ✅ **Phase 0 — Setup:** Next.js + TS + Tailwind, MongoDB connection, env vars, Mongoose helper.
- ✅ **Phase 1 — Auth:** register/login/logout, password hashing, JWT cookie, route protection.
- ✅ **Phase 2 — Categories:** model + CRUD + seed-on-signup + management UI.
- ✅ **Phase 3 — Expenses:** model + CRUD + fast Add-Expense UI.
- ✅ **Phase 4 — Dashboard + monthly view.**
- ✅ **Phase 5 — Reports:** yearly aggregation, tables, charts.
- ✅ **Phase 6 — Major transactions.**
- ✅ **Phase 7 — Polish:** mobile refinements, states, settings, PWA meta.
- ✅ **Phase 8 — Deploy:** live on Vercel + Atlas.

---

## 7. Post-Launch Roadmap (next plan)

The MVP works. These build on it, roughly in priority order. Each is independent —
tackle them one at a time with Claude Code, same as before.

### Phase 9 — Import historical data (HIGHEST PRIORITY)
~5 months of real data already exists in the original Excel sheet, but the app starts empty,
so reports and averages have nothing to show. Build an importer so that data lives in the app.
- A `/settings/import` screen: upload a CSV (or the .xlsx).
- Server parses rows → maps columns (date, category, amount, note) → creates Expense docs.
- Map the sheet's four columns (Food/Travel/Investments/Extras) onto the seeded categories.
- Import the "Major Transactions" rows into the Transaction collection.
- Show a preview + confirm step before writing; report how many rows imported/skipped.
- *Tip: export each sheet section to CSV first; CSV parsing is far simpler than .xlsx parsing.*

### Phase 10 — Budgets & alerts
- Optional monthly budget per category (and an overall monthly budget).
- Dashboard shows progress bars (spent vs budget) and a visual warning when near/over.
- Model: a `Budget` collection — `userId`, `categoryId?`, `month`/recurring, `amount`.

### Phase 11 — Search, filter & export
- Filter expenses by category, date range, amount range, and note text.
- Export filtered results (and full history) to CSV — doubles as a personal backup.
- This closes the loop: data can come in (Phase 9) and go back out.

### Phase 12 — Recurring expenses & richer analytics
- Recurring entries (rent, subscriptions, monthly recharge) auto-created on a schedule.
- Month-over-month comparison, top-categories, and a calendar "spending heatmap".

### Phase 13 — Account security & management
- Password reset via email + email verification on signup.
- Login rate-limiting / lockout to resist brute force.
- "Export all my data" and "Delete my account" (privacy basics for a public userbase).

### Phase 14 — Offline-first / PWA hardening
- Confirm installability; add an app icon set and a complete manifest.
- Service worker for offline viewing of recent data.
- Queue new expenses entered while offline and sync when back online (true "add from anywhere").

### Phase 15 — Quality & operations
- Tests: unit tests for aggregation/auth logic, a couple of end-to-end flows (login → add → view).
- Error monitoring (e.g. Sentry) so production issues surface.
- Basic API rate limiting.

---

## 8. Security Checklist (keep enforcing)

- Passwords hashed with bcrypt (never stored or logged in plaintext).
- JWT in **httpOnly, Secure, SameSite** cookie (not localStorage).
- Every query scoped by `userId` from the verified token.
- Zod-validate every request body server-side.
- Secrets (`MONGODB_URI`, `JWT_SECRET`) only in env vars, never committed.
- Rotate any credential that has been shared or exposed.

---

## 9. Environment Variables

```
MONGODB_URI=         # MongoDB Atlas connection string
JWT_SECRET=          # long random string
NODE_ENV=
```
