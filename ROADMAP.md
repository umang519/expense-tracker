# Outlay — Project Roadmap

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

### Phase 10 — PWA polish + Report enhancements ✅ COMPLETE
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

### Phase 11 — Budgets & alerts ✅ COMPLETE
- Optional monthly budget per category (and an overall monthly budget).
- Dashboard shows progress bars (spent vs budget) and a visual warning when near/over limit.
- Model: a `Budget` collection — `userId`, `categoryId?`, `month`/recurring, `amount`.
- Budget vs. actual comparison visible on the monthly view and reports.

### Phase 12 — Search, filter & export ✅ COMPLETE
- Filter expenses by category, date range, amount range, and note text.
- Export filtered results (and full history) to CSV — personal backup + data portability.
- Monthly statement download (CSV). PIN/password protection optional in a later iteration.
- Closes the loop: data can come in (Phase 9) and go back out.

### Phase 13 — Recurring expenses ✅ COMPLETE
- Recurring entries (rent, subscriptions, phone recharge, EMIs, SIPs) auto-created on a schedule.
- User sets a template: category, amount, frequency (monthly/weekly), start date.
- Reduces manual entry for predictable costs and makes reports more accurate.

### Phase 14 — Gentle daily reminders (PWA push notifications) ✅ COMPLETE
- Optional daily nudge: "Log today's expenses?"
- Opt-in only, gentle, and useful — not engagement-bait.
- Leverage the existing PWA service worker; users must grant notification permission explicitly.

### Phase 15 — Dashboard quick-entry UX improvements ✅ COMPLETE
The app's primary goal is recording an expense in under 5 seconds. Further improvements:
- Amount keypad (numeric pad optimised for mobile).
- One-tap "repeat previous expense" shortcut.
- "Save and add another" flow for logging multiple items at once.
- Recent categories shown first in the category picker.
- Smart merge detection: prompts to merge when same category + date already exists.

### Phase 16 — Account security, privacy & management ✅ COMPLETE

**Context:** Several existing accounts were created with unverified or placeholder emails
(e.g. `umang@gmail.com`). These must be correctable before verification is enforced —
otherwise existing users get locked out. Execute the four steps below in order.

#### Step 1 — SMTP via Resend (foundation for all email flows)
- Sign up at resend.com, get API key, add `RESEND_API_KEY` to `.env.local` + Vercel env vars.
- Install `resend` package (`npm i resend`).
- Create `lib/email.ts` — a thin wrapper: `sendEmail({ to, subject, html })` that calls the Resend SDK.
- No UI change yet; this just wires up the plumbing.

#### Step 2 — "Update email" in Settings (fix existing bad emails first)
- Add an "Update email" card in `/settings` (Settings page → below name/currency section).
- Flow: user types new email → server sends a 6-digit OTP to the new address → user enters OTP → email updated in DB.
- API routes needed:
  - `POST /api/auth/email-change/request` — generate OTP (store hashed in DB with 15-min TTL on User doc), send email.
  - `POST /api/auth/email-change/confirm` — verify OTP, update `user.email`, clear OTP fields.
- Add fields to User model: `pendingEmail`, `emailOtp` (hashed), `emailOtpExpiresAt`.
- **This step deliberately has no "must be verified" gate** — it exists so existing users can correct their email before Step 3 enforces verification.
- Once all real users have updated to real emails, this card can be hidden or removed from Settings.

#### Step 3 — Email verification on new signups
- On `POST /api/auth/register`: create account in DB with `isEmailVerified: false`, then send a 6-digit OTP to the registered email.
- Add `isEmailVerified` (boolean, default `false`) and `verifyOtp` / `verifyOtpExpiresAt` fields to User model.
- New page `/verify-email`: user enters the 6-digit code. On success, set `isEmailVerified: true`.
- Middleware: if `isEmailVerified === false`, redirect to `/verify-email` (allow logout and resend-OTP; block everything else).
- Add "Resend code" button with 60-second cooldown on the verify page.
- API routes:
  - `POST /api/auth/verify-email` — check OTP, mark verified.
  - `POST /api/auth/resend-verification` — rate-limited resend.

