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

### Pages
- `src/pages/index.tsx`: Landing page, shows login/signup form
- `src/pages/map.tsx`: Main map page (refactored to focus only on map functionality)
- `src/pages/api/autocomplete.ts` and `reverse-geocode.ts`: Google Maps API proxies

### Components
- `src/components/UserAuthForm.tsx`: Handles authentication UI and logic
- `src/components/MapSearch.tsx`: Map search bar with Google Places autocomplete
- `src/components/MapControls.tsx`: Map type toggle controls (satellite/roadmap)
- `src/components/PropertyInfoCard.tsx`: Bottom card showing property address and Select button
- `src/components/PropertyDetailsModal.tsx`: Property details modal with file management
- `src/components/SkeletonItem.tsx`: Loading skeleton for files and folders
- `src/components/FileIcon.tsx`: File type icons
- `src/components/MoveModal.tsx`: Modal for moving files between folders

### Types & Constants
- `types/index.ts`: Centralized type definitions (Property, PropertyFile, PropertyFolder, etc.)
- `constants/index.ts`: App-wide constants (API keys, map settings, file type colors, etc.)

### Utilities
- `src/utils/supabaseClient.ts`: Supabase client setup
- `utils/fileManagement.ts`: File operation utilities (formatting, validation, etc.)
- `utils/propertyCache.ts`: Property data caching service
- `src/utils/formatting.ts`: Date and file formatting utilities (with compatibility imports)

### Styles & Assets
- `src/styles/globals.css`: Tailwind and custom styles
- `public/logo.png`: App logo

## Architecture Notes

### Recent Refactoring (2024)
The codebase has been significantly refactored to improve maintainability and separation of concerns:

- **Extracted Components**: The massive `map.tsx` file (2357 lines) has been broken into focused, reusable components
- **Centralized Types**: All TypeScript interfaces moved to `types/index.ts`
- **Shared Constants**: Configuration values centralized in `constants/index.ts`
- **Utility Services**: File management and caching logic extracted into dedicated utility modules
- **Preserved Caching**: The property caching system is maintained and properly passed between components

### Component Hierarchy
```
MapPage
├── MapSearch (search bar with autocomplete)
├── MapControls (satellite/roadmap toggle)
├── PropertyInfoCard (bottom address card)
└── PropertyDetailsModal (file management modal)
    ├── SkeletonItem (loading states)
    ├── FileIcon (file type icons)
    └── MoveModal (file moving functionality)
```

### Key Design Decisions
- **Cache Preservation**: All caching functionality is maintained and passed through component props
- **Single Responsibility**: Each component has a clear, focused purpose
- **Type Safety**: Comprehensive TypeScript types for all data structures
- **Reusability**: Components are designed to be reusable and testable

---

## For AI Assistants: "Catch Up" Section
- **Current Status:** ✅ **MAJOR REFACTORING COMPLETE + SEARCH FIXED + FILE HANDLING ENHANCED + UPLOAD EXPERIENCE UPGRADED + STICKY SCROLL OPTIMIZED!** The monolithic `map.tsx` file (2357 lines) has been successfully broken into focused components and utilities while preserving all functionality. Search predictions API issue resolved. File handling now supports Unicode characters with robust sanitization. Upload experience now provides real-time progress tracking, cancellation, and retry capabilities. PropertyDetailsModal now features optimized sticky scroll behavior for enhanced file browsing.
- **What We're Working On:**
  - **IMMEDIATE**: Continue enhancing PropertyDetailsModal with advanced file management features
  - **NEXT**: Integrate a "My Properties" dashboard for users to view/manage their saved properties and files
  - **FUTURE**: Add collaborative features and property sharing capabilities
- **Recent Changes:**
  - ✅ **COMPLETED REFACTORING**: Successfully extracted and integrated all components
  - ✅ **FIXED SEARCH API**: Resolved Google Places API prediction issues
  - ✅ **ENHANCED FILE HANDLING**: Added Unicode support, sanitization, and smart viewing
  - ✅ **UPGRADED UPLOAD EXPERIENCE**: Real-time progress, cancellation, and retry functionality
  - ✅ **OPTIMIZED STICKY SCROLL**: Satellite image now scrolls away during file browsing while keeping navigation elements sticky
  - 🔄 **CURRENT**: Testing and refining the enhanced file management system
- **Design/UX:** Modern, glassmorphic, blue-accented, mobile-first, premium feel with optimized scroll behavior for maximum file browsing space.
- **How to Help:**
  - The refactoring preserves all existing functionality while improving code organization
  - Focus on maintaining the caching system - it's critical for performance
  - Each component should receive cache functions as props
  - Always check `PROJECT_OVERVIEW.md` for the latest goals and roadmap.

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

## Unicode File Handling & Sanitization (2024)

DropPoint now provides robust support for international file names with comprehensive Unicode character handling:

