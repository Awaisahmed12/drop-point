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

- **Fixed folder menu functionality**: Resolved issue where folder rename and delete menus weren't opening due to a race condition between click handlers and blur events. Removed conflicting blur handler and optimized click-outside detection.
- **Enhanced button UX**: Made upload and create buttons larger (112px height) with bigger icons and press effects for better mobile experience.
- **Improved satellite preview**: Increased satellite image height for better property visualization.
- **Clean folder creation**: Implemented robust auto-rename logic that handles duplicate folder names gracefully with sequential numbering (e.g., "Folder" → "Folder (1)" → "Folder (2)").
- **Better error handling**: Added proper TypeScript error types and improved error messages throughout the application.
- Cleaned up `src/pages/map.tsx` by removing unused variables and unnecessary ESLint disables.
- Improved code quality by using `const` where possible.
- Replaced raw `<img>` tags with Next.js `<Image />` for satellite map images, improving performance and following Next.js best practices.
- The codebase is now more maintainable, production-ready, and compliant with modern React/Next.js standards.
- Fixed ESLint errors in file renaming functionality by removing unused `newBase` variables, ensuring clean builds.
- **Fixed click behavior**: Clicking on files/folders now opens them properly instead of triggering rename. Rename functionality is now only available through the "..." menu, providing a more intuitive user experience.
- **Enhanced file management**: Added proper file/folder menus with rename, delete, move, and open options.
- **Improved sorting**: Added sortable columns for name, date, and size with visual indicators.
- **Better mobile experience**: Responsive design with mobile-optimized folder and file lists.
- **Robust upload handling**: Added progress indicators, error handling, retry functionality, and duplicate name resolution.
- **Professional UI**: Google Drive-inspired design with consistent colors, icons, and interactions.

## Property Details Modal: Mobile-First UX Update (2024)

- The property details modal now features a fixed bottom action bar with large, easy-to-tap Upload and Create Folder buttons (split 50/50), inspired by the big Select button in the property selection modal.
- Folder creation is now handled via a dedicated popup/modal, not a dropdown, making it much more usable on mobile and preventing overflow/cutoff issues.
- The top of the modal displays a static satellite image of the property with a blue pin, using the Google Static Maps API, for instant visual context.

## Latest UI/UX Enhancements (2024)

### Enhanced Action Buttons
- **Larger buttons for better mobile UX**: Upload and Create buttons increased to 112px height with bigger icons (w-9 h-9) and improved spacing
- **Visual feedback**: Added active:scale-95 press effect for tactile feedback on button interactions
- **Consistent focus states**: Create button uses gray focus ring, Upload button uses blue focus ring for better visual hierarchy
- **Improved accessibility**: Larger touch targets make the app more accessible on mobile devices

### Satellite Image Preview
- **Taller preview images**: Increased satellite image height from h-48 sm:h-64 to provide better property visualization
- **Optimized spacing**: Reduced whitespace between satellite image and search bar for better content density
- **Dynamic image sizing**: Google Maps API image dimensions adjusted to match UI improvements (640x213)

### Clean Folder Creation Logic
- **Simplified auto-rename system**: Replaced complex dual-check system with a clean, single retry loop
- **Sequential numbering**: Duplicate folder names are handled gracefully with "Folder", "Folder (1)", "Folder (2)" pattern
- **Better error handling**: Single try-catch block with clear error messages and proper cleanup
- **Improved reliability**: Maximum 10 attempts with early exit on success prevents infinite loops

### Technical Improvements
- **Consistent code patterns**: All async operations follow the same error handling pattern
- **Better state management**: Loading and error states are properly managed throughout the folder creation flow
- **Clean separation of concerns**: UI state, business logic, and database operations are clearly separated

## React Hook Rule Fix (Latest Update)

**Issue Resolved:** Fixed a React Hook rule violation in `src/pages/map.tsx` where a `useEffect` hook was being called conditionally after the return statement.

**What Was Fixed:**
- Moved the `useEffect` hook that logs `renamingFileId` changes to before the return statement
- Relocated helper functions (`splitFileNameAndExt` and `FileIcon` component) to before the return statement
- Ensured all hooks are called in the same order every render, following React's Rules of Hooks

**Result:**
- Build now passes successfully with no ESLint errors
- All React Hook rules are properly followed
- Code maintains proper structure and maintainability

**Technical Details:**
- React hooks must be called at the top level of the component, before any conditional returns
- Helper functions and components used in JSX must be defined before the return statement
- This fix ensures the component follows React best practices and maintains proper hook ordering

---

## Current Build Status

✅ **Build Status: SUCCESSFUL**
- All ESLint rules pass
- React Hook rules properly followed
- TypeScript compilation successful
- Production build ready for deployment

The project is now in a clean, production-ready state with proper code structure and no linting violations.