# DropPoint

DropPoint is a map-based document storage web app for real estate professionals. It allows users to search and select properties on a map, upload and manage files per property, and is designed with a modern, mobile-first UI.

---

## Project Overview
- **Purpose:** Help real estate professionals organize property documents by location.
- **Core Features:**
  - User authentication (Supabase)
  - Map interface (Google Maps) with search (Google Places Autocomplete)
  - Select a property by map center or search
  - Reverse geocode to get property address
  - Save properties (with duplicate prevention)
  - Upload and manage files per property (Supabase Storage)
  - Property details modal with file management
  - Modern, mobile-first UI (TailwindCSS, glassmorphism, smooth animations)
  - Limited to 5 properties or 5GB storage per user (enforced in backend, not yet visible in UI)
- **Tech Stack:** Next.js (pages router), TypeScript, TailwindCSS, Supabase, Google Maps API

For a detailed vision, completed steps, and roadmap, see [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md).

---

## Quickstart

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```
2. **Set up environment variables:** Create a `.env.local` file with:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Main Files & Structure
- `src/pages/index.tsx`: Landing page, shows login/signup form
- `src/components/UserAuthForm.tsx`: Handles authentication UI and logic
- `src/pages/map.tsx`: Main app page, map, property selection, file upload, property modal
- `src/pages/api/autocomplete.ts` and `reverse-geocode.ts`: Google Maps API proxies
- `src/utils/supabaseClient.ts`: Supabase client setup
- `src/styles/globals.css`: Tailwind and custom styles
- `public/logo.png`: App logo

---

## For AI Assistants: "Catch Up" Section
- **Current Status:** File upload and property file management are implemented. "My Properties" dashboard is a planned next step.
- **What We're Working On:**
  - Integrate a "My Properties" dashboard for users to view/manage their saved properties and files.
  - Enforce property/file limits in the UI.
- **Design/UX:** Modern, glassmorphic, blue-accented, mobile-first, premium feel.
- **How to Help:**
  - Always check `PROJECT_OVERVIEW.md` for the latest goals and roadmap.
  - Review the main files above for the current implementation.
  - Use this README to quickly get up to speed on the project context and next steps.

---

## Learn More
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Maps Platform](https://developers.google.com/maps)
- [TailwindCSS](https://tailwindcss.com/)

---

## Future Collaboration & Property Sharing (Big Picture)

As DropPoint evolves, we anticipate supporting collaboration and property sharing among users and teams. In the future, when multiple users save the same property (e.g., same address/lat/lng), the system may link them to a single global property record, with access managed via a join table (e.g., `property_users`). This would allow:
- Shared file access and uploads for properties among team members or collaborators
- More advanced permissions and roles (owner, collaborator, etc.)
- Avoiding file duplication and enabling true team workflows

**Design Consideration:**
- If a user tries to save a property that another user already has, the app should detect this and offer to join the existing property, rather than duplicating it.
- File uploads would be associated with the property, not just the user, and access would be managed via RLS policies based on property membership.

**Note:** This is a complex scenario and will require careful data modeling and RLS policy design. For now, each user has their own properties and files, but this is a key area for future development.

---

## Property Specificity (Suites, Units, etc.)

To support users who want to save more specific property locations (e.g., 123 Main Street, Suite #220 vs. Suite #345), the app should:
- Allow users to add unit/suite numbers or other sub-address details when saving a property
- Treat properties with the same base address but different units as distinct properties in the database
- Optionally, group or relate these sub-properties for easier management in the UI

This ensures users can organize documents for specific units within the same building, supporting real-world real estate workflows.