#### Step 4 — Password reset via email
- Add "Forgot password?" link on `/login` page.
- New page `/forgot-password`: user enters email → receives OTP → enters OTP + new password.
- API routes:
  - `POST /api/auth/forgot-password` — find user by email, generate OTP, send email. Return 200 even if email not found (prevents user enumeration).
  - `POST /api/auth/reset-password` — verify OTP, bcrypt-hash new password, save, clear OTP fields.
- Add `resetOtp` (hashed) + `resetOtpExpiresAt` to User model.
- OTP expires in 15 minutes; single-use (clear on success).

#### Execution order summary
1. Resend SMTP → 2. Update-email in Settings → 3. Verify on signup → 4. Forgot-password
Steps 1–2 can ship together. Steps 3–4 depend on Step 1 but are independent of each other.

### Phase 17 — Offline-first / PWA hardening ✅ COMPLETE
- Confirm installability end-to-end; complete icon set + manifest.
- Service worker for offline viewing of recent data.
- Queue expenses entered offline and sync when back online.

### Phase 18 — Quality & operations ✅ COMPLETE
- **Unit tests (Vitest):** `lib/auth.ts`, `lib/format.ts`, `lib/validation.ts`, and `lib/push.ts`'s
  pure functions each have a co-located `*.test.ts`. `lib/data/summary.ts`'s aggregation pipelines
  (`fetchMonthlySummary`/`fetchYearlySummary`, now exported) are covered by
  `tests/integration/summary.test.ts` against a real `mongodb-memory-server` instance rather than
  mocked Mongoose, since aggregation correctness is the invariant CLAUDE.md rule 5 depends on.
  `tests/setup.ts` stubs env vars read at module-load time. `npm run test` / `npm run test:watch`.
- **E2E flows (Playwright):** `tests/e2e/login-add-expense.spec.ts` (login → add expense →
  dashboard total updates) and `tests/e2e/expense-crud.spec.ts` (add → edit → delete), run against
  a dedicated test database via `.env.test.local` (see `.env.test.local.example`) — never against
  the real Atlas DB. `global-setup.ts` seeds a pre-verified fixed test user directly via Mongoose
  (registration needs real email OTP, which can't be automated). Fixed a real accessibility gap
  found along the way: the login page's Email/Password `<label>`s had no `id`/`htmlFor` pairing.
  `npm run test:e2e`.
- **Error monitoring (Sentry):** `instrumentation.ts` + `instrumentation-client.ts` +
  `sentry.server.config.ts` + `sentry.edge.config.ts` (covers `proxy.ts`) + `app/global-error.tsx`.
  `onRequestError` auto-captures uncaught Route Handler/Server Component exceptions — no per-route
  try/catch needed. `next.config.ts` wrapped with `withSentryConfig`. `SENTRY_DSN` /
  `NEXT_PUBLIC_SENTRY_DSN` are unset locally by design (SDK no-ops safely); production build
  verified clean with no `SENTRY_AUTH_TOKEN` set (source-map upload just skips with a warning).
- **API rate limiting:** MongoDB-backed (no new Redis/Upstash dependency — `models/RateLimitHit.ts`
  uses the same TTL-index pattern as `RefreshToken`), fixed-window counter via one atomic
  `findOneAndUpdate` upsert in `lib/rateLimit.ts`. Applied by IP to the abuse-prone auth routes:
  register (5/hr), login (10/15min), forgot-password (5/hr), reset-password (10/15min),
  resend-verification (5/hr), email-change/request (5/hr).

### Phase 19 — Settings & account management polish
Triaged from `docs/SETTINGS.SUGGESTIONS.MD`. Now that other users besides the owner are on the
app, account-level controls (delete, security) matter more than before. Priority order:

**a) Currency clarity ✅ COMPLETE**
- `currency` was always a display label, never a conversion (see CLAUDE.md). Added an explicit
  caption under the currency select in `SettingsForm.tsx` so this isn't a silent surprise.
