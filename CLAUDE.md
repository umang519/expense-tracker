# CLAUDE.md

Project memory for Claude Code. Read this before making changes.

## What this is

A mobile-first expense tracker that replaces a manual spreadsheet. Multi-user: anyone can
sign up, and each user records daily expenses across their own custom categories, logs major
one-off transactions, and views monthly/yearly summaries. Currency defaults to INR.

## Stack

- **Next.js 15 (App Router) + React 19 + TypeScript** — UI and backend in one app.
- **Backend = Next.js Route Handlers** (`app/api/**/route.ts`), running on Node.js. Do NOT add a separate Express server.
- **MongoDB Atlas + Mongoose** for persistence.
- **Auth:** email + password. bcrypt for hashing, JWT stored in an **httpOnly cookie**.
- **Zod** for validation (shared client + server). **Tailwind CSS** for styling. **TanStack Query** for client data. **Recharts** for charts.

## Commands

```bash
npm run dev      # local dev
npm run build    # production build
npm run lint     # eslint
npm run start    # run production build
```

## Folder structure

```
app/
  (auth)/login/        register/        # auth pages
  (app)/                                # protected pages: dashboard, month, reports, categories, transactions, settings
  api/
    auth/{register,login,logout,me}/route.ts
    categories/route.ts        categories/[id]/route.ts
    expenses/route.ts          expenses/[id]/route.ts
    summary/{monthly,yearly}/route.ts
    transactions/route.ts      transactions/[id]/route.ts
lib/
  db.ts            # cached Mongoose connection (reuse across hot reloads)
  auth.ts          # hash/verify password, sign/verify JWT, getUserFromRequest
  validation.ts    # Zod schemas
models/            # Mongoose models: User, Category, Expense, Transaction
components/        # UI components
proxy.ts           # protects (app) routes, redirects unauthenticated users to /login
```

## Data models

Summaries are **computed via MongoDB aggregation at query time** — never stored.
Expenses are the single source of truth.

- **User**: `email` (unique, lowercased), `passwordHash`, `name?`, `currency` (default `"INR"`).
- **Category** (per user): `userId`, `name`, `color`, `sortOrder`, `isArchived`. Seed 4 defaults on signup: Food, Travel, Investments, Extras.
- **Expense** (one doc per expense, NOT per day): `userId`, `date`, `categoryId`, `amount` (>0), `note?`. Index `{ userId: 1, date: -1 }`.
- **Transaction** (major one-offs): `userId`, `date`, `amount`, `type: "Dr" | "Cr"`, `description`.

## Non-negotiable rules

1. **Every** data query is scoped by `userId` taken from the verified JWT. A user must never be able to read or write another user's data. Never trust a `userId` from the request body or query string.
2. Validate every request body with Zod on the server before touching the DB.
3. JWT goes in an **httpOnly, Secure, SameSite** cookie. Never put tokens in localStorage. Never return `passwordHash` in any response.
4. Use the cached Mongoose connection in `lib/db.ts` — do not call `mongoose.connect` per request (breaks under serverless/hot reload).
5. Don't store computed totals/averages. Aggregate on read.
6. Don't delete a category that has expenses — archive it (`isArchived: true`) to preserve history.
7. Money is stored as a plain `number`. Validate `amount > 0` for expenses.

## API conventions

- Route handlers return JSON with proper status codes (`200/201/400/401/404/500`).
- Auth check first in every protected handler: resolve user → `401` if missing.
- List endpoints accept query params (`?month=YYYY-MM`, `?year=YYYY`) and filter by them.
- Keep request/response shapes typed; reuse Zod-inferred types.

## Code style

- TypeScript strict mode on. No `any` unless unavoidable (comment why).
- Mobile-first Tailwind (design ~380px up). Amount inputs use `inputMode="decimal"`.
- Prefer Server Components for reads; Client Components only where interactivity is needed.
- Small, focused components. Keep business logic in `lib/` and route handlers, not in JSX.

## Build order

Auth → Categories (+ seed) → Expenses CRUD + fast add UI → Dashboard/monthly view →
Reports/aggregation → Major transactions → polish/PWA → deploy. See ROADMAP.md for detail.

## Env vars (`.env.local`, never commit)

```
MONGODB_URI=
JWT_SECRET=
```