### Supported Characters & Languages
- **Chinese**: 工具包样本册.xlsx → 2023.8.28.xlsx
- **Japanese**: テスト文書.pdf → file.pdf  
- **Arabic**: ملف.doc → file.doc
- **Cyrillic**: файл.docx → file.docx
- **Hebrew**: קובץ.txt → file.txt
- **Special Characters**: Handles <, >, :, ", /, \, |, ?, * and other problematic characters

### Sanitization Process
1. **Unicode Normalization**: Files are normalized using NFD (Canonical Decomposition)
2. **Character Replacement**: Non-ASCII characters are replaced with underscores
3. **Extension Preservation**: File extensions are cleaned but preserved
4. **Length Limiting**: Filenames are truncated to 200 characters for storage compatibility
5. **Fallback Naming**: Empty names default to "file" with appropriate extension

### Where Sanitization Applies
- **Upload**: All uploaded files are automatically sanitized
- **Rename**: User-renamed files are sanitized before storage
- **Move**: Files moved between folders maintain sanitized names
- **Folder Names**: Folder names use lighter sanitization (preserving more characters)

### Technical Implementation
- **Storage Path**: `property-files/{property_id}/{sanitized_filename}`
- **Database Integration**: Sanitized names stored in PostgreSQL with original metadata
- **Real-time Processing**: Files are sanitized during upload, not on display
- **Conflict Resolution**: Automatic duplicate handling with `(1)`, `(2)` suffixes

## Enhanced Upload Experience (2024)

DropPoint now provides a professional-grade file upload experience with comprehensive user control and feedback:

### Real-Time Progress Tracking
- **Visual Progress Indicators**: Animated SVG progress circles with percentage display
- **Live Upload Status**: Color-coded states (blue=uploading, green=success, red=error)
- **File Information Display**: Shows file icons, names, and sizes during upload
- **Instant Feedback**: Files appear immediately in "Uploading Files" section

### Upload Control & Management
- **Cancel Uploads**: Users can cancel in-progress uploads if they hang or take too long
- **Retry Failed Uploads**: One-click retry for failed uploads with detailed error messages
- **Dismiss Completed**: Remove successful or failed uploads from the UI
- **Multiple File Support**: Handles multiple simultaneous uploads with individual progress tracking

### Technical Features
- **Supabase Integration**: Uses Supabase's built-in upload method for proper file handling
- **AbortController Integration**: Proper cancellation support using modern browser APIs
- **Error Handling**: Comprehensive error processing with user-friendly messages
- **State Management**: React state synchronization for upload progress and status
- **Memory Management**: Automatic cleanup of completed uploads to prevent memory leaks

### Upload System Fix (Latest Update)
**Issue Resolved:** Fixed critical 400 Bad Request errors during file uploads caused by improper URL encoding and manual XMLHttpRequest implementation.

**Root Cause:** 
- Custom XMLHttpRequest was manually constructing Supabase Storage API URLs
- Filenames with spaces and special characters (e.g., `2024_W2 (1).pdf`) were being URL-encoded incorrectly
- Manual header and authentication setup was causing request failures

**Solution Implemented:**
- **Replaced XMLHttpRequest with Supabase's upload method**: Now uses `supabase.storage.from('property-files').upload()` which properly handles:
  - URL encoding for filenames with spaces and special characters
  - Authentication headers and API key management
  - Proper request formatting and error responses
- **Maintained progress tracking**: Implemented simulated progress indicators since Supabase doesn't expose real-time upload progress
- **Enhanced error handling**: Supabase's structured error responses provide better debugging information
- **Preserved cancellation support**: AbortController integration still works with the promise-based approach

**Technical Details:**
```typescript
// Before: Manual XMLHttpRequest (caused 400 errors)
xhr.open('POST', `${supabaseUrl}/storage/v1/object/property-files/${filePath}`, true);
xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
// Issues with URL encoding and header setup

// After: Supabase's built-in method (works correctly)
supabase.storage.from('property-files').upload(filePath, file, {
  cacheControl: '3600',
  upsert: true
});
// Handles all encoding, headers, and authentication automatically
```

**Result:** 
- ✅ All file uploads now work correctly, including files with Unicode characters
- ✅ No more 400 Bad Request errors
- ✅ Proper handling of filenames with spaces, parentheses, and special characters
- ✅ Maintained professional upload experience with progress tracking and controls

### Upload UX Improvements (Latest Update)
**Enhanced User Experience:** Completely redesigned the upload feedback system for better visibility and usability.

**Key Improvements:**
1. **Top Placement**: Upload progress now appears prominently at the top of the modal (right after the search bar) instead of at the bottom
   - **No more scrolling**: Users can immediately see upload progress without scrolling
   - **Always visible**: Upload status is always in view during file management
   - **Intuitive positioning**: Follows natural reading flow from top to bottom

