# Hygiena+ — Combined Final Audit (Security + Runtime)

_Date: 2026-07-05 · Scope: full-stack security audit **+** live web runtime audit ·
Status: **report-only** (one fix already applied — see §7). Target platforms: Web + Play + App Store._

> This single document consolidates everything found across all passes:
> - **Security** — `SECURITY-AUDIT.md`, `FINDINGS-REGISTER.md` (F1–F18), and the
>   independent re-verification `FINAL-AUDIT.md` (NEW-1…NEW-6), incl. live DB exploit tests.
> - **Runtime** — live drive of the running web app (`localhost:8081`): auth flow,
>   all 38 user-area routes, and the doctor area, capturing crashes, dead buttons,
>   dead links, and console errors (findings R1–R8).
>
> Verdict: **🔴 NO-GO for launch.** The data layer's *read* security is genuinely
> strong (RLS verified live), but there are **critical write/entitlement holes** and
> a **web-only crash** on three core screens. Everything below is fixable.

---

## 1. Verdict at a glance

| Dimension | State |
|---|---|
| Cross-user data isolation (IDOR / RLS reads) | ✅ Strong — verified live with 2 accounts |
| Secrets / key exposure | ✅ None (anon key is publishable; `.env` gitignored; clean git history) |
| Code quality / typecheck | ✅ Clean (`tsc` exit 0; no `eval`/`innerHTML`/`service_role` in client) |
| **Payments / premium entitlement** | 🔴 **Forgeable** — `is_premium` self-writable (proven live) |
| **Web app stability** | 🔴 **Crashes** on `/profile`, `/account`, `/settings` (route collisions) |
| **Web interactivity** | 🟠 **Dead** confirmations + silent validation (184 `Alert.alert` calls) |
| Auth hardening | 🔴 Email-confirm OFF, no rate-limit/CAPTCHA, pw min 6, signup enumeration |
| Legal / privacy / compliance | 🔴 Template-only, unreachable pre-signup, no consent/Guinea gate/export |
| Server-side authz coverage in repo | 🔴 Schema + role trigger + Edge Fns not in git |

---

## 2. Priority matrix (all findings, combined)

Legend: **P0** launch blocker · **P1** high (fix before or immediately after launch) ·
**P2** medium · **P3** low/cosmetic. Type: **SEC** security · **RT** runtime · **OPS** process.

