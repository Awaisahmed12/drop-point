# 🧾 DropPoint – Product Requirements Document (PRD)

## 📌 1. Overview

**Product Name:** DropPoint  
**Version:** MVP 1.0  
**Owner:** Awais Ahmed  
**Status:** In Development  
**Goal:** Build a web app that allows solo real estate professionals to store and manage documents per property via a map interface.

## 🎯 2. Objective

Enable users to:
- Log in using email/password or third-party providers (e.g., Google, Apple)
- Recover accounts using phone number verification
- Search/select properties on a map
- Upload/view/manage files tied to each property
- See previous uploads per property
- Download files as needed

## 👤 3. Target Users
- Solo realtors
- Property managers
- Brokers handling multiple properties

**Pain Points:**
- Scattered files (email, phone, Dropbox)
- Hard to remember which document is for which property
- Lack of organization tied to physical location

## 🧩 4. Key Features
| Feature                | Description                        | Priority |
|------------------------|------------------------------------|----------|
| Email + Password Auth  | Secure email-based login           | ✅ High  |
| Third-Party Auth       | Google/Apple login support         | ✅ High  |
| Phone Recovery         | Phone number used only for account recovery | ✅ High  |
| Property Map           | Google Maps view to find properties| ✅ High  |
| Map Mode Toggle        | Switch between Glider and Pin view, remembers last used | ✅ High  |
| Glider View            | Crosshair-centered map, lock location | ✅ High  |
| Pin View               | Click map to drop pin and name property | ✅ High  |
| Upload Files           | Upload PDFs/images tied to property| ✅ High  |
| File Viewer            | List + preview of uploaded files   | ✅ High  |
| Settings Page          | See total storage used, logout     | 🟡 Medium|
| Search/Filter          | Search properties or file names    | 🟡 Medium|
| Empty State UX         | Friendly onboarding when no files exist | 🟢 Low |
| Drag & Drop            | Optional UX for power users        | 🟢 Low   |

## 🧭 4.5 Map Modes
**DropPoint offers two powerful, toggle-able map modes:**

- **Glider View:** For precise, mobile-friendly property selection using a fixed crosshair.
- **Pin View:** For visual management of many properties, allowing users to drop and select pins directly on the map.

**Map Mode Toggle:**
- Users can switch between Glider View and Pin View at any time using a toggle in the top-right corner of the map, similar to the Map/Satellite toggle in Google Maps.
- The app remembers the last used mode and defaults to it on the next visit.

| Mode         | Description                                 | UX Behavior                                      | Use Case                        |
|--------------|---------------------------------------------|--------------------------------------------------|----------------------------------|
| 🪂 Glider View | Movable map with fixed center crosshair     | - Fixed crosshair in center<br>- "Lock this location" button | Ideal for mobile and parcel-level precision |
| 📍 Pin View    | Users click to drop pins and view existing pins | - Tap map to drop pin<br>- Tap pin to open property modal | Ideal for managing many properties visually |

**Toggle Placement:** Top-right corner of the map, like Google Maps (Map/Satellite toggle).

## 🖼️ 5. Wireframes / Screens
- Home / Map view (Glider + Pin toggle)
- Property click → modal with file uploads
- Upload screen
- File list per property
- Login: Email/Password, Google/Apple, phone for recovery

## 🔄 6. User Flow
1. Login (email/password or third-party)
2. Set up phone recovery (if first-time user)
3. Enter map
4. Choose map mode (default Glider or last-used)
5. Add property → upload files → view/download later

## 🗂️ 7. Data Model (Simplified)
- **User:** id, email, password_hash, phone, name
- **Property:** id, address, lat/lng, user_id (FK)
- **File:** id, file_url, file_type, property_id (FK), upload_date

## 📶 8. Tech Stack
- **Frontend:** Next.js (pages), TailwindCSS
- **Auth:** Firebase Auth (email/password, Google, Apple)
- **Recovery:** Firebase phone verification for recovery
- **Storage:** Supabase or Firebase with file metadata in Postgres
- **Map:** Google Maps API

## ⚠️ 9. Known Constraints
- File size limit: 20MB/file
- No social/team sharing in MVP
- AI/montage features deferred

## 📅 10. Timeline
| Phase   | Tasks                        | Deadline      |
|---------|------------------------------|--------------|
| Week 1  | Login, DB Schema, Map Setup  | ✅ Done       |
| Week 2  | File Upload Modal, List View | 🟡 In Progress|
| Week 3  | User Settings + Bug Fixes    | 🔜           |
| Week 4  | Polish + Launch MVP          | 🔜           |

## 🔍 11. Future Features
- Team collaboration + permissions
- AI document summarizer (leases, titles)
- Mobile app
- PDF viewer inside app
- File tagging
- Property filters by tag/date/file type 