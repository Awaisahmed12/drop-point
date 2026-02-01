## Product Requirements

### Objective

Enable solo real estate professionals to organize property documents by location, with fast property selection on a map and a streamlined, mobile-first file management workflow.

### Target users

- Solo realtors and brokers
- Property managers and inspectors

### Key user flows

1. Authenticate and land on the map.
2. Select or create a property by dropping a pin.
3. Upload and organize files within that property.
4. Search, view, download, rename, or move files and folders.

### Core requirements

- Map-based property selection using pin-only interaction.
- Property details modal with file and folder management.
- File uploads with progress feedback and error handling.
- Folders-first sorting and a clear hierarchy with breadcrumbs.
- Grid and list views with persistent user preference.
- Search within a property for file or folder names.
- Responsive UI for desktop and mobile.

### Authentication and security

- Supabase authentication with email and password.
- Enforced row-level security for properties, folders, and files.
- Private storage with signed URLs for file access.

### Out of scope for MVP

- Team sharing and collaboration.
- Billing and subscriptions.
- AI-assisted tagging or OCR.
- Offline-first data sync.

### Success criteria

- Time-to-first upload is short and reliable.
- Property switching and file browsing feel instant.
- Mobile UI matches desktop capabilities for critical workflows.
