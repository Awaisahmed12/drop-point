## DropPoint

DropPoint is a map-based document management platform for real estate professionals. Properties are selected on an interactive map, and each property acts as a parent folder for files and folders.

## Tech stack

- Next.js (Pages Router)
- React + TypeScript
- Tailwind CSS
- Supabase (Auth, Postgres, Storage)
- Google Maps JavaScript API + Places API

## Quickstart

```bash
npm ci
npm run dev
```

## Environment variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_SITE_URL=https://drop-point-xi.vercel.app   # public origin for OAuth redirects and share previews

# Optional connectors
NEXT_PUBLIC_AUTH_PROVIDERS=google,apple,facebook   # social sign-in (enable each provider in Supabase Auth too)
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=                 # Google OAuth web client id; enables "Import from Google Drive"
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=                  # optional, defaults to the Maps key
```

## Docs

- Overview: `docs/overview.md`
- Product requirements: `docs/product-requirements.md`
- Security checklist: `docs/security-checklist.md`
- Admin setup: `docs/admin-setup.md`
- Engineering quality and refactoring: `docs/engineering/quality-and-refactoring.md`
