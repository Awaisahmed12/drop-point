# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm ci              # Install dependencies (prefer over npm install)
npm run dev         # Start development server
npm run build       # Production build (also type-checks)
npm run lint        # ESLint (flat config; `next lint` no longer exists in Next 16)
npm test            # Run all tests with Vitest (watch mode)
npm run test:run    # Run all tests once
npx vitest run src/path/to/file.test.ts  # Run a single test file
```

CI runs lint, build, and tests on every push and pull request.

## Environment Variables

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

## Architecture

**DropPoint** is a Next.js (Pages Router) app where users pin properties on a Google Map and manage documents per property. Supabase handles auth, database (PostgreSQL with RLS), and file storage.

### Key Directories

- `src/pages/` — Next.js pages + API routes (`api/autocomplete`, `api/reverse-geocode`)
- `src/components/` — React components
- `src/hooks/` — Component state and shared behavior
- `src/services/` — `PropertyService`, `FileService`, `FolderService` — thin wrappers over the Supabase SDK
- `src/contexts/` — `ConfigContext` (admin feature flags) and `ToastContext`
- `src/utils/` — Supabase client init, logger, usage/quota helpers
- `types/` (repo root) — Shared TypeScript types (`Property`, `PropertyFile`, `PropertyFolder`, `MapType`, ...)
- `constants/` (repo root) — Map, zoom, quota, timing, and storage-key constants
- `utils/` (repo root) — Pure helpers (`fileManagement`, reverse-geocode address cache) with colocated tests

### State Management Pattern

Pages compose single-responsibility hooks rather than using a global store:

| Hook | Responsibility |
|------|---------------|
| `useMapState` | Map center/zoom (sessionStorage) and map type (localStorage) |
| `usePropertyState` | The user's properties, the pin under consideration, the open property |
| `usePropertyData` | Files, folders, and current folder for the open property |
| `usePropertyFileActions` | Upload, rename, move, duplicate, delete, create folder — shared by the map and list pages |
| `usePropertyPrefetch` | Module-level, id-keyed cache of files/folders (5 min TTL); the single cache for property data |
| `usePropertySwitcher` | Switching the open modal to another property |
| `useUserProperties` | Property list with file counts for list/sidebar/switcher views |
| `useSearchState` / `useModalState` | Search input and modal/address state on the map page |
| `useMobileViewport` | Responsive/touch styling |

Every mutation in `usePropertyFileActions` invalidates the prefetch cache for that property so re-opening it never shows stale files.

### Service Layer

Components never call Supabase data tables directly — they go through the service layer. Auth calls (`supabase.auth.*`) are the one exception. This keeps components testable and decoupled from the backend SDK.

### Auth

`withAuth(Component, { requireAuth: boolean })` is a HOC that wraps every page. It checks the Supabase session and redirects accordingly. Row-level security is enforced at the database level.

### API Routes

The two API routes (`/api/autocomplete`, `/api/reverse-geocode`) are thin proxies to the Google Maps APIs, keeping the API key server-side only.

### File Storage

Files are stored in Supabase Storage. Access is via signed URLs with a 1-hour expiry (generated in `src/utils/supabaseClient.ts`). Anything written into a file-viewer tab must go through `escapeHtml` in `PropertyDetailsModal` because that tab shares the app's origin.

### Design System: an iPhone app that happens to be a web app

Tokens live in `src/styles/globals.css` (Tailwind v4 `@theme`): the iOS grouped palette (`ground`, `surface`, `surface-2`, `ink`, `ink-2`, `ink-3`, `hairline`), one accent (`accent`), `danger`/`success`/`warning`, the HIG type scale (`text-large-title` … `text-caption-2`), and iOS component classes (`ios-group`/`ios-row`, `ios-search`, `ios-segmented`, `ios-button-*`, `ios-navbar`, `ios-sheet`, `ios-tabbar`, `ios-float`, `ios-close`, `ios-press`). Use these instead of raw gray/blue Tailwind colors so every screen reads as one system.

- Type comes from the system stack so iPhones render San Francisco. Large titles are 34pt/700; body is 17pt.
- Safe areas: pages pad with `var(--safe-top)` and use `pb-tabbar` above the 49pt tab bar (`MobileBottomNav`). The app is installable (`public/manifest.json`, `display: standalone`, translucent status bar).
- Sheets rise from the bottom on phones (`ios-sheet` + `ios-grabber`) and center on desktop. Secondary actions are `ActionSheet`s on touch and anchored menus on pointer devices (`presentation` prop on `FileMenu`/`FolderMenu`).
- Touch gets press states (`ios-press`, `ios-row-press`), never hover-only affordances.
- Desktop keeps the `WebSidebar` shell but uses the same components and tokens.

### UX Principle: Hick's Law

Keep the number of simultaneous choices small and grouped:

- One filled primary button per screen. At most three visible controls per bar.
- Map: search, a Map / Satellite segmented control, and a location button. No zoom buttons (pinch, scroll, double-tap). Satellite is Google's `hybrid` so labels stay visible; do not reintroduce a third mode.
- Property card: title, address, one button (Open / Add property). Renaming happens inside the sheet.
- Property sheet nav bar: close, title, and one "⋯" that opens a grouped action sheet (Switch property, Show as list/grid | Rename, Copy address). The "+" offers exactly Upload files / New folder.
- File menu groups: Download | Rename, Move to folder, Duplicate | Delete. Folder menu: Rename | Delete.
- Properties list rows only open the property; no per-row menus.
- Account is a Settings-style grouped list; profile questions are asked one at a time in an action sheet picker, and save on selection.
- Do not add controls that have no effect (a previous "Remember me" checkbox was wired to nothing).

## Git

Never add Claude as a co-author or author on any commit or pull request. Do not include `Co-Authored-By: Claude` or any Anthropic-attributed lines in commit messages.

## Coding Conventions

- **Prefer least-diff changes** — non-breaking refactors only; do not modify external behavior unless guarded by a reversible shim.
- **No new files, dependencies, or cross-file imports** without explicit authorization.
- **If uncertain**, choose the smallest no-risk change or leave a `TODO` comment.
- All pages are TypeScript (`.tsx`). Tailwind CSS 4 for styling (no CSS modules, no `tailwind.config.js`).
- Persisted-preference reads that affect server-rendered markup happen in a mount effect (see `WebSidebar`) to avoid hydration mismatches; state that is never server-rendered may use a lazy `useState` initializer (see `useMapState`).
