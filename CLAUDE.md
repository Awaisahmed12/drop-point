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
| `usePropertyPrefetch` | Module-level, id-keyed cache of files/folders (5 min TTL) plus signed thumbnail URLs (batched, 55 min) and image warming (hero photo + first thumbnails); the single cache for property data |
| `useSheetHistory` | Keeps the open property and folder in the URL (`?property=&folder=`), one history entry per step, so Back/Forward/swipe move through them and a link opens a property; `close` jumps back to the pre-open URL |
| `usePropertySwitcher` | Switching the open modal to another property |
| `useUserProperties` | Property list with file counts for list/sidebar/switcher views |
| `useSearchState` / `useModalState` | Search input and modal/address state on the map page |
| `useMobileViewport` | Responsive/touch styling |

Every mutation in `usePropertyFileActions` invalidates the prefetch cache for that property so re-opening it never shows stale files.

Navigation is in the URL. The map and Properties pages call `sheetHistory.open/changeFolder/close` on user actions and let its effect drive state when the browser navigates; `PropertyDetailsModal` does the same for the viewed file (`?file=`). Never open or close the sheet with raw state setters from a user action; go through the hook so history stays right.

Prefetch runs ahead of the tap: the map warms the most recent pins on load and on marker hover, and warms the hero when a pin is selected; the Properties page warms its first eight cards on load and any card on press/hover; the desktop sidebar warms on hover. `warmImage` respects Data Saver. Thumbnail URLs that expire re-sign once on image error instead of falling back to the icon.

### Service Layer

Components never call Supabase data tables directly — they go through the service layer. Auth calls (`supabase.auth.*`) are the one exception. This keeps components testable and decoupled from the backend SDK.

### Auth

`withAuth(Component, { requireAuth: boolean })` is a HOC that wraps every page. It checks the Supabase session and redirects accordingly. Row-level security is enforced at the database level.

### API Routes

The two API routes (`/api/autocomplete`, `/api/reverse-geocode`) are thin proxies to the Google Maps APIs, keeping the API key server-side only.

### File Storage

Files are stored in Supabase Storage. Access is via signed URLs with a 1-hour expiry (generated in `src/utils/supabaseClient.ts`). Anything written into a file-viewer tab must go through `escapeHtml` in `PropertyDetailsModal` because that tab shares the app's origin.

### Design System: a 2026 iPhone app that happens to be a web app

Materials are Liquid Glass: translucent, blurred, with a specular top edge (`glass`, `glass-dark`, `ios-float`). Anything that floats over content is glass: the tab bar (a capsule inset from the edges), the map search field and controls, the property card, action sheets, toasts, and the sheet's nav bar once content scrolls under it. Corners are large and concentric (sheet 28px, cards 24px, grouped rows 20px, buttons and fields are capsules). The property sheet opens on a hero photo with the name set into it; the nav bar floats over the photo and turns solid on scroll. Every bottom sheet's grabber and nav zone is a real pull-to-dismiss handle (`useSheetDrag`): a press on a button inside it is a tap, and pointer capture starts only after 6px of travel, so the buttons keep working with a mouse.

Light and dark follow the device. The palette, shadows, and materials are redefined under `@media (prefers-color-scheme: dark)` in `globals.css`, the file-viewer tab and `theme-color` metas follow too, and the map uses Google's `FOLLOW_SYSTEM` color scheme. There is no in-app toggle. Never use raw `white`/`gray`/`blue` Tailwind utilities for chrome: they don't flip. Photo overlays (`text-white` on a scrim, the lightbox) are the one place white is literal.

Tokens live in `src/styles/globals.css` (Tailwind v4 `@theme`): the iOS grouped palette (`ground`, `surface`, `surface-2`, `ink`, `ink-2`, `ink-3`, `hairline`), one accent (`accent`), `danger`/`success`/`warning`, the HIG type scale (`text-large-title` … `text-caption-2`), and iOS component classes (`ios-group`/`ios-group-glass`/`ios-row`, `ios-search`, `ios-segmented`, `ios-button-*`, `ios-navbar`, `ios-sheet`, `ios-tabbar`, `ios-float`, `ios-close`, `ios-press`). Use these instead of raw gray/blue Tailwind colors so every screen reads as one system.

- Type comes from the system stack so iPhones render San Francisco. Large titles are 34pt/700; body is 17pt.
- Safe areas: pages pad with `var(--safe-top)` and use `pb-tabbar` above the 49pt tab bar (`MobileBottomNav`). The app is installable (`public/manifest.json`, `display: standalone`, translucent status bar).
- Sheets rise from the bottom on phones (`ios-sheet` + `ios-grabber`) and center on desktop. Secondary actions are `ActionSheet`s on touch and anchored menus on pointer devices (`presentation` + `anchorRef` on `ActionSheet`, `presentation` on `FileMenu`/`FolderMenu`). Desktop never shows an iOS bottom sheet.
- Touch gets press states (`ios-press`, `ios-row-press`), never hover-only affordances.
- Desktop keeps the `WebSidebar` shell but uses the same components and tokens.

### UX Principle: Hick's Law

Keep the number of simultaneous choices small and grouped:

- One filled primary button per screen. At most three visible controls per bar.
- Map: search, a Map / Satellite segmented control, and a location button. No zoom buttons (pinch, scroll, double-tap). Satellite is Google's `hybrid` so labels stay visible; do not reintroduce a third mode.
- Property card: title, address, one button (Open / Add property). Renaming happens inside the sheet.
- Property sheet nav bar: close, title, and one "⋯" that opens a grouped action sheet (Switch property, Show as list/grid | Rename, Copy address). The "+" offers exactly Upload files / New folder.
- File menu groups: Download | Rename, Move to folder, Duplicate | Delete. Folder menu: Rename | Delete.
- Properties are photo cards (Street View, satellite fallback) with the name set into a scrim and one file-count pill. Tapping a card only opens the property; no per-card menus. One glass search capsule above the grid.
- Account is an avatar hero (tap the name to edit it inline) over a wash of the user's color, then glass groups: Storage, About you, Sign out. Profile questions are asked one at a time in an action sheet picker, and save on selection.
- Do not add controls that have no effect (a previous "Remember me" checkbox was wired to nothing).

## Git

Never add Claude as a co-author or author on any commit or pull request. Do not include `Co-Authored-By: Claude` or any Anthropic-attributed lines in commit messages.

## Coding Conventions

- **Prefer least-diff changes** — non-breaking refactors only; do not modify external behavior unless guarded by a reversible shim.
- **No new files, dependencies, or cross-file imports** without explicit authorization.
- **If uncertain**, choose the smallest no-risk change or leave a `TODO` comment.
- All pages are TypeScript (`.tsx`). Tailwind CSS 4 for styling (no CSS modules, no `tailwind.config.js`).
- Persisted-preference reads that affect server-rendered markup happen in a mount effect (see `WebSidebar`) to avoid hydration mismatches; state that is never server-rendered may use a lazy `useState` initializer (see `useMapState`).