### 🔴 P0 — Launch blockers
| ID | Type | Finding | Evidence |
|----|------|---------|----------|
| **P0-1** | SEC | **Premium/payment entitlement is client-writable.** A normal user PATCHes `profiles.is_premium=true` (1 request, HTTP 200 live) and can also forge `subscription_payments` and `marketplace_orders.is_paid`/`total_amount` (201). | `setup.sql:37` (policy has no `WITH CHECK`/column scope); `premium.tsx:73`; `appointments-service.ts:233`. Maps NEW-1 + F1/B3. |
| **P0-2** | RT | **Web crash: route-name collisions → infinite render loop.** `/profile`, `/account`, `/settings` throw "Maximum update depth exceeded" on refresh/deep-link. Cause: same route name in multiple groups `(user)/(doctor)/(admin)`; a `RoleGuard` in a colliding group the current role can't enter redirects → render ping-pong. | Reproduced 3× live; screenshot captured. `about/help/health` (unique names) are clean. Maps R1. |
| **P0-3** | SEC | **Legal/compliance gap.** Privacy & terms are unvalidated templates, live under `RoleGuard` (unreachable pre-signup), with no recorded consent, no Guinea-only gate, no data export. Apple/Google/Guinea law require these. | `(user)/_layout.tsx:16`, `terms.tsx`, `privacy.tsx`, `register.tsx:179`. Maps F2/B5. |
| **P0-4** | SEC | **Default credentials committed to the repository.** `seed-admin.sql` ships `admin@hygiena.plus` / `Test1234!` and `seed-doctor.sql` ships `dr.amina@hygiena.plus` / `Test1234!` — **both are live in prod** (I logged into both during this audit). Because they are committed to git, **any period the repo is/was public exposes them.** Remove them from the seed files, **rotate the passwords now**, and never commit real credentials. | `supabase/seed-admin.sql`, `supabase/seed-doctor.sql`. Maps F4/B4 + F15 (seed admin resolves to `role=user`). |
| **P0-5** | SEC | **Auth wide open:** email confirmation is **OFF** (signup returns a live session; can register with someone else's email), **no server rate-limit/CAPTCHA** on signup/login/OTP/SMS (client-only lockout, bypassed via direct API). | Live: signup returns `access_token`, `confirmation_sent_at:null`. Maps NEW-2 + F5. |
| **P0-6** | OPS | **Server-side security lives outside the repo.** Schema, RLS, `is_admin()`, the **role-block trigger** (proven prod-only), and 2 Edge Functions are not in git — a load-bearing control could be dropped by any migration unnoticed, and `consultation-room` (SSRF surface) can't be reviewed. | No `migrations/`/`functions/`. Maps F3/NEW-3/B2. |

### 🟠 P1 — High
| ID | Type | Finding | Evidence |
|----|------|---------|----------|
| **P1-1** | RT | **`Alert.alert` is a no-op on web — 184 calls across 49 files.** Every confirmation becomes a **dead button** (sign-out in doctor + admin areas, delete post/comment, block, report, cancel appointment/order, stop pregnancy tracking, share summary); every validation/error message is **silently swallowed**. | grep: 184 hits. e.g. `(doctor)/profile.tsx:308`, `AdminSidebar.tsx:17`, `AdminDrawer.tsx:66`, `community/[id].tsx`, `marketplace/order.tsx:87`. Maps R7. (User-profile sign-out already fixed — §7.) |
| **P1-2** | RT | **Colliding routes mis-resolve even without crashing.** Doctor deep-link `/appointments` lands on the user home; in-app tab nav to `/profile` left the home screen rendered under a `/profile` URL. Navigation to shared-name routes is unreliable on web. | Live. Maps R2. Same root cause as P0-2. |
| **P1-3** | SEC | **Signup email enumeration** — raw "User already registered" surfaced. (Forgot-password enumeration was **refuted** — `/recover` is generic.) | `register.tsx:68`. Maps F6. |
| **P1-4** | SEC | **Password minimum is 6**, no leaked-password check. | `validation.ts`, `register.tsx:145`. Maps F7. |
| **P1-5** | SEC | **No server-side validation** on order/doctor/availability writes (client writes `total_amount`, `phone`, `payment_*` unchecked). | `marketplace` create order; `doctor profile`. Maps F10. |
| **P1-6** | SEC | **Suspended/unvalidated doctor** can still act — `(doctor)/_layout` gates on role only, no `is_validated`/live-suspension check. | `app/(doctor)/_layout.tsx`. Maps F11. |
| **P1-7** | SEC | **Confirm `admin-user-actions` Edge Fn enforces `is_admin()`** server-side for non-self actions (client `RoleGuard` is not enough). Pull the function to verify. | Maps F12/API5. |
| **P1-8** | SEC | **Users can DELETE their own `subscription_payments`** (HTTP 204) — tamperable audit/receipt trail. | Live DELETE 204. Maps NEW-4. |
| **P1-9** | SEC | **Verify `appointments_update_patient` RLS** — repo omits it but the app calls cancel/reschedule; either it's prod-only (→ P0-6) or those actions silently fail. | `appointments-service.ts:260/266`. Maps F8. |

### 🟡 P2 — Medium
| ID | Type | Finding |
|----|------|---------|
| **P2-1** | SEC | Unbounded queries (no pagination) on notifications/community → memory/perf risk. `notifications-service.ts:6`. (F9) |
| **P2-2** | SEC | `profiles` UPDATE policy is column-unscoped generally (beyond `is_premium`). Prefer column-scoped grant / `WITH CHECK`. (NEW-5) |
| **P2-3** | SEC | Cycle prediction timezone off-by-one (UTC vs local midnight). Harmless in Guinea (GMT+0) but latent. `cycle-service.ts`. (NEW-6) |
| **P2-4** | SEC | Storage buckets missing `file_size_limit`/`allowed_mime_types`; no web security headers / CORS allow-list. (H3/H4) |
| **P2-5** | RT | Onboarding overlay stacks over the home screen after login (multi-step). (R4/F18) |
| **P2-6** | SEC | `select("*")` over-fetch on sensitive tables (data minimization). (F13) |

### ⚪ P3 — Low / cosmetic
| ID | Type | Finding |
|----|------|---------|
| **P3-1** | RT | Nested `<button>` in `ProductCard` → web hydration/a11y error. `marketplace/index.tsx` + `Card.tsx`. (F14) |
| **P3-2** | RT | Console deprecation spam on every screen: `shadow*` props, `props.pointerEvents`, `Animated useNativeDriver` (→ JS fallback = janky web animation), `expo-notifications` web listener no-op. (R6) |
| **P3-3** | RT | One aborted notifications request on home load (`net::ERR_ABORTED`) — likely benign unmount. (R5) |
| **P3-4** | OPS | `npm audit`: 21 vulns (20 moderate, 1 high), all transitive build tooling. Resolve before store builds. |
| **P3-5** | SEC | Feature gaps (NOT vulns): MFA/2FA absent, social login absent, biometric is app-relock only. Roadmap. |

---

## 3. What is verified SAFE (don't re-litigate)
- **RLS reads**: anon read of 11 sensitive tables → all empty. Cross-user IDOR (B→A cycle/profile R/U/D) → all blocked. Tested live with throwaway accounts.
- **Secrets**: no `service_role`/JWT/PEM in git history; anon key is publishable; `.env` gitignored; `eas.json` holds only the public key.
- **Injection (A03)**: all DB access via PostgREST/RPC (parameterized); no raw SQL, `eval`, or `dangerouslySetInnerHTML`.
- **Reset-password deep link**: validated server-side (`exchangeCodeForSession`) — **refuted** as a risk.
- **Forgot-password enumeration**: `/recover` is generic — **refuted**.
- **Navigation integrity**: every static `router.push`/`Link`/`Redirect` target resolves to a real route file — **no dead/broken links** (R8). The nav problems are the collisions (P0-2) and `Alert.alert` (P1-1), not missing routes.

---

## 4. Runtime coverage

| Area | How | Result |
|------|-----|--------|
| **(auth)** 7 screens | live deep-link | ✅ All render, no errors (only benign deprecation warnings). `/reset-password` correctly rejects a tokenless link. |
| **(user)** 38 routes | live deep-link sweep, logged in | ✅ 35 render clean · 🔴 `/profile`, `/account`, `/settings` crash (P0-2). |
| **(doctor)** area | logged in as `dr.amina@hygiena.plus` | ✅ `/availability`, `/messages`, `/chat`, doctor `/profile` render · 🔴 `/account` crashes · 🟠 `/appointments` mis-resolves to user home. Doctor sign-out is a dead button (P1-1). |
| **(admin)** area | — | ⛔ **Not runtime-tested** — the seed admin is `role=user` and there is no service-role/CLI/dashboard access here to promote one. Admin screens were **reviewed statically**: they share the route collisions (`/account`, `/settings`) and use heavy `Alert.alert` validation (P1-1). **To finish:** run `seed-admin.sql` OPTION B in Supabase → SQL Editor, then re-run the admin sweep. |

Test accounts used: existing seed accounts only (`admin@hygiena.plus`=user, `dr.amina@hygiena.plus`=doctor). No new data created; no rows forged in this runtime pass.

---

## 5. Root cause of the web crash (P0-2) — for the fixer

Expo Router **omits `(group)` segments from the URL**. These files therefore all
compete for the same path:

| URL | Files that claim it |
|-----|---------------------|
| `/account` | `(user)/account.tsx` + `(doctor)/account.tsx` + `(admin)/account.tsx` |
| `/profile` | `(user)/profile.tsx` + `(doctor)/profile.tsx` |
| `/settings` | `(user)/settings.tsx` + `(admin)/settings.tsx` |

When the current role **cannot** enter one of the colliding groups, that group's
`RoleGuard` issues a `<Redirect>` while another group tries to render the same
URL → React re-renders without settling → "Maximum update depth exceeded."
(Confirmed: a doctor does **not** crash on `/profile` because both `(user)` and
`(doctor)` accept the doctor role; a doctor **does** crash on `/account` because
`(admin)` rejects.)

**Recommended fix (either):**
- **A (preferred): make `(doctor)` and `(admin)` real path segments**, e.g.
  `app/doctor/…` and `app/admin/…`, so their URLs become `/doctor/profile`,
  `/admin/settings`, `/admin/account` — unique. Only `(user)` keeps the bare
  names. Update `router.push("/(doctor)/…")` / `"/(admin)/…"` call sites.
- **B: rename the colliding screens** so each URL is unique across the app.

Verify by refreshing `/profile`, `/account`, `/settings` for **each** role — all
must render, none may loop.

---

## 6. Fix for the web dead-buttons (P1-1) — for the fixer

`Alert.alert` (React Native) does nothing on `react-native-web`. The app already
has cross-platform equivalents that **do** work on web:
- **Confirmations** → `useConfirm()` (`src/components/ConfirmDialog.tsx`) — already
  used by admin screens & `DeleteAccountButton`.
- **Success/error/info toasts** → `useToast()` (`src/providers/ToastProvider.tsx`).
- **Simple system alerts** → add a tiny `Platform.OS === 'web' ? window.alert/confirm : Alert.alert`
  shim so nothing is silently dropped.

Migrate all 184 call sites (prioritize the destructive confirmations and the
form-validation messages). Both providers are already mounted at the root
(`app/_layout.tsx:139`).

---

## 7. Already fixed this session
- **User-profile sign-out worked on web.** `app/(user)/profile.tsx` — replaced the
  `Alert.alert` confirmation (dead on web) with the cross-platform `useConfirm()`
  dialog + `useToast()` for errors; removed the now-unused `Alert` import.
  `tsc --noEmit` clean. _This is one instance of P1-1; the doctor + admin sign-outs
  and the other ~183 `Alert.alert` sites remain._

---

## 8. OWASP snapshot (evidence-based)
- **Pass:** A03 Injection · A01 object-level (IDOR) · A02 crypto (HTTPS + bcrypt).
- **Fail:** A04 Insecure Design · A05 Misconfig (email-confirm off, default creds) ·
  A07 Auth (weak pw, no MFA, bypassable lockout, enumeration) · A08 Integrity
  (client-trusted payments, user-deletable payments) · **API3 BOPLA / mass-assignment**
  (the core of P0-1).
- **Weak:** A09 logging (best-effort `admin_logs`, no alerting, tamperable trail).
- **Cannot verify:** A10 SSRF — `consultation-room` Edge Fn not in repo (P0-6).
- **Root cause cluster:** the server trusts the client for **authorization,
  entitlement, payment, and validation**. Fix that boundary and A04/A05/A07/A08/API3
  close together.

---

## 9. Launch gate (must be green)
- [ ] **P0-1** `is_premium` + `is_paid` + amounts become server-owned (Edge Fn after verified Orange/MTN payment + webhook); re-run the 4 forge tests → all 4xx.
- [ ] **P0-2** Eliminate route-name collisions; refresh all 3 screens per role → no loop.
- [ ] **P0-3** Real privacy policy + terms, reachable pre-signup, consent recorded, Guinea gate, data export/delete.
- [ ] **P0-4** Remove default creds from `seed-admin.sql` **and** `seed-doctor.sql`; **rotate** the exposed `Test1234!` passwords; promote a real admin (OPTION B); confirm no `admin@hygiena.plus` / `dr.amina@hygiena.plus` with the default password remain in prod.
- [ ] **P0-5** Enable email confirmation; server rate-limit + CAPTCHA on signup/login/OTP/SMS; hard daily SMS cap.
- [ ] **P0-6** `supabase db pull` → `migrations/`; pull Edge Functions; commit role trigger + `is_admin()`.
- [ ] **P1-1** Migrate `Alert.alert` → `useConfirm`/`useToast`/web shim (destructive + validation first).
- [ ] **P1-3…P1-9** signup enumeration, pw ≥8 + leaked check, server validation, doctor gate, `admin-user-actions` `is_admin()`, payments append-only, verify appt-update RLS.
- [ ] **Ops:** `npm audit` → 0 high before store build; EAS + web build pass; full security scan (see handoff prompt).

_See `AUDIT/FIX-HANDOFF-PROMPT.md` for the ready-to-paste implementation brief._