- Deliberately **not** implementing real FX conversion — single benefit (all users currently
  Indian) doesn't justify the cost (historical-rate lookups, drifting past-month totals since
  summaries are aggregated live, not stored). Revisit only if non-INR users actually show up.

**b) Delete Account ✅ COMPLETE** — highest priority
- New "Delete account" action under the existing Account section in `/settings`, below Sign out.
- Confirm modal: lists what gets deleted (Expenses, Categories, Transactions, Recurring
  templates, Budgets), requires typing `DELETE` to proceed.
- `DELETE /api/auth/me`: cascading delete of every collection scoped to `userId` (Expense,
  Category, Transaction, Budget, Recurring, User), then clear the JWT cookie and redirect to
  `/login`. Must follow rule 1 — everything scoped by the verified JWT's `userId`, nothing from
  the request body.

**c) Theme (Light / Dark / System) ✅ COMPLETE**
- Tailwind v4 class-based `dark:` variant enabled (`@custom-variant dark` in `globals.css`),
  driven by a `.dark` class on `<html>` rather than the default media-query strategy, so a
  manual override can coexist with "System".
- `lib/theme.ts`: reads/writes the preference (`system` | `light` | `dark`) to `localStorage`
  (device-local, not synced — sufficient for a personal app). A blocking inline script in
  `app/layout.tsx` applies the class before first paint to avoid a light-mode flash.
- `components/ThemeToggle.tsx`: three-way control in Settings → Preferences, below Currency.
  Uses `useSyncExternalStore` (not local state + effect) so it stays consistent with the
  localStorage value across tabs without triggering React's setState-in-effect lint rule.
  Live-updates when in "System" mode and the OS preference changes while the app is open.
- `dark:` variants applied across all pages/components (mechanical light→dark color-token
  mapping, e.g. `bg-white` → `+ dark:bg-gray-900`, `text-gray-900` → `+ dark:text-gray-100`).
  Verified via `tsc`, `eslint`, and server-rendered HTML inspection; **not** pixel-checked in an
  actual browser since no browser automation tool is available in this environment — worth a
  quick manual look before/after deploying.

**d) About section ⏳ ON HOLD**
- Static card in Settings → About: app name + version (read from `package.json`), plus a short
  privacy note ("Your data is private to your account — no one else can see or access it.").
- No GitHub repo link for now — the app is intended to be free/open source eventually, but the
  repo (`github.com/umang519/expense-tracker`) is still **private** while it's actively being
  built out past MVP. Revisit adding a "View source on GitHub" link once the repo is actually
  made public.

**e) Export/Import discoverability ✅ COMPLETE**
- CSV export stays in `/reports` (`YearlyReport.tsx`, per-year and per-month download links) —
  **not duplicated** elsewhere. Added a "Reports & Export" quick link in Settings → Quick Links
  (same pattern/section as the existing "Recurring Expenses" link in `SettingsForm.tsx`) so users
  who land in Settings can find the CSV export without hunting for the Reports tab.
- Import/restore is a real feature (validation, duplicate/conflict handling) but bigger than it
  looks — deferred, revisit only if requested.

**Explicitly deferred** (tracked in `docs/IDEAS.md`, not planned yet): active sessions / sign-out-
everywhere (needs server-side session tracking, not just a single JWT cookie — now planned as a
side effect of Phase 21), offline cache size display + clear button, language/i18n,
reminder-time customization beyond the current on/off toggle, auto-enable-save-button UX polish.

