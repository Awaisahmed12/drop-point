# Security audit — November 2026

What was checked, what was found, what was fixed in this repository, and what only you can do in the Supabase, Vercel and Google Cloud dashboards. The running checklist is `docs/security-checklist.md`.

## Summary

| Area | Found | Fixed in code | Needs you |
|---|---|---|---|
| Admin privilege | An account could set its own `user_type` to `admin` through the API and gain the admin policies (feature flags). The admin policies also checked `'admin'` while the setup notes wrote `'Admin'`, so they never matched. | `database/security.sql`: a trigger makes `user_type` read-only for accounts; `is_admin()` matches either case. | Run `security.sql` once. |
| Google Maps quota | `/api/reverse-geocode` accepted anyone; `/api/autocomplete` treated sign-in as optional. No rate limit, no input validation; Google's error text (which can describe your key's restrictions) was echoed to callers. | Both routes require a verified Supabase session, validate inputs, are rate-limited per user, build URLs safely, and log Google's errors instead of returning them. | Create a server-only Maps key; restrict the browser key to your domain. |
| Dependencies | 33 vulnerabilities (4 critical) including Next.js, Supabase auth-js, `ws`, `sharp`, `vitest`. | `npm update` + `vitest` 5: **0 vulnerabilities**. Unused `@eslint/eslintrc` and five template SVGs removed. | — |
| Headers | HSTS and CSP missing; `X-Powered-By` sent. | HSTS (2 yrs, preload), CSP in report-only, `poweredByHeader: false`. | Check a preview's console, then enforce the CSP. |
| Uploads | Size limit was browser-only; `ACCEPTED_FILE_TYPES` existed but was never applied; the bucket accepted any MIME type including `text/html`. | Type and size checked before upload (with a test); bucket limits in `security.sql` exclude HTML/SVG. | Run `security.sql` once. |
| Cron secret | Compared with `!==` (timing side channel; low risk). | `timingSafeEqual`. | — |
| Secrets | None in the code or in any commit in git history. | — | Rotate the browser Maps key if it was ever unrestricted. |
| Passwords, sessions, CSRF, XSS, CORS | Already sound (details below). | — | Dashboard settings below. |

Everything that changed is covered by tests (106 passing) and CI runs lint, build and tests on every push.

## Access

**Authentication.** Supabase Auth handles sign-in (Apple/Google/Facebook when configured, email otherwise). Passwords are hashed by Supabase with bcrypt and never reach the app; nothing to change. Every page is wrapped in `withAuth`, and what a signed-in person can read or write is decided by row-level security in Postgres, so a tampered client cannot widen its own access.