2. **Compact Design**: Streamlined upload cards for better space utilization
   - **Smaller footprint**: Reduced height and padding for uploading files since they're temporary
   - **Smaller icons**: 20px file icons instead of 32px for more compact display
   - **Condensed progress circles**: 20px progress indicators instead of 32px
   - **Minimal text**: "Done!" instead of "Uploaded!" for success states

3. **Smart Auto-Dismiss**: Intelligent handling of upload completion
   - **Success auto-dismiss**: Successful uploads automatically disappear after 1.5 seconds
   - **Error persistence**: Failed uploads remain visible until manually dismissed
   - **User control**: Users can still manually dismiss any upload if needed

4. **Enhanced Visual Feedback**:
   - **Color-coded states**: Blue for uploading, green for success, red for errors
   - **Compact action buttons**: Smaller retry/cancel/dismiss buttons (12px icons)
   - **Smooth transitions**: All state changes are animated for better UX

**Technical Implementation:**
```typescript
// Auto-dismiss successful uploads after 1.5 seconds
useEffect(() => {
  const successfulUploads = pendingUploads.filter(p => p.status === 'success');
  if (successfulUploads.length > 0) {
    const timeouts = successfulUploads.map(upload => 
      setTimeout(() => {
        onDismiss(upload.id);
      }, 1500) // 1.5 seconds - snappy but not rushed
    );
    
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }
}, [pendingUploads, onDismiss]);
```

**User Benefits:**
- **Immediate visibility**: No need to scroll to see upload progress
- **Reduced clutter**: Successful uploads clean themselves up automatically after 1.5 seconds
- **Better focus**: Compact design doesn't dominate the interface
- **Error management**: Failed uploads stay visible for proper error handling
- **Professional feel**: Similar to modern file sharing services like Google Drive and Dropbox
- **Clean progress indication**: Simple spinning circle during upload (no percentage clutter)
- **Snappy UX**: Quick success confirmation that doesn't overstay its welcome

### Sticky Scroll Behavior (Latest Update)
**Enhanced File Browsing:** Implemented intelligent sticky positioning for optimal file management experience.

**Smart Scroll Behavior:**
1. **Satellite Image Scrolls Away**: The satellite image is positioned inside the scrollable container, so when users scroll down through files, it naturally scrolls out of view to maximize space for file browsing
2. **Navigation Elements Stay Put**: All essential navigation elements remain in their original positions:
   - **Header**: Property address and close button (fixed at top)
   - **Breadcrumbs**: Folder navigation path (fixed below header)
   - **Search Bar**: File search input (sticky at `top-0`)
   - **Upload Progress**: Active upload status (sticky at `top-14`)
   - **Column Headers**: Sort controls (sticky within scroll area)
3. **Files Scroll Freely**: File and folder content scrolls normally underneath the sticky elements
4. **Satellite Returns**: When scrolling back to the top of the file list, the satellite image comes back into view

**User Benefits:**
- **Maximum File Space**: Satellite image gets out of the way during file browsing without losing essential navigation
- **Always Accessible Controls**: Search, breadcrumbs, and upload status remain accessible while scrolling
- **Visual Context Available**: Satellite image is visible when needed (at the top of file list)
- **Intuitive Behavior**: Natural scroll behavior where non-essential visual elements scroll away
- **Efficient Workflow**: Users can manage large file lists without losing essential navigation controls

**Technical Implementation:**
- **Satellite Image**: Moved inside the scrollable container (`<div className="flex-1 overflow-y-auto">`)
- **Navigation Elements**: Remain outside the scroll area with proper sticky positioning
- **Layered Z-Index**: Search bar (`z-30`), uploads (`z-20`), headers (`z-10`) for proper layering
- **Original Layout Preserved**: Header, breadcrumbs, search, and uploads stay in their intended positions

This creates the perfect balance where the satellite image provides visual context when needed but doesn't interfere with file management workflows.

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
- **Fixed file URL generation**: Replaced hardcoded Supabase URLs with proper `getFilePublicUrl()` utility function that uses the Supabase client to generate correct public URLs for file access.
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

### Enhanced Upload Experience
- **Immediate Visual Feedback**: Uploads appear instantly in the file list with progress indicators
- **Animated Progress Circles**: Real-time progress visualization with percentage display
- **Professional Status Indicators**: 
  - **Uploading**: Blue progress circle with animated progress
  - **Success**: Green checkmark with "Uploaded!" message
  - **Error**: Red X with detailed error message and retry option
- **Interactive Controls**: 
  - **Cancel Button**: Stop uploads in progress
  - **Retry Button**: Restart failed uploads with one click
  - **Dismiss Button**: Remove completed or failed uploads from view