### Phase 20 — Profile picture upload (Cloudinary) ✅ COMPLETED 
- Optional avatar shown in `/settings` and anywhere the initials-circle currently appears.
- Upload flow: browser uploads directly to Cloudinary using a short-lived signed payload issued
  by a new `POST /api/auth/avatar-signature` route (server never proxies the image bytes —
  avoids Vercel serverless body-size/timeout limits). Client then `PATCH /api/auth/me` with the
  returned `avatarUrl` + `avatarPublicId` to persist, same pattern as the existing name/currency
  save.
- `User` model gains `avatarUrl?`, `avatarPublicId?`. Replacing or removing a picture deletes the
  previous Cloudinary asset server-side (signed admin API call); account deletion
  (`DELETE /api/auth/me`) does the same cleanup as part of its cascade.
- New env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- added image reference to see the profile change for mobile 

### Phase 21 — "Remember me" / refresh tokens (fixes silent daily-reminder drop-off) ✅ COMPLETE

**Reported symptom:** users get the daily "log your expense" push for a day or two, then it just
stops. Investigating why led to two compounding bugs, not one — a longer session alone fixes the
first but not the second, so both need doing together.

**Root cause 1 — no refresh mechanism.** `signJWT` (`lib/auth.ts`) and the login/verify-email
routes already issue a **7-day** JWT cookie, but there's no way to extend it short of logging in
again. Once it expires — or once iOS evicts a home-screen PWA's storage after ~7 days of no visits
in Safari, a known WebKit behavior — the user is hard-logged-out with no warning.

**Root cause 2 — the cron fallback depends on the exact thing it exists to cover for.** The reminder
is scheduled via Vercel Hobby-plan cron (`vercel.json`), which only runs in a "flexible 1-hour
window" and isn't guaranteed to fire daily. The fallback, `POST /api/push/notify-check`, is meant to
catch a missed cron run whenever any user opens the app after 7:30pm IST — but it requires
`getUserFromRequest` to succeed, and `sendDailyReminderIfDue()` (`lib/push.ts`) is a **broadcast to
every subscribed user** gated once-per-day, not per-user. So once nobody has a valid session late in
the day, the fallback can't fire for *anyone*, and if the cron window also happens to miss, the
entire subscriber batch gets skipped that day — which reads exactly like "notifications just
stopped."

**a) Refresh-token based session (the "remember me" part) ✅ COMPLETE**
- `/login` (`app/(auth)/login/page.tsx`) has a **"Remember me for 30 days"** checkbox, checked by
  default, with a caption explaining why ("keeps you signed in... so daily reminders don't stop").
  Shown deliberately rather than silently always-on, so users understand *why* they're staying
  logged in on a device — this is user-facing consent/awareness, not just a technical toggle.
  - Checked → issue both the access JWT and the 30-day refresh cookie (sliding expiry, see below).
  - Unchecked → issue only the access JWT (1-day session, no refresh cookie at all), for anyone who
    wants a shorter-lived session on a shared device.
- `RefreshToken` model (`models/RefreshToken.ts`): `userId` (indexed), `tokenHash` (sha256 of a
  random opaque token — raw value only ever lives in the cookie, never stored plain), `expiresAt`
  (TTL index, 30 days), `createdAt`.
- The JWT is now a short-lived **access token** (`ACCESS_TOKEN_TTL_SECONDS` = 1 day, `lib/auth.ts`).
  A separate refresh cookie (`REFRESH_COOKIE_NAME`, httpOnly/Secure/SameSite, `maxAge` 30 days) is
  set alongside it only when "remember me" was checked (also issued unconditionally by
  `verify-email`, since completing signup is already "this device").
- `POST /api/auth/refresh`: validates the refresh cookie against the stored hash and, if valid,
  issues a new access JWT **and rotates the refresh token** (new random value + new hash, old row
  deleted) — sliding 30-day expiry, and rotation limits the blast radius if a token is ever stolen.