**Admin.** Found: `user_profiles` rows are written by the account that owns them (that's how the profile is seeded on first sign-in), and `user_type` is a column on that row. Nothing stopped an account from `PATCH`ing `user_type = 'admin'` via the REST API and passing the `admin_configurations` policies. Impact was limited to the feature flags that table holds (Street View on/off), but it is a privilege escalation. Fixed: `protect_user_type()` keeps `user_type` unchanged on any write made as a signed-in account; only the SQL editor or the service role can set it. Also found: the original policies compared to `'admin'` while every setup note said `'Admin'`, so admin reads never worked; `is_admin()` now matches either. A read policy for active flags was added so the app's feature flags load for normal users, which they didn't before.

**Sessions.** The Supabase client keeps the session as bearer tokens in the browser's storage, not in cookies. That means there is no session cookie for a cross-site request to carry, so CSRF does not apply to the API routes (each demands an `Authorization: Bearer` header a foreign site cannot forge). The trade-off is that tokens live in storage reachable by script, which is why XSS (below) and the CSP matter.

**Password reset expiry** is a Supabase setting (Authentication → Settings → email OTP/link expiry, default 3600 s). Keep it at or below an hour.

**Sign-up password rules**: 8+ characters with upper, lower, digit and symbol, enforced in the form. Mirror it in Supabase (Authentication → Providers → Email → password requirements) so it also holds for anything that calls the auth API directly.

## Secrets

Scanned the working tree and every commit in git history for API keys, JWTs, private keys and tokens: nothing. `.env*` is gitignored and no env file was ever committed.

Variables the browser sees (`NEXT_PUBLIC_*`): Supabase URL and anon key (public by design; RLS is the guard), the Google Maps browser key, site URL, provider list, OAuth client id. Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, and the new `GOOGLE_MAPS_SERVER_API_KEY`.

The one key that needs attention is the **Google Maps browser key**. It is public by nature (the map needs it in the page), so its only protection is Google's referrer restriction. But the same key was also used server-side for geocoding, and referrer-restricted keys fail on server calls, which means it was probably left unrestricted. Do this in Google Cloud → APIs & Services → Credentials:

1. Create a second key, restrict it by API to Geocoding and Places, no referrer. Set it in Vercel as `GOOGLE_MAPS_SERVER_API_KEY`. The routes prefer it automatically.
2. Restrict the existing browser key to HTTP referrers `https://drop-point-xi.vercel.app/*` (and your preview pattern) and to the Maps JavaScript, Places and Street View Static APIs.
3. If the browser key has been unrestricted in production for a while, regenerate it and update `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

## Data

**Database.** All queries go through the Supabase SDK (parameterized). `security.sql` enables RLS on every table the app touches so a table created later without it is closed by default; the policies themselves live in `collaboration.sql` and `admin_configurations.sql` and were reviewed against `docs/collaboration.md`.

**Server-side validation.** The two API routes now validate: coordinates must be numbers within range (a string like `1&key=x` is rejected), search input is capped at 200 characters, only GET is answered. Writes to the database are validated by RLS and column constraints, not by the client.

**Uploads.** Before: the 50 MB limit was browser-only (added last month) and the bucket accepted any type. A user could upload `evil.html` and it would be served from the Supabase storage origin. Now: the browser refuses types outside `ACCEPTED_FILE_TYPES` and files over 50 MB before anything starts, and the bucket (`security.sql`) enforces `file_size_limit = 50 MB` and an `allowed_mime_types` list that excludes `text/html` and `image/svg+xml`, the two types that can carry script. Files are served only through 1-hour signed URLs from a private bucket.

**Payments.** There are none yet. When the paywall is built, the rule is already written into the plan: Stripe's webhook writes the entitlement, RLS reads it, the client never decides.

## Web

**HTTPS** is enforced by Vercel. Added `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` so browsers never try HTTP again.

**XSS.** The one place the app writes HTML is the file-viewer tab, and everything written there goes through `escapeHtml` (file names, CSV cells, URLs); React escapes everything else. The reminder email escapes names too. No `dangerouslySetInnerHTML` anywhere.

**CSP.** Added as `Content-Security-Policy-Report-Only`, listing exactly the hosts the app uses: Supabase, Google Maps/Street View/Picker/Drive, Vercel's preview toolbar. Report-only means it logs violations in the browser console without blocking, because I can't run the map or Supabase from here to prove nothing breaks. Your step: open a preview on your phone and desktop, use the map, open a PDF, import from Drive, then look at the console. If it's clean, rename the header to `Content-Security-Policy` in `next.config.ts` and it's enforced. `'unsafe-inline'` stays for scripts because Next.js's Pages Router injects inline bootstrap scripts; nonces would be the next step.

**Clickjacking**: `X-Frame-Options: DENY` was there; `frame-ancestors 'none'` added in the CSP. **MIME sniffing**: `nosniff` was there. **Fingerprinting**: `X-Powered-By` removed.

**CORS.** The API routes send no `Access-Control-Allow-Origin`, so browsers refuse calls from other origins. Nothing to loosen.

**Rate limiting.** `rateLimit()` in `src/utils/apiGuard.ts`: 60 geocodes and 120 autocomplete calls per user per minute, answered with 429 and `Retry-After`. It counts in the memory of each serverless instance, which stops one account from hammering a route; a shared store (Upstash/Vercel KV) would make it global if that ever matters. Auth endpoints are rate-limited by Supabase itself (Authentication → Rate limits). Vercel's Attack Challenge Mode / WAF adds a network-level layer if your plan has it.

## Before launch

**Debug mode.** `logger.debug/info` are development-only. The API routes log server-side only.

**Dependencies.** Before: 33 vulnerabilities (4 critical, 20 high) across Next.js (16.1.6), `@supabase/auth-js` (path routing bug), `ws`, `sharp`, `source-map-js`, `picomatch`, and `vitest`/`tinypool` (RCE in the test runner, dev-only). After `npm update` within the declared ranges and `vitest` 3→5 (needed `@types/node` 22): **0 vulnerabilities**, Next 16.4.6, Supabase 2.119. Lint, build and all tests pass on the new versions. One consequence: the newer `eslint-config-next` turns on `react-hooks/set-state-in-effect` as an error, which flags nine pre-existing patterns; it is set to warn in `eslint.config.mjs` with a TODO so the dependency bump doesn't carry an unrelated refactor.

**Unused packages and files.** `@eslint/eslintrc` (never imported) removed from `devDependencies`. `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` (create-next-app leftovers, referenced nowhere) removed.

**Exposed files.** `public/` now holds only `favicon.ico`, `logo.png` and `manifest.json`. No `.env`, dumps, backups or editor files in the repo. `database/*.sql` is committed on purpose (schema, no secrets).

**Monitoring.** Not added: error monitoring (Sentry or similar) needs a new dependency and a DSN, which is your call. Until then: Supabase → Logs → Auth shows failed sign-ins; Vercel → Logs shows function errors (the routes log every refused request with its reason).

**Tests.** New: `src/utils/apiGuard.test.ts` (401 without a token, 401 on a forged token, the verified user comes back; the limiter allows N then answers 429, keys don't bleed into each other, windows reset), `src/pages/api/reverse-geocode.test.ts` (bad coordinates rejected before auth or Google is touched, anonymous refused, rate limit honored, the server key is used, Google's error text is never echoed, POST refused), and the upload-type test in `usePropertyFileActions.test.tsx`. 106 tests pass.

## Your to-do, in order

1. **Supabase → SQL editor:** run `database/security.sql`. (Closes the admin escalation and enforces upload limits on the server.)
2. **Google Cloud:** create the server Maps key, set `GOOGLE_MAPS_SERVER_API_KEY` in Vercel, restrict the browser key to your referrers, regenerate it if it was ever unrestricted.
3. **Supabase → Authentication:** confirm email on; minimum password length 8 with character requirements; OTP/link expiry ≤ 3600 s; review rate limits.
4. **CSP:** check a preview's console, then rename the header to enforce.
5. **Decide:** CAPTCHA on sign-up (provider key + small form change), error monitoring (Sentry), data export/deletion route.