- **File Information**: Shows file icon, name (without extension), and file size during upload
- **Organized Layout**: Dedicated "Uploading Files" section with clean, card-based design
- **Color-coded Backgrounds**: Blue for uploading, green for success, red for errors
- **Responsive Design**: Works seamlessly on mobile and desktop

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

---

## 🚀 Complete Replication Guide

This section contains **everything** needed to build an exact replica of DropPoint from scratch.

### Dependencies & Versions (package.json)
```json
{
  "name": "drop-point",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build", 
    "start": "next start",
    "lint": "next lint",
    "test": "vitest"
  },
  "dependencies": {
    "@heroicons/react": "^2.2.0",
    "@react-google-maps/api": "^2.20.6",
    "@supabase/supabase-js": "^2.49.4",
    "next": "15.3.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-virtualized-auto-sizer": "^1.0.20",
    "react-window": "^1.8.10",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/react-window": "^1.8.8",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.4.1",
    "eslint": "^9",
    "eslint-config-next": "15.3.1",
    "jsdom": "^26.1.0",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^3.1.4"
  }
}
```

### Required Configuration Files

#### TypeScript Config (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["vitest/globals"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

#### Next.js Config (next.config.ts)
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bxfydeqjmfjeanapfhpr.supabase.co',
        pathname: '/storage/v1/object/public/property-files/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
```

#### Tailwind Config (tailwind.config.js)
```javascript
module.exports = {
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '-100% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    },
  },
}
```

#### Test Config (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

### Environment Variables (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Database Schema (Supabase)

#### properties table
```sql
CREATE TABLE properties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  lat float8 NOT NULL,
  lng float8 NOT NULL,
  user_selected_lat float8,
  user_selected_lng float8,
  label text,
  notes text,
  thumbnail_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### property_files table
```sql
CREATE TABLE property_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES property_folders(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  modified_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_type text NOT NULL,
  file_size int4 NOT NULL
);
```

#### property_folders table
```sql
CREATE TABLE property_folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES property_folders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
```

### Row Level Security (RLS) Policies
```sql
-- Properties RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own properties" ON properties
  FOR ALL USING (auth.uid() = user_id);

-- Property Files RLS  
ALTER TABLE property_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own files" ON property_files
  FOR ALL USING (auth.uid() = user_id);

-- Property Folders RLS
ALTER TABLE property_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own folders" ON property_folders
  FOR ALL USING (auth.uid() = user_id);
```

### Supabase Storage Configuration
```sql
-- Create property-files bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('property-files', 'property-files', true);

-- Storage RLS policy
CREATE POLICY "Users can manage their own files" ON storage.objects
  FOR ALL USING (auth.uid()::text = (storage.foldername(name))[1]);
```

### Google Maps APIs Required
- **Maps JavaScript API** (for map display)
- **Places API** (for autocomplete search)
- **Geocoding API** (for reverse geocoding)

Enable these APIs in Google Cloud Console and add billing.

### Build Error Resolution
During development, we resolved these critical build issues:

1. **Unused Variables**: Removed all unused state variables and imports in `

### 🔒 Security Features
- **Signed URL Access**: Files are accessed through secure, time-limited signed URLs (1-hour expiry)
- **Private Storage**: All files stored in private Supabase storage buckets
- **Authenticated Access**: Only authenticated users can access files
- **Smart Inline Viewing:**
  - **Created `openFileInline()` function**: Smart file opening based on file extension
    - **PDFs**: Opens in embedded iframe viewer in new window with download button header
    - **Images**: Direct browser display (JPG, PNG, GIF, WebP, SVG)
    - **Office Documents**: Uses Google Docs Viewer for DOC, DOCX, XLS, XLSX, PPT, PPTX with download button header
    - **CSV Files**: Parses and displays as formatted table with sticky headers, hover effects, and download button
    - **Text Files**: Displays with monospace font, proper formatting, and download button header
    - **Fallback**: Direct URL opening for other file types
  - **Enhanced Document Viewers**: All document viewers now include:
    - **Header bar** with filename and download button
    - **Professional styling** with consistent design across all file types
    - **Download functionality** - users can download files directly from the viewer
    - **Responsive design** that works well on all screen sizes
  - **CSV Table Features**:
    - **Proper table formatting** with headers, borders, and alternating row colors
    - **Sticky header** that stays visible when scrolling through large datasets
    - **Hover effects** for better row identification
    - **Professional styling** similar to Excel or Google Sheets
    - **Handles quoted CSV values** by removing quotes for clean display
  - **Updated all file opening handlers**: Replaced direct `window.open()` calls with `openFileInline()` function
  - **Fixed async handling**: Properly awaited the async function calls in onClick handlers
  - **Enhanced documentation**: Updated README with detailed explanation of smart viewing features
- **Download Option**: Users can choose to download files when needed via the file menu
- **Error Handling**: Graceful error handling for failed file access attempts