- `proxy.ts` (edge middleware) can't do Mongoose/DB lookups directly, so on an expired/missing
  access JWT with a refresh cookie present, it calls `/api/auth/refresh` via an internal `fetch`
  (forwarding the request's cookies) and, on success, forwards the response's `Set-Cookie` headers
  onto the continued request instead of redirecting. Net effect: anyone who checked "remember me"
  and opens the app at least once every 30 days stays logged in indefinitely; a genuinely abandoned
  session expires cleanly via the TTL index.
- Logout (`app/api/auth/logout/route.ts`) and delete-account (`DELETE /api/auth/me`) revoke the
  specific `RefreshToken` row(s), not just clear cookies — it's a database-backed credential now,
  not just a signed, stateless JWT.

**b) Decouple the notification fallback from any one user's session ✅ COMPLETE**
- `POST /api/push/notify-check` no longer calls `getUserFromRequest` — it's unauthenticated. Safe to
  leave open: it doesn't read/write user-specific data, and `sendDailyReminderIfDue()` is idempotent
  per IST calendar day (via `NotificationRun`), so it can't be abused to spam anyone.
- `<NotificationFallbackTrigger />` moved from `app/(app)/layout.tsx` (only reachable once already
  logged in) to the root `app/layout.tsx`, so it fires on **any** page view — `/login`, `/register`,
  anything — not just inside the authenticated app shell. Now the fallback fires precisely in the
  scenario it needs to cover: everyone logged out, someone lands on `/login` to sign back in, and
  that alone is enough to trigger the day's reminder broadcast.

**Rollout order:** (b) shipped first (small, isolated, fixed the acute symptom fastest), then (a) in
full: `RefreshToken` model → `/api/auth/refresh` → "remember me" checkbox on `/login` wired to issue
the refresh cookie → verify-email issuing it too → logout/delete-account revocation →
`proxy.ts` silent-refresh. Both halves are now shipped.

### Phase 22 — Open-source readiness (license, public repo, legal basics) ✅ COMPLETE

**Context:** the app is moving from "personal project" to "free, open-source, publicly accessible
tool" (decided 2026-08-10 — see `PRODUCTIZATION_PLAN.md`). The GitHub repo is still private and there
is no `LICENSE`, `/privacy`, `/terms`, or support contact anywhere in the app — none of that is
optional once strangers are signing up and storing financial data, even for free.

- Add a root `LICENSE` file — MIT is the default recommendation for a solo OSS project; confirm with
  the user before implementing this phase in case they want a different license.
- Flip the GitHub repo from private to public. Hard-to-reverse and visible externally — confirm
  explicitly with the user when this phase starts, don't do it silently mid-implementation.
- New public pages `app/privacy/page.tsx` and `app/terms/page.tsx` (outside `proxy.ts`'s matcher, so
  reachable without auth) — plain-language Privacy Policy (what's collected: email,
  expenses/categories/transactions, optional avatar; why; retention; that account deletion already
  cascades — reuse the Phase 19b delete-account story) and a short OSS-style Terms (provided as-is,
  no warranty).
- Support contact: once the repo is public, GitHub Issues doubles as the support channel — link it
  from `/privacy`, `/terms`, and the About section below. No new infra needed.
- Un-blocks **Phase 19d** (currently ON HOLD above): finish the About section in
  `components/SettingsForm.tsx` — app name + version + privacy note + "View source on GitHub" link,
  now that the repo is public.

### Phase 23 — Infra cost & abuse-ceiling review ✅ COMPLETE

**Context:** with no paywall, there's no natural brake on signups or usage — worth knowing the
free-tier ceilings before "accessible to everyone" turns into a surprise bill or a full database.

- New `docs/INFRA_LIMITS.md`: document Vercel Hobby-plan ceilings (bandwidth, function invocations,
  the once-daily cron limit already surfaced in Phase 21) and Atlas M0 free-tier ceilings (512MB
  storage, 500 connections), plus where to watch usage (Vercel dashboard, Atlas alerts).
