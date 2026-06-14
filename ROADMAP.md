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

### Phase 9 — Import historical data ✅ COMPLETE
~5 months of real data imported from original Excel sheet. Expense and Transaction docs
created, preview + confirm step, import summary (rows imported/skipped). Data now lives in
the app and powers all reports.

### Phase 10 — PWA polish + Report enhancements ← NEXT
Two quick but high-value wins now that historical data exists:

**a) PWA icon & app identity**
- Replace placeholder icon with a proper app icon set (all required sizes for iOS/Android).
- Update `manifest.json`: name, short_name, theme_color, background_color.
- Makes the installed PWA feel like a real app on the home screen.

**b) Major transactions in reports**
- Include Dr/Cr transactions in the yearly and monthly report views alongside expenses.
- Show a separate "Major Transactions" section: credits, debits (non-investment), investments.
- Net movement card: total received − total spent (expenses + non-investment debits).
- Transactions should not distort per-category expense charts — keep them separate but visible.

**c) Richer report insights**
- Highest-spend category this month.
- Month-over-month delta ("You spent ₹X more on Food than last month").
- Average daily spend for the selected month/year.
- Biggest single expense.
- Fastest-growing category (comparing last 2–3 months).

### Phase 11 — Budgets & alerts
- Optional monthly budget per category (and an overall monthly budget).
- Dashboard shows progress bars (spent vs budget) and a visual warning when near/over limit.
- Model: a `Budget` collection — `userId`, `categoryId?`, `month`/recurring, `amount`.
- Budget vs. actual comparison visible on the monthly view and reports.

### Phase 12 — Search, filter & export
- Filter expenses by category, date range, amount range, and note text.
- Export filtered results (and full history) to CSV — personal backup + data portability.
- Monthly statement download (CSV). PIN/password protection optional in a later iteration.
- Closes the loop: data can come in (Phase 9) and go back out.

### Phase 13 — Recurring expenses
- Recurring entries (rent, subscriptions, phone recharge, EMIs, SIPs) auto-created on a schedule.
- User sets a template: category, amount, frequency (monthly/weekly), start date.
- Reduces manual entry for predictable costs and makes reports more accurate.

### Phase 14 — Gentle daily reminders (PWA push notifications)
- Optional daily nudge: "Log today's expenses?"
- Opt-in only, gentle, and useful — not engagement-bait.
- Leverage the existing PWA service worker; users must grant notification permission explicitly.

### Phase 15 — Dashboard quick-entry UX improvements
The app's primary goal is recording an expense in under 5 seconds. Further improvements:
- Amount keypad (numeric pad optimised for mobile).
- One-tap "repeat previous expense" shortcut.
- "Save and add another" flow for logging multiple items at once.
- Recent categories shown first in the category picker.

### Phase 16 — Account security, privacy & management
- Password reset via email + email verification on signup.
- Login rate-limiting / lockout to resist brute force.
- "Export all my data" (full JSON or CSV dump).
- "Delete my account" with data wipe — privacy essential before opening to more users.
- Optional: invitation link so a user can refer someone directly to the signup page.

### Phase 17 — Offline-first / PWA hardening
- Confirm installability end-to-end; complete icon set + manifest.
- Service worker for offline viewing of recent data.
- Queue expenses entered offline and sync when back online.

### Phase 18 — Quality & operations
- Unit tests for aggregation logic and auth helpers.
- A couple of end-to-end flows (login → add expense → view dashboard).
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
