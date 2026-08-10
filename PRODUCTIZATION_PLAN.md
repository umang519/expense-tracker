# Productization Plan — Overview

Short, high-level starting point for the shift from "personal project" to "product we sell." Not a
detailed spec — just my read of where we stand and what's actually missing, so we can align before
going deep tomorrow. Written from the code as it exists on 2026-08-06 (Phase 18 just shipped:
tests, Sentry, rate limiting).

## What we already have (real assets, not rebuilding these)

- **Multi-tenant by construction.** Every query scoped by `userId` from a verified JWT (CLAUDE.md
  rule 1) — this is normally a retrofit project for teams turning a personal tool into a product.
  We don't have that problem.
- **Full feature set for the core use case:** expenses, categories, budgets, major transactions,
  recurring entries, monthly/yearly reports with CSV export, PWA + offline support, daily reminder
  notifications.
- **Account lifecycle:** email verification, password reset, email change, avatar upload, account
  deletion with full cascading cleanup — all already built.
- **Operational baseline (Phase 18, just done):** automated tests protecting the aggregation logic,
  Sentry wired for error visibility, basic rate limiting on auth endpoints.
- **Performance:** LCP/FCP work already done (Phase "lcp-improve") — dashboard loads server-rendered,
  not a client-fetch waterfall.

In short: the *product* is basically feature-complete. What's missing is everything around turning
a working app into something you can legally and operationally sell to strangers.

## What's actually missing

### 1. Legal & trust (blocks launch, not optional)
- Terms of Service, Privacy Policy. This app stores financial data — vague or missing policies are
  the single biggest risk to selling this to strangers, not a technical risk.
- A real support contact / way for a paying customer to reach you.
- Decide data residency / retention story (already delete-on-request; need it written down).

