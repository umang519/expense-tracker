# Expense Tracker — Project Roadmap

A mobile-first web app to replace a manual expense spreadsheet. Lets any user sign up,
record daily expenses across their own custom categories, log major one-off
transactions, and view monthly/yearly summaries — all from a phone or laptop.

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

> **Why not a separate Express server?** Next.js route handlers already run on Node.js
> with full access to MongoDB. A separate Express service would only add a second thing to
> deploy, a second thing to keep in sync, and CORS configuration — with no benefit at this
> scale. The API layer can be extracted later if ever needed.

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
   Optimized for speed; this is the most-used action.
4. **/month/[yyyy-mm]** — all entries grouped by day, monthly total, per-category totals. Mirrors the old daily tracker.
5. **/reports** — yearly view: month-by-month table (per-category totals + grand total),
   category %, category averages, and a trend chart. Mirrors the yearly summary.
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

## 6. Build Phases (milestones)

- **Phase 0 — Setup:** Next.js + TS + Tailwind scaffold, MongoDB Atlas connection, env vars, Mongoose connection helper.
- **Phase 1 — Auth:** register/login/logout, password hashing, JWT cookie, route protection (middleware), `/api/auth/me`.
- **Phase 2 — Categories:** model + CRUD + seed-on-signup + management UI.
- **Phase 3 — Expenses (core):** model + CRUD + fast Add-Expense UI with optimistic updates.
- **Phase 4 — Dashboard + monthly view:** current-month overview, per-day grouping, totals.
- **Phase 5 — Reports:** yearly aggregation, tables, category %, averages, charts.
- **Phase 6 — Major transactions:** model + CRUD + UI.
- **Phase 7 — Polish:** mobile refinements, empty/error/loading states, settings, optional PWA (installable on phone).
- **Phase 8 — Deploy:** Vercel + Atlas, production env vars, smoke test.

Ship Phases 0–4 first — that alone replaces the spreadsheet for daily use.

---

## 7. Mobile & UX Notes

- Mobile-first Tailwind: design for ~380px width, scale up.
- Add-Expense reachable in one tap from anywhere (floating button).
- Amount field uses numeric keypad (`inputMode="decimal"`).
- Optional PWA manifest so it installs to the home screen and feels app-like.

---

## 8. Security Checklist

- Passwords hashed with bcrypt (never stored or logged in plaintext).
- JWT in **httpOnly, Secure, SameSite** cookie (not localStorage).
- Every query scoped by `userId` from the verified token.
- Zod-validate every request body server-side.
- Secrets (`MONGODB_URI`, `JWT_SECRET`) only in env vars, never committed.

---

## 9. Environment Variables

```
MONGODB_URI=         # MongoDB Atlas connection string
JWT_SECRET=          # long random string
NODE_ENV=
```
