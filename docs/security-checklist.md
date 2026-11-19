## Security and Compliance Checklist

This checklist is the canonical reference for pre-launch and ongoing security work. **Done** means it is in the code or SQL in this repository; **Dashboard** means it is a setting in Supabase, Vercel or Google Cloud that someone with access must make; **Decide** needs a product decision first. The November 2026 audit that produced this state is in `docs/security-audit.md`.

### Access

- Done — Authentication is Supabase Auth (social providers and email). Passwords are hashed by Supabase (bcrypt); the app never sees or stores one.
- Done — Every page is wrapped in `withAuth`; data access is decided by row-level security, not by the client.
- Done — Admin: `user_type` cannot be changed through the API (trigger in `database/security.sql`); the `admin_configurations` policies use `is_admin()`. The `/admin` page is a convenience over those policies, not the guard.
- Done — Sign-up requires 8+ characters with upper, lower, digit and symbol (`UserAuthForm`).
- Done — Sessions are bearer tokens held by the Supabase client in browser storage, not cookies, so there is no cookie to steal via CSRF and no CSRF surface on the API routes (each requires `Authorization: Bearer`).
- Dashboard — Supabase → Authentication → Providers → Email: enable **Confirm email**; set **Minimum password length** to 8 and require letters, digits and symbols so the rule holds for the API as well as the form.
- Dashboard — Supabase → Authentication → Settings: keep **Email OTP / link expiry** at 3600 s or lower (password reset links expire after this), and keep **Refresh token reuse detection** on.
- Dashboard — Supabase → Authentication → Attack protection: enable **CAPTCHA** (Turnstile or hCaptcha) once the sign-in form passes the token (not wired yet; see Decide).
- Decide — CAPTCHA on sign-up/sign-in (needs a provider key and ~20 lines in `UserAuthForm`).

### Secrets

- Done — No secret is in the code or the git history (scanned for API keys, JWTs, private keys, tokens). `.env*` is ignored.
- Done — CI builds with marker values for every server secret and fails if any (or an `sk_live_`/`re_`/`service_role` string) appears in `.next/static`, the files the browser downloads. Run it yourself: build, then `grep -r "sk_\|re_\|service_role" .next/static`.
- Done — `NEXT_PUBLIC_*` variables are the only ones the browser sees: Supabase URL and anon key (public by design, RLS is the guard), the Google Maps browser key, the site URL, the auth-provider list and the OAuth client id. `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET` and `GOOGLE_MAPS_SERVER_API_KEY` are server-only.
- Dashboard — Google Cloud → Credentials: restrict the **browser** Maps key to the site's HTTP referrers (`https://drop-point-xi.vercel.app/*` and the Vercel preview pattern) and to the Maps JavaScript, Places and Street View Static APIs. Create a **second key** for the server, restricted by API (Geocoding, Places) with no referrer, and set it as `GOOGLE_MAPS_SERVER_API_KEY` in Vercel. Until then the browser key must allow server calls, which means it cannot be referrer-restricted.
- Dashboard — If the browser key was ever unrestricted, treat it as exposed: regenerate it in Google Cloud and update `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel.

### Data

- Done — Every table has row-level security (`database/security.sql` enables it idempotently; policies are in `collaboration.sql` and `admin_configurations.sql`).
- Done — All queries go through the Supabase SDK (parameterized); the API routes build Google URLs with `URLSearchParams`.
- Done — The API routes validate on the server: coordinates must be numbers in range, the search input is capped at 200 characters, methods are checked.
- Done — Uploads are restricted in the browser (`ACCEPTED_FILE_TYPES`, 50 MB) and on the bucket (`allowed_mime_types`, `file_size_limit` in `security.sql`); nothing that can carry script (`text/html`, `image/svg+xml`) is stored.
- Done — Storage is a private bucket read through 1-hour signed URLs; storage policies mirror the table policies.
- Done — File names written into the viewer tab go through `escapeHtml`.
- Not applicable yet — Prices and payments: there is no billing. When the paywall lands, entitlement is decided by a Stripe webhook writing a `subscriptions` row that RLS reads, never by the client.

### Web

- Done — HTTPS is enforced by Vercel; `Strict-Transport-Security` (2 years, subdomains, preload) is sent.
- Done — `X-Frame-Options: DENY` and `frame-ancestors 'none'` (no clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`, no `X-Powered-By`.
- Done (report-only) — A Content-Security-Policy listing Supabase, Google Maps/Picker and Vercel as the only sources. **Next step:** open a preview, use the map, open a file, import from Drive, check the console for `Content-Security-Policy-Report-Only` violations, then rename the header in `next.config.ts` to `Content-Security-Policy`.
- Done — CORS: the API routes send no `Access-Control-Allow-Origin`, so browsers refuse cross-origin calls to them.
- Done — Rate limiting on the two Google proxy routes (60 and 120 requests a minute per user, in-memory per instance). Supabase rate-limits auth endpoints itself (Dashboard → Authentication → Rate limits; review the defaults).
- Dashboard — Vercel → Security: enable **Attack Challenge Mode** / the WAF if the plan offers it, for network-level rate limiting.

### Before launch

- Done — No debug output in production: `logger.debug/info` are development-only; the API routes log errors server-side only and never echo Google's error text to clients.
- Done — Dependencies updated; `npm audit` reports 0 vulnerabilities. Unused package (`@eslint/eslintrc`) and unused template files in `public/` removed.
- Done — Repository checked for exposed files: no `.env`, keys, dumps or backups; `public/` holds only the icon, logo and manifest.
- Decide — Error monitoring (Sentry or equivalent) needs a dependency and a DSN; Supabase's Auth and API logs cover the backend meanwhile.
- Dashboard — Vercel → Analytics/Logs: keep function logs; Supabase → Logs: review Auth logs for failed sign-ins monthly.
- Done — Every protection above has a test (`src/utils/apiGuard.test.ts`, `src/pages/api/reverse-geocode.test.ts`, `usePropertyFileActions.test.tsx`) and CI runs lint, build and tests on every push.

### Data rights (GDPR/CCPA readiness)

- Decide — Export of a user's data and account deletion with storage cleanup (needs a server-side route with the service role).
- Decide — Written retention policy.

### Ongoing cadence

- Monthly: `npm audit`, review Supabase Auth logs and Vercel function errors.
- Quarterly: test backup restore and re-read every RLS policy against `docs/collaboration.md`.
- Annually: full review of this list and the dependency tree.
