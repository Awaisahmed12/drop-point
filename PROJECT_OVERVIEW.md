# DropPoint Project Overview

## Project Vision & Goals
DropPoint is a secure, map-based document storage web app for real estate professionals. Users can search and select properties, upload and manage files per property, and organize their data with tags and views. The platform is private by default, with robust sharing options for individuals, teams, and public links, supporting both personal and enterprise use cases.

## Core Principles
- **Privacy First:** All properties and files are private by default. Only the owner can access unless explicitly shared.
- **Granular Sharing:**
  - **Public Link:** Owners can make properties/files accessible via a public link (like Google Drive's "Anyone with the link").
  - **Email-based Sharing:** Owners can share with specific users by email/account. Only those users can access.
  - **Teams/Enterprise:** (Future) Users can be part of teams, and properties/files can be shared with all team members.
- **Flexible Organization:**
  - Users can tag properties for different map/list views (e.g., "restaurants", "residential").
  - Views are user-specific, but can be shared (e.g., a "team map").
- **Exporting:** Users can export/download all their documents/properties, with reasonable size limits.

## MVP Feature List
- [x] Supabase client and authentication (sign up/login)
- [x] Modern, mobile-first UI with live password feedback, password visibility toggles, and error/success messages
- [x] Full-viewport map page with floating search bar (Google Places Autocomplete)
- [x] Center map on user's location, fallback to US center, and provide a search bar
- [x] Toggle map type (satellite/roadmap) with persistence via localStorage
- [x] LandGlide-style crosshair cursor at map center
- [x] Reverse geocode the center and show a modern, glassmorphic address popup card
- [x] Check for duplicate properties before inserting into Supabase
- [x] Property details modal with address, label, notes, and file management
- [x] File uploads and property file management using Supabase Storage
- [ ] Sharing: public link, email-based, and (future) teams
- [ ] Tagging and multiple map/list views
- [ ] Export/download functionality
- [ ] "My Properties" dashboard for users to view/manage their saved properties and files

## Data Model & Security

### **properties**
| Column         | Type         | Description/Notes                                 |
|---------------|--------------|---------------------------------------------------|
| id            | uuid         | Primary key, unique property ID                   |
| user_id       | uuid         | Owner, FK to auth.users.id                        |
| address       | text         | Property address                                  |
| lat           | float8       | Latitude                                          |
| lng           | float8       | Longitude                                         |
| label         | text         | Optional label                                    |
| notes         | text         | Optional notes                                    |
| thumbnail_url | text         | Optional property image                           |
| is_public     | bool         | Public sharing flag, default false                |
| tags          | text[]       | Array of tags for map/list views                  |
| team_id       | uuid         | Nullable, FK to teams.id                          |
| updated_at    | timestamp    | Last update timestamp                             |
| created_at    | timestamp    | Creation timestamp                                |
| shared_with   | text[]       | Array of user emails/IDs for sharing              |

### **property_files**
| Column         | Type         | Description/Notes                                 |
|---------------|--------------|---------------------------------------------------|
| id            | uuid         | Primary key, unique file ID                       |
| property_id   | uuid         | FK to properties.id                               |
| file_name     | text         | Name of the file                                  |
| file_url      | text         | URL to the file in storage                        |
| uploaded_at   | timestamptz  | Upload timestamp                                  |
| user_id       | uuid         | Owner, FK to auth.users.id                        |
| file_type     | text         | MIME type                                         |
| file_size     | int4         | File size in bytes                                |
| is_public     | bool         | Public sharing flag, default false                |
| shared_with   | text[]       | Array of user emails/IDs for sharing              |
| created_at    | timestamp    | Creation timestamp                                |

### **teams**
| Column         | Type         | Description/Notes                                 |
|---------------|--------------|---------------------------------------------------|
| id            | uuid         | Primary key, unique team ID                       |
| created_at    | timestamptz  | Creation timestamp                                |
| name          | text         | Team name                                         |
| owner_id      | uuid         | FK to auth.users.id                               |
| members       | uuid[]       | Array of user IDs                                 |

**Foreign Keys:**
- `properties.user_id` → `auth.users.id`
- `properties.team_id` → `teams.id`
- `property_files.user_id` → `auth.users.id`
- `property_files.property_id` → `properties.id`
- `teams.owner_id` → `auth.users.id`

**Security:**
- Row Level Security (RLS) ensures only owners, shared users, or team members can access data.
- Public access is only allowed if `is_public` is true.
- Storage bucket policies mirror database RLS for file access.

## Sharing & Collaboration Logic
- **Private by Default:** Only owner can access.
- **Public:** If `is_public` is true, anyone with the link can access.
- **Shared with Users:** If a user's email/ID is in `shared_with`, they can access.
- **Teams:** If `team_id` is set, all team members can access.
- **Sync/Add:** Shared users can add properties/files to their own map/view, either as a reference (collaborative) or as a copy (with sync limitations).

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