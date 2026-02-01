## Overview

DropPoint is a map-based document management platform for real estate professionals. Properties are selected on an interactive map, and each property serves as a parent folder for documents, images, and notes. The product is optimized for fast access, clear organization, and mobile-first workflows.

## Vision

Make property documents accessible anywhere, anytime, with an interface that feels familiar to real estate professionals and consistent across devices.

## Core principles

- Privacy-first: properties and files are private by default, with explicit sharing only.
- Property-centric organization: files and folders are organized by property location.
- Fast, simple workflows: reduce steps for upload, retrieval, and organization.
- Consistent UX: map interaction and file management patterns feel predictable and professional.

## Current experience

- Pin-only map interaction: users drop pins to add properties and select existing pins to open property details.
- Property details modal: manage folders, files, and uploads without leaving the map context.
- File management: folders-first sorting, grid and list views, search within a property, and drag-and-drop uploads.
- Mobile-first UI: touch-friendly targets, clear spacing, and performance-oriented rendering.

## Architecture snapshot

- Frontend: Next.js (Pages Router) + React + TypeScript + Tailwind CSS.
- Backend: Supabase (PostgreSQL, Auth, Storage).
- Maps: Google Maps JavaScript API and Places API.

## Non-goals for MVP

- Team collaboration and role-based sharing.
- Advanced automation or AI-driven organization.
- Offline-first support.

These are tracked in product requirements and roadmap sections in `docs/product-requirements.md`.