### 2. Billing (the actual unlock)
- No payment integration exists at all today (Stripe or Razorpay, given INR pricing).
- Needs: a pricing model (free tier? one paid tier? usage-based?), a `Subscription`/`Plan` concept
  tied to `User`, and gating logic (what a free vs. paid user can/can't do).
- This is the single largest net-new piece of engineering in this plan — everything else is
  hardening what exists.

### 3. Multi-tenant hardening beyond "correct"
- Current rate limiting covers auth routes only (Phase 18) — worth revisiting once there are
  paying customers with an incentive to abuse the app, not just curious signups.
- No admin/ops visibility today: no way to see signups, active users, or a stuck payment without
  querying Mongo directly. Even a minimal internal admin view becomes necessary once you can't
  just SSH into your own head to know what's happening.

### 4. Identity & presentation
- App is currently branded generically ("Expense Tracker"). Selling it means a name, and a
  marketing/landing page that isn't the login screen — a first-time visitor should be able to
  understand the product before being asked to sign up.
- No onboarding flow beyond register → verify → empty dashboard. Worth a plan for that empty-state
  first-run experience once there's a reason to care about activation.

### 5. Infra cost reality
- Free-tier Vercel + free-tier Atlas is fine for one user. Paying customers means real usage —
  worth knowing where the free-tier ceilings are (Atlas storage/connections, Vercel function
  invocations) before it becomes a surprise mid-launch.

## Suggested order (not final — for discussion)

1. **Legal + billing first.** Nothing else matters if you can't legally take money. This is also
   the slowest-moving piece (ToS/privacy policy, payment gateway KYC/approval), so start it early
   even while other work continues.
2. **Plan/subscription model + gating**, once billing is decided.
3. **Minimal admin visibility** — enough to see users and payment state without touching Mongo
   directly.
4. **Branding + landing page** — can happen in parallel with 1–3, doesn't block them.
5. **Onboarding polish** — last, once there's someone new to onboard.

## Where billing/gating would actually plug in (precise, doesn't depend on pricing decisions)

This part doesn't need answers to the open questions below — it's fixed by how the codebase is
already shaped, so worth locking in now:

- **`models/User.ts`** currently has no plan/subscription fields at all (`email`, `passwordHash`,
  `name`, `currency`, avatar fields, OTP fields — that's it). A `Subscription` concern belongs as
  either new fields here (`planId`, `subscriptionStatus`, `currentPeriodEnd`) or a separate
  `Subscription` model referencing `userId`, mirroring how `Budget`/`RefreshToken` already
  reference `User` — separate model is cleaner once billing has its own lifecycle (webhooks,
  renewals, cancellations) independent of profile data.
- **`proxy.ts`** is the existing single choke point for every protected page (`/dashboard`,
  `/month`, `/reports`, `/categories`, `/transactions`, `/settings` — see its `matcher`). It
  currently only checks "is there a valid session." A plan-gate (e.g. redirect to `/upgrade` if
  trial expired) would extend this same file rather than scattering checks per-page. It runs on
  the Edge runtime and can't touch Mongoose directly (same constraint that already shapes the
  refresh-token flow — it calls `/api/auth/refresh` internally instead) — a gating check would
  need the same pattern, or plan status baked into the JWT payload itself so no extra DB round trip
  is needed on every request.
- **API routes are NOT covered by `proxy.ts`** (its matcher is pages only) — each of the 31 route
  handlers under `app/api/**/route.ts` independently calls `getUserFromRequest`. Gating writes
  (e.g. "free tier: max N expenses/month") would mean touching the specific mutation routes
  (`expenses`, `transactions`, `recurring`), not a single shared layer — same shape as how rate
  limiting (Phase 18) had to be added per-route rather than centrally, for the same reason.
- **Webhook receiver** — a new, unauthenticated route (`app/api/billing/webhook/route.ts`) would be
  needed for the payment provider to notify us of renewals/failures/cancellations, following the
  same "public but safe" pattern already used by `app/api/push/notify-check/route.ts`.
- **`lib/rateLimit.ts`'s pattern (MongoDB-backed, atomic upsert, TTL cleanup)** generalizes directly
  to usage-based gating if that pricing model is chosen (e.g. "N expenses per day on free tier") —
  no new infra needed, same approach, different counter.

## Answers (2026-08-10)

- **Audience:** Indian, INR — no idea about other markets yet, and no plan to build geo/audience-based
  categorization to chase one. Keep the app as-is (single-currency-symbol, INR default) rather than
  building i18n/multi-currency speculatively.
- **Pricing:** staying **open source**. No paid tier — every feature currently in the app is fine to
  keep free. This retires the entire billing/gating track (section 2 below, and most of section 3)
  until/unless that decision changes.
- **Business entity:** individual. Not currently load-bearing since there's no billing, but noted for
  if that changes later.
- **Timeline:** no target launch date. This is explicitly the user's first successful working project;
  the goal is to keep improving it and make it easily accessible to everyone — not to hit a launch
  deadline.

This changes the shape of the plan: "sell" becomes "give away responsibly and make accessible." Legal
basics, infra cost ceilings, and polish still matter — a free public tool handling financial data still
needs a privacy policy and a cost story — but billing/subscription engineering is off the table for now.

## Revised suggested order

Turned into concrete, execute-ready phases in `ROADMAP.md` (continuing its existing `Phase N`
numbering — this doc stays the "why," `ROADMAP.md` is the one list of what/when):

1. **Legal & trust basics** (was section 1) → **[ROADMAP.md Phase 22](ROADMAP.md#build-phases)** —
   license, public repo, `/privacy` + `/terms`, support contact via GitHub Issues.
2. **Infra cost reality** (was section 5) → **ROADMAP.md Phase 23** — free-tier ceiling doc + extend
   rate limiting to write-heavy data routes.
3. **Branding + landing page** (was section 4) → **ROADMAP.md Phase 24** — real landing page at `/`,
   rename sweep once a product name is picked.
4. **Onboarding polish** (was section 4) → **ROADMAP.md Phase 25** — first-run empty-state polish.
5. **Minimal admin visibility** (was section 3) → **ROADMAP.md Phase 26** — `role` field, `/admin`
   view, signups/activity without querying Mongo directly.
6. **Billing/Plan model** (was section 2) → **ROADMAP.md Phase 27 — parked.** Revisit only if the
   open-source decision changes. The "where billing/gating would plug in" notes below are kept as-is
   for that future case.
