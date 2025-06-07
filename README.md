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
  - Upload and manage files per property (Supabase Storage; files can only be uploaded for saved properties with a valid ID)
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
- `src/pages/map.tsx`: Main app page, map, property selection, file upload (only for saved properties), property modal
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

---

## Property Saving & Location Accuracy (2024 Update)

- Properties are now only saved when a user uploads their first file to them. The map modal no longer allows saving a property directly or shows a checkmark for saved properties. This simplifies the flow and keeps the UI clean.
- When a user uploads a file, the property is created in the database (if it doesn't already exist) and the file is associated with it.
- The app still stores both:
  - The original map center coordinates the user selected (`user_selected_lat`, `user_selected_lng`)
  - The snapped address coordinates returned by Google Maps (`lat`, `lng`)
- The app uses the snapped address coordinates for the property pin, static map, and as the canonical property location in the database.
- This approach ensures consistency between the address and the map location, while preserving the user's original intent for future features (like custom boundaries).

## Property Modal UX Improvements
- The property info modal on the map no longer shows a checkmark or save button.
- The only action is to "Select" a property, which opens the details modal for file upload.
- Properties are saved automatically when a file is uploaded, not before.
- This results in a cleaner, more modern, and less cluttered user experience.

## Property Table Schema (Key Fields)
- `address`: The formatted address string
- `lat`, `lng`: Snapped address coordinates (from Google Maps)
- `user_selected_lat`, `user_selected_lng`: The user's original map center
- (other fields: label, notes, etc.)

## Rationale
- This design balances user experience, data accuracy, and future extensibility (e.g., supporting custom-drawn property boundaries or polygons).

## Unit Testing Setup (2024)

DropPoint now uses [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/) for unit and integration testing.

### How to Run Tests

- Run all tests:
  ```bash
  npm test
  # or
  npm run test
  ```
- Tests are automatically picked up from files matching `src/**/*.test.ts` or `src/**/*.test.tsx`.

### Configuration
- `vitest.config.ts`: Main Vitest configuration (jsdom, globals, setup file, test file pattern)
- `vitest.setup.ts`: Loads Testing Library matchers (e.g., `toBeInTheDocument`)

### Example Test
- See `src/utils/supabaseClient.test.ts` for a sample test that mocks Supabase and checks client creation.

### Where to Add Tests
- Place new test files next to the code they test, using the `.test.ts` or `.test.tsx` suffix.
- Use Testing Library for React components, and Vitest for utilities and logic.

### Why Vitest?
- Fast, modern, and compatible with Vite/Next.js projects
- Simple configuration and great TypeScript support
- Works seamlessly with Testing Library for React

## File Upload Guard

Files can only be uploaded for properties that have been saved to the database and have a valid ID. The UI and backend logic prevent file uploads for unsaved properties, avoiding errors and invalid storage paths.

# Project Update: Code Hygiene

## Recent Changes
- Cleaned up `src/pages/map.tsx` by removing unused variables and functions (`uploadingFiles`, `rejectedFiles`, `uploadError`, `searchActive`, `handleSaveProperty`, `handleFileInputChange`, `handleStartUpload`, and unused `data` assignments).
- Resolved all ESLint errors related to unused variables and functions.
- Improved maintainability and readability of the codebase.

## Why?
- Keeping the codebase free of unused code reduces cognitive load, prevents confusion, and ensures that only relevant logic is maintained.
- This aligns with best practices and keeps the project production-ready.

## Architecture Note
- All state and handler functions in `map.tsx` are now actively used or have a clear purpose.
- ESLint is enforced to maintain code quality.

## Recent Updates

- Cleaned up `src/pages/map.tsx` by removing unused variables and unnecessary ESLint disables.
- Improved code quality by using `const` where possible.
- Replaced raw `<img>` tags with Next.js `<Image />` for satellite map images, improving performance and following Next.js best practices.
- The codebase is now more maintainable, production-ready, and compliant with modern React/Next.js standards.

## Property Details Modal: Mobile-First UX Update (2024)

- The property details modal now features a fixed bottom action bar with large, easy-to-tap Upload and Create Folder buttons (split 50/50), inspired by the big Select button in the property selection modal.
- Folder creation is now handled via a dedicated popup/modal, not a dropdown, making it much more usable on mobile and preventing overflow/cutoff issues.
- The top of the modal displays a static satellite image of the property with a blue pin, using the Google Static Maps API, for instant visual context.
- All controls are accessible, uncluttered, and optimized for older/less tech-savvy users in real estate.

---

## Database Schema Updates (2024)

### property_folders Table
- `id` (uuid, PK)
- `property_id` (uuid, FK to properties, not null)
- `user_id` (uuid, FK to auth.users, not null)
- `name` (text, not null)
- `parent_id` (uuid, FK to property_folders, nullable)
- `created_at`, `updated_at`, `deleted_at` (timestamptz)
- **No duplicate folder names under the same parent for a property/user:**
  - The app auto-renames folders (e.g., "Folder", "Folder (1)", etc.) if a duplicate exists.
- RLS: Only the owner (user_id) can insert/select/update/delete their folders.

### properties Table
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users, not null)
- `address` (text, not null)
- `lat`, `lng` (float, not null)
- `user_selected_lat`, `user_selected_lng` (float, not null)
- `label`, `notes`, `thumbnail_url` (nullable)
- **Unique constraint:** (`user_id`, `address`) — a user cannot have two properties with the same address.
- RLS: Only the owner (user_id) can insert/select/update/delete their properties.

### Folder/File UX Logic
- Folders are persisted in the backend and always loaded from Supabase.
- Folder creation auto-renames to avoid duplicates ("Folder", "Folder (1)", etc.).
- Files can only be uploaded to saved properties.
- All data is private to the user unless shared (future-proofed for teams/sharing).

For more details, see the code in `

- Fixed a bug where the property modal did not show folders/files or allow uploads for existing properties. Now, when opening a property, the app fetches the full property row from Supabase (by address and user) and uses that as context. This ensures all modal features work for both new and existing properties.

## File/Folder Move Modal (Tree View)

- **Modern Google Drive–style Move Modal:**
  - When a user clicks "Move" on a file, a modal opens with a tree view of all folders for the current property.
  - The user can expand/collapse folders, select a destination, and confirm the move.
  - Invalid moves (e.g., moving a folder into itself or its descendants) are visually prevented (for folders, coming soon).
  - The UI is glassmorphic, mobile-friendly, and visually polished.
  - This replaces the old flat move dropdown for files, making the UX scalable and intuitive.
  - Folder moves and folder creation via tree view are coming soon.

- **Architecture:**
  - The MoveModal is a reusable component, designed to support both files and folders.
  - It receives the folder structure, current item, and move/cancel handlers as props.
  - All state and Supabase updates are handled in the parent (map.tsx), keeping the modal stateless and focused on UX.