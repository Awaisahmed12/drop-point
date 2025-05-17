# DropPoint Project Overview

## Project Vision & Goals
DropPoint is a map-based document storage web app for real estate professionals. It allows users to search and select properties, upload and manage files per property, and is limited to 5 properties or 5GB storage. The app aims to provide a modern, mobile-first UI with a premium, app-like feel.

## MVP Feature List
- [x] Set up Supabase client and authentication (sign up/login)
- [x] Implement a modern, mobile-first UI with live password feedback, password visibility toggles, and error/success messages
- [x] Redirect users to a full-viewport map page with a floating search bar (Google Places Autocomplete)
- [x] Center the map on the user's location, fallback to US center, and provide a search bar
- [x] Toggle map type (satellite/roadmap) with persistence via localStorage
- [x] Display a LandGlide-style crosshair cursor at the map center
- [x] Reverse geocode the center and show a modern, glassmorphic address popup card
- [x] Check for duplicate properties before inserting into Supabase
- [x] Display a property details modal with address, label, notes, and a placeholder for files
- [ ] Integrate file uploads and property file management using Supabase Storage
- [ ] Build a "My Properties" dashboard for users to view/manage their saved properties and files

## Completed Steps
1. Set up Supabase client and authentication (sign up/login)
2. Implemented a modern, mobile-first UI with live password feedback, password visibility toggles, and error/success messages
3. Redirected users to a full-viewport map page with a floating search bar (Google Places Autocomplete)
4. Centered the map on the user's location, fallback to US center, and provided a search bar
5. Toggled map type (satellite/roadmap) with persistence via localStorage
6. Displayed a LandGlide-style crosshair cursor at the map center
7. Reverse geocoded the center and showed a modern, glassmorphic address popup card
8. Checked for duplicate properties before inserting into Supabase
9. Displayed a property details modal with address, label, notes, and a placeholder for files

## Next Steps / Roadmap
- Integrate file uploads and property file management using Supabase Storage
- Build a "My Properties" dashboard for users to view/manage their saved properties and files

## Design/UX Principles
- Modern, mobile-first UI
- Glassmorphism, bold typography, blue accents, large rounded corners, soft shadows, and smooth animations
- Premium, app-like feel inspired by top mobile apps like Robinhood and Dub

## Tech Stack & Key Decisions
- **Frontend:** Next.js (pages router), TypeScript, TailwindCSS
- **Backend:** Supabase (auth, database, storage)
- **Maps:** Google Maps API
- **Authentication:** Supabase Auth
- **Database:** Supabase Database
- **Storage:** Supabase Storage

## How to Use This File
This file is designed to be easily understood by AI assistants and humans. It outlines the project vision, goals, completed steps, next steps, design principles, and tech stack. It will be updated as the project evolves to ensure that new goals, accomplishments, and design preferences are always up to date.

## Future Collaboration & Property Sharing (Vision)

As DropPoint grows, we plan to support collaborative workflows where multiple users or teams can share access to the same property. This will involve:
- Global property records (unique by address/lat/lng)
- A join table (e.g., `property_users`) to manage user access and roles
- Shared file storage per property, with permissions enforced via RLS
- Detecting when a user tries to save a property already saved by another user, and offering to join/share instead of duplicating

This approach will enable true team collaboration, shared file management, and more advanced permission models. It is a complex scenario and will require careful planning of data models and security policies.

## Property Specificity (Suites, Units, etc.)

To support more granular property management (e.g., 123 Main Street, Suite #220 vs. Suite #345), DropPoint will:
- Allow users to specify unit/suite numbers or sub-address details
- Treat properties with the same base address but different units as distinct records
- Optionally, relate or group these sub-properties for better organization

This ensures users can manage documents for specific units within a building, reflecting real-world real estate needs.

## 2024 Update: Property Saving, Location Accuracy, and Modal UX

- Properties now store both the user's original map center (`user_selected_lat`, `user_selected_lng`) and the snapped address coordinates (`lat`, `lng`) from Google Maps.
- The property modal features a hoverable + button for saving, with floating feedback messages for success/failure.
- The modal is closed by clicking outside of it, and properties are only saved on explicit user action.
- The property table schema now includes:
  - `address`: Formatted address
  - `lat`, `lng`: Snapped address coordinates
  - `user_selected_lat`, `user_selected_lng`: User's original selection
- This approach ensures consistency, accuracy, and future extensibility (e.g., supporting custom boundaries or polygons). 