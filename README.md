# 💸 Outlay

A mobile-first, multi-user expense tracker — built to replace a manual spreadsheet and actually be *faster* than opening Excel. Log an expense from your phone in under 5 seconds, track budgets, see monthly/yearly trends, and get a nudge when you forget to log for the day.

Live on **Vercel** + **MongoDB Atlas**. Installable as a **PWA** with offline support.

---

## ✨ Features

- **Fast expense entry** — numeric keypad, recent-category shortcuts, "repeat previous expense," and smart merge detection so logging never feels like a chore.
- **Custom categories** — every user gets sensible defaults (Food, Travel, Investments, Extras) and can add, recolor, or archive their own.
- **Dashboard & monthly view** — current-month totals, per-category breakdown, and a day-by-day ledger.
- **Reports** — yearly month-by-month tables, category %, trend charts, highest-spend category, month-over-month deltas, fastest-growing category.
- **Budgets & alerts** — optional per-category and overall monthly budgets with progress bars and over-limit warnings.
- **Major transactions** — a separate Dr/Cr ledger for one-off events (FDs, large transfers) that stays visible in reports without polluting category charts.
- **Recurring expenses** — templated entries (rent, subscriptions, EMIs, SIPs) auto-created on a schedule.
- **Search, filter & CSV export** — filter by category/date/amount/note, export full history or a monthly statement.
- **Daily reminders** — opt-in push notification nudging you to log today's spending. No engagement-bait.
- **Offline-first PWA** — install to your home screen, view recent data offline, and queue expenses entered offline for sync when you're back online.
- **Account security** — email verification, OTP-based password reset, and an email-change flow, with emails sent over SMTP. Changing or resetting your password signs out your other devices.

## 🔒 Multi-user by design

Anyone can sign up. Every single query — reads and writes — is scoped to the authenticated user via a verified JWT. There is no code path where one user's data is reachable by another.

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript |
| Backend | Next.js Route Handlers (`app/api/**/route.ts`) — no separate server |
| Database | MongoDB Atlas + Mongoose |
| Auth | Email + password, bcrypt hashing, short-lived JWT + optional 30-day "remember me" refresh token, both in httpOnly cookies |
| Email | Nodemailer over SMTP — any provider (OTP verification, password reset, email change) |
| Validation | Zod — one schema shared client + server |
| Styling | Tailwind CSS, mobile-first |
| Data fetching | TanStack Query |
| Charts | Recharts |
| Offline | Custom service worker + `localStorage`-backed sync queue |
| Monitoring | Sentry (optional — no-ops when the DSN is unset) |
| Deployment | Vercel + MongoDB Atlas |

Summaries (totals, %, averages) are **never stored** — they're computed via MongoDB aggregation at query time, with expenses as the single source of truth.

---

## 🚀 Getting started

### Prerequisites

- Node.js 22+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier is fine)
- SMTP credentials from any email provider (for email verification / password reset)

### Setup

```bash
git clone <this-repo>
cd expense-tracker
npm install
```

Create a `.env.local` in the project root:

```bash
MONGODB_URI=            # MongoDB Atlas connection string
JWT_SECRET=             # long random string

# Email (OTP verification, password reset, email change) — any SMTP provider
SMTP_HOST=
SMTP_PORT=587           # STARTTLS
SMTP_USERNAME=          # also used as the "From" address
SMTP_PASSWORD=

CLOUDINARY_CLOUD_NAME=  # for profile picture uploads
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Daily reminder push notifications (optional)
VAPID_PUBLIC_KEY=       # generate with: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
VAPID_EMAIL=            # contact address for the push service
CRON_SECRET=            # bearer token the scheduler sends to /api/push/send

# Error monitoring (optional — SDK no-ops when unset)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

ADMIN_EMAILS=           # optional, comma-separated — self-promotes matching accounts to
                         # role: "admin" on next login/verify/refresh, unlocking /admin
```

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3005](http://localhost:3005) — sign up, and you're in.

### Other commands

```bash
npm run build     # production build
npm run start     # run the production build
npm run lint      # eslint
npm run test      # unit + integration tests (Vitest, in-memory MongoDB)
npm run test:e2e  # end-to-end tests (Playwright)
```

---

## 📁 Project structure

```
app/
  (auth)/login/  register/            # auth pages
  (app)/                              # protected pages: dashboard, month, reports, categories, transactions, recurring, settings, admin
  api/
    auth/{register,login,logout,me,refresh,...}/route.ts
    categories/route.ts       categories/[id]/route.ts
    expenses/route.ts         expenses/[id]/route.ts
    budgets/route.ts          budgets/[id]/route.ts
    recurring/route.ts        recurring/[id]/route.ts    recurring/generate/route.ts
    summary/{monthly,yearly}/route.ts
    transactions/route.ts     transactions/[id]/route.ts
lib/
  db.ts            # cached Mongoose connection (safe for serverless/hot reload)
  auth.ts          # hash/verify password, sign/verify JWT, getUserFromRequest
  validation.ts    # Zod schemas
models/            # Mongoose models: User, Category, Expense, Transaction, Budget, Recurring, RefreshToken, ...
components/        # UI components
proxy.ts           # route protection — redirects unauthenticated users to /login
```

## 🗃️ Data model

| Model | Key fields |
|---|---|
| **User** | `email` (unique), `passwordHash`, `name?`, `currency` (default `INR` — a display label only; amounts are never converted) |
| **Category** | `userId`, `name`, `color`, `sortOrder`, `isArchived` |
| **Expense** | `userId`, `date`, `categoryId`, `amount` (>0), `note?` — one document per expense |
| **Transaction** | `userId`, `date`, `amount`, `type: "Dr" \| "Cr"`, `description` |

Categories are **archived, not deleted**, once they have expenses attached — history is always preserved.

---

## 🛡️ Security

- Passwords hashed with bcrypt — never logged or stored in plaintext.
- JWT lives in an **httpOnly, Secure, SameSite** cookie — never in `localStorage`.
- Every database query is scoped by the `userId` from the verified token; nothing is trusted from the request body or query string.
- Every request body is validated with Zod on the server before it touches the database.
- Secrets live only in environment variables and are never committed.

---

## 🗺️ Roadmap

The MVP (auth → categories → expenses → dashboard → reports → transactions → PWA → deploy) shipped and has since grown through budgets, recurring expenses, offline support, and account security hardening. See [ROADMAP.md](./ROADMAP.md) for the full history and what's next.

---

## 🤝 Contributing

Found a bug or have an idea? Open an issue or a PR. Check [ROADMAP.md](./ROADMAP.md) for planned work before starting something large, so effort isn't duplicated.

---

## 📄 License

MIT — see [LICENSE](./LICENSE). Free to use, modify, and self-host.

## 🔐 Privacy & Terms

In-app policies live at `/privacy` and `/terms` once deployed. See [`app/privacy/page.tsx`](./app/privacy/page.tsx) and [`app/terms/page.tsx`](./app/terms/page.tsx).