- Extend `lib/rateLimit.ts` (Phase 18's MongoDB-backed atomic-upsert pattern, currently auth routes
  only) to the write-heavy data routes (`expenses`, `transactions`, `recurring`, `categories` POST) —
  same pattern, new scopes, no new infra — as a cheap backstop against runaway storage growth from
  abuse or bots.

### Phase 24 — Branding + landing page ✅ COMPLETE

**Name: Outlay.** Picked from the app's core value prop (fast mobile expense entry, budgets, reports)
while avoiding overlap with existing personal-finance apps (Spendee, Splitwise, Mint, YNAB, Walnut,
ET Money, etc.) — plain English word for "money spent," short, no name-based brand confusion with a
competitor.

- `app/page.tsx` now renders a real landing page for logged-out visitors (value prop, feature
  highlights, CTAs to `/login` and `/register`, links to `/privacy`/`/terms`/GitHub) instead of an
  immediate redirect to `/login`; logged-in visitors still redirect straight to `/dashboard`.
- `app/layout.tsx`: `title`/`description` updated for the new name, `openGraph`/`twitter` metadata
  added (previously missing entirely), `appleWebApp.title` updated.
- Mechanical rename sweep: `app/manifest.ts`, `package.json` (+ lockfile), email templates
  (`lib/email.ts` and the register/forgot-password/resend-verification/email-change auth routes),
  push notification payload (`lib/push.ts`), `public/sw.js`, `public/offline.html`,
  `components/SettingsForm.tsx`, `components/LegalPageLayout.tsx`, `/privacy` + `/terms`, README.
- The GitHub repo slug (`github.com/umang519/expense-tracker`) was deliberately left unchanged —
  renaming it would break the already-shared PR #24 link and is a separate, bigger decision than
  in-app branding; revisit only if explicitly wanted later.

### Phase 25 — Onboarding polish ✅ COMPLETE

- `app/(app)/dashboard/page.tsx` now runs a lightweight `Expense.exists({ userId })` check alongside
  the existing parallel queries to derive `isNewUser` (zero expenses ever — not just this month) and
  passes it down.
- `components/MonthSummary.tsx`: the `total === 0` empty state now branches — new users get a "Log
  your first expense" prompt with a CTA that opens `AddExpenseSheet` directly (self-contained, same
  pattern as `AddExpenseButton`); returning users with just an empty month keep the original plain
  "Nothing spent this month yet" message, so existing users don't get a misleading "first expense"
  message on a quiet month.
- New `components/GettingStartedChecklist.tsx`: dismissible card (links to set a budget, turn on daily
  reminders), shown only when `isNewUser` — existing users never see it, so there's no need to
  backfill a "dismissed" flag for anyone already using the app. Dismiss state persists via
  `localStorage`, read through `useSyncExternalStore` (same hydration-safe pattern as `ThemeToggle`)
  rather than `useEffect` + `setState`, which the project's lint config forbids.

### Phase 26 — Minimal admin visibility ⏳ NOT STARTED

- `models/User.ts`: add `role: "user" | "admin"` (default `"user"`).
- Bootstrap the first admin via an `ADMIN_EMAILS` env var allowlist checked at login/JWT-issue time
  (`lib/auth.ts`) — avoids a manual DB write per deploy; document in README's env var list.
- `proxy.ts`: extend `matcher` to cover `/admin/:path*`; gate on `role` baked into the JWT payload —
  the Edge runtime can't hit Mongoose directly, so the claim has to travel in the token, same reasoning
  as the existing refresh-token flow.
- New `app/(app)/admin/page.tsx` + `app/api/admin/stats/route.ts` (role-checked server-side too, not
  just at the proxy) — signups over time, active-user count, reusing the aggregation style already in
  `lib/data/summary.ts`.

### Phase 27 — Billing / Plan model — parked

No new work. Kept only as a pointer to `PRODUCTIZATION_PLAN.md`'s "where billing/gating would plug in"
notes — revisit only if the open-source decision changes.

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
