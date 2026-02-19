# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm ci              # Install dependencies (prefer over npm install)
npm run dev         # Start development server
npm run build       # Production build
npm run lint        # ESLint via Next.js
npm test            # Run all tests with Vitest
npx vitest run src/path/to/file.test.ts  # Run a single test file
```

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
- `src/components/` — React components; `components/Map/` has map-specific ones
- `src/hooks/` — All component state lives here (11 custom hooks)
- `src/services/` — `PropertyService`, `FileService`, `FolderService` — thin wrappers over Supabase SDK
- `src/contexts/` — `ConfigContext` for admin settings (e.g. street view toggle)
- `src/types/` — Shared TypeScript types (`Property`, `PropertyFile`, `PropertyFolder`, etc.)
- `src/utils/` — Supabase client init, formatting helpers, usage utilities

### State Management Pattern

The map page (`pages/map.tsx`) composes many single-responsibility hooks rather than using a global store:

| Hook | Responsibility |
|------|---------------|
| `useMapState` | Map position/zoom/type, persisted in `sessionStorage` |
| `usePropertyState` | Currently selected property |
| `usePropertyData` | Files and folders for the selected property |
| `useSearchState` | Search/filter input |
| `useModalState` | Modal open/close |
| `useUploadState` | File upload progress |
| `useMenuState` | Context menu visibility |
| `useMobileViewport` | Responsive/touch styling |

### Service Layer

Components never call Supabase directly — they go through the service layer. This keeps components testable and decoupled from the backend SDK.

### Auth

`withAuth(Component, { requireAuth: boolean })` is a HOC that wraps every page. It checks Supabase session and redirects accordingly. Row-level security is enforced at the database level.

### API Routes

The two real API routes (`/api/autocomplete`, `/api/reverse-geocode`) are thin proxies to the Google Maps APIs, keeping the API key server-side only.

### File Storage

Files are stored in Supabase Storage. Access is via signed URLs with a 1-hour expiry (generated in `FileService`).

## Git

Never add Claude as a co-author or author on any commit or pull request. Do not include `Co-Authored-By: Claude` or any Anthropic-attributed lines in commit messages.

## Coding Conventions

- **Prefer least-diff changes** — non-breaking refactors only; do not modify external behavior unless guarded by a reversible shim.
- **No new files, dependencies, or cross-file imports** without explicit authorization.
- **If uncertain**, choose the smallest no-risk change or leave a `TODO` comment.
- All pages are TypeScript (`.tsx`). Tailwind CSS 4 for styling (no CSS modules).
- Virtualized lists (`react-window`) are used in file/folder views for performance.
