# DropPoint - Real Estate Document Management

DropPoint is a sophisticated real estate document management application that combines interactive map-based property selection with comprehensive file organization capabilities. Built with Next.js, TypeScript, and Supabase, it provides real estate professionals with an intuitive platform for managing property-related documents and files.

## 🎯 What We're Building

**Vision**: A LandGlide-inspired app that transforms how real estate professionals organize and access property documents by combining satellite imagery, interactive maps, and intelligent file management.

**Core Concept**: Select any property on a map → Save it to your portfolio → Upload and organize unlimited files for that property → Access everything from anywhere.

## ✨ Key Features

### 🗺️ **Interactive Map System**
- **LandGlide-style crosshair cursor** for precise property selection
- **Dual map modes**: Satellite and roadmap views with toggle
- **Smart address detection** using reverse geocoding
- **User geolocation** with fallback to US center
- **Property caching** for instant access to previously viewed locations

### 🏠 **Property Management**
- **One-click property saving** from map coordinates
- **Duplicate prevention** - won't save the same property twice
- **Property portfolio** - all saved properties accessible from dashboard
- **Address validation** and coordinate snapping for accuracy

### 📁 **Advanced File Management**
- **Drag-and-drop uploads** with real-time progress tracking
- **Hierarchical folder system** with unlimited nesting
- **File type support** for 30+ formats (PDF, images, documents, etc.)
- **Smart file organization** with search and filtering
- **Batch operations** - upload multiple files simultaneously
- **File preview and download** capabilities

### 🎨 **Modern UI/UX**
- **Glassmorphic design** with backdrop blur effects
- **Responsive layout** optimized for desktop and mobile
- **Smooth animations** and micro-interactions
- **Loading states** with skeleton animations
- **Sticky navigation** - search bar, upload section, and column headers remain accessible during scrolling
- **Satellite image positioning** - prominently displayed after property title, with all navigation elements following below

### 🔒 **Security & Performance**
- **Row Level Security (RLS)** in Supabase
- **File access control** with signed URLs
- **Real-time progress tracking** for uploads
- **Caching system** for optimal performance
- **Error handling** with retry mechanisms

## 🏗️ Architecture

### **Frontend** (Next.js + TypeScript)
- **Pages Router** architecture
- **Component-based** design with reusable UI elements
- **TypeScript** for type safety and better developer experience
- **TailwindCSS** for utility-first styling

### **Backend** (Supabase)
- **PostgreSQL database** with optimized schema
- **Storage bucket** for secure file hosting
- **Authentication system** with email/password
- **Real-time subscriptions** for live updates
- **Row Level Security** for data protection

### **External APIs**
- **Google Maps JavaScript API** for interactive mapping
- **Google Places API** for address autocomplete and geocoding
- **Static Maps API** for satellite imagery

## 📊 Database Schema

### **Properties Table**
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to auth.users)
- address (TEXT, not null)
- lat (DECIMAL, not null)
- lng (DECIMAL, not null)
- label (TEXT, optional)
- notes (TEXT, optional)
- created_at (TIMESTAMP)
```

### **Property Files Table**
```sql
- id (UUID, primary key)
- property_id (UUID, foreign key to properties)
- user_id (UUID, foreign key to auth.users)
- folder_id (UUID, foreign key to property_folders, nullable)
- file_name (TEXT, not null)
- file_url (TEXT, not null)
- file_type (TEXT)
- file_size (BIGINT)
- uploaded_at (TIMESTAMP)
- modified_at (TIMESTAMP)
```

### **Property Folders Table**
```sql
- id (UUID, primary key)
- property_id (UUID, foreign key to properties)
- user_id (UUID, foreign key to auth.users)
- parent_id (UUID, foreign key to property_folders, nullable)
- name (TEXT, not null)
- created_at (TIMESTAMP)
- deleted_at (TIMESTAMP, nullable for soft delete)
```

## 🚀 Recent Enhancements

### **Latest Update: Modal Layout Optimization & Satellite Image Repositioning**
- **Improved Visual Hierarchy**: Completely restructured the PropertyDetailsModal layout to follow a more logical flow:
  - Property title header (always visible)
  - Satellite image (scrolls away when browsing files)
  - Breadcrumb navigation (sticky within scroll area)
  - Search bar (sticky within scroll area) 
  - Upload progress section (sticky within scroll area)
  - Column headers (sticky within scroll area)
  - File and folder listing (scrollable content)

- **Enhanced Sticky Behavior**: All navigation elements (breadcrumbs, search, upload status, column headers) now stick properly to the top of the scrollable area after the satellite image scrolls away, providing consistent access to key functionality while browsing through long file lists

- **Better User Experience**: 
  - Satellite imagery is prominently displayed at the top of the modal content
  - Navigation elements remain accessible without blocking content
  - Smooth scroll behavior with proper z-index layering
  - Maintains mobile-responsive design across all breakpoints

- **Technical Implementation**: 
  - Moved satellite image, breadcrumbs, and search bar into the scrollable container
  - Applied sticky positioning (`sticky top-0`, `sticky top-12`, etc.) within the scroll context
  - Dynamic sticky positioning based on upload status visibility
  - Proper background colors and borders for sticky elements

### **Advanced Sticky Scroll System**
- **Sticky Search Bar**: Remains at top of scroll area (after image scrolls away) for constant access
- **Sticky Upload Section**: Always visible below search bar during active uploads
- **Sticky Column Headers**: File list headers remain visible during long file lists with dynamic positioning
- **Intelligent Z-Index Management**: Proper layering ensures all sticky elements stack correctly

### **Advanced Upload System**
- **Real-time Progress Tracking**: Visual progress bars for each upload
- **Upload Cancellation**: Ability to cancel uploads in progress
- **Retry Mechanism**: Automatic retry for failed uploads
- **Batch Processing**: Handle multiple file uploads simultaneously
- **Smart Filename Handling**: Automatic conflict resolution and sanitization

### **File Management Improvements**
- **Enhanced File Icons**: Google Drive-inspired color coding by file type
- **Improved Search**: Global search across all files and folders
- **Better Organization**: Hierarchical folder system with breadcrumb navigation
- **Mobile Optimization**: Touch-friendly interface for mobile devices

## 🎨 Design System

### **Color Palette**
- **Primary Blue**: `#2563eb` - Used for accents, buttons, and interactive elements
- **Success Green**: `#10b981` - Upload success states and confirmations
- **Error Red**: `#ef4444` - Error states and destructive actions
- **Neutral Grays**: Various shades for text, borders, and backgrounds

### **Typography**
- **Headers**: `font-extrabold` for property addresses and main titles
- **Body Text**: `font-medium` for file names and important information
- **Secondary Text**: `font-normal` for dates, sizes, and metadata

### **Layout Principles**
- **Glassmorphism**: Backdrop blur effects with semi-transparent backgrounds
- **Rounded Corners**: `rounded-3xl` for modals, `rounded-xl` for cards
- **Consistent Spacing**: Tailwind spacing scale for predictable layouts
- **Responsive Design**: Mobile-first approach with breakpoint optimization

## 🔧 Technical Decisions

### **Why Next.js Pages Router?**
- Simpler routing for this application's scope
- Better compatibility with Google Maps integration
- Easier deployment and configuration

### **Why Supabase?**
- Built-in authentication and database
- Real-time capabilities for future enhancements
- Excellent TypeScript support
- Generous free tier for development

### **Why Google Maps?**
- Industry standard for real estate applications
- Comprehensive geocoding and reverse geocoding
- High-quality satellite imagery
- Familiar user interface

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ and npm
- Supabase account and project
- Google Cloud Platform account with Maps API enabled

### **Environment Variables**
Create a `.env.local` file with:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### **Installation**
```bash
npm install
npm run dev
```

### **Database Setup**
1. Create tables using the schema provided above
2. Enable Row Level Security (RLS) on all tables
3. Create storage bucket named 'property-files'
4. Set up authentication policies

## 📈 Performance Optimizations

- **Address Caching**: Reduces API calls for frequently accessed locations
- **Property Data Prefetching**: Loads property data before modal opens
- **Lazy Loading**: Components and images load on demand
- **Optimized Re-rendering**: Efficient React state management
- **Compressed Assets**: Next.js automatic optimization

## 🔮 Future Enhancements

- **Property Notes**: Rich text editing for property descriptions
- **File Sharing**: Share specific files or folders with other users
- **Advanced Search**: Full-text search across file contents
- **Mobile App**: React Native version for iOS/Android
- **Integration APIs**: Connect with MLS systems and other real estate tools
- **Bulk Operations**: Mass file operations and property imports
- **Pending Upload UX Improvements**: 
  - **Scrollable Upload Section**: Make pending uploads (including failures) scroll away instead of staying sticky
  - **Compact Upload States**: Minimize visual interference when uploads are in progress or failed
  - **Upload History**: Option to view/dismiss completed uploads without them blocking file browsing
- **Authentication Flow Improvements**: 
  - **Smart Routing**: Redirect signed-in users from localhost to /map automatically (dashboard/home page)
  - **Sign-in Guard**: Redirect unsigned users to sign-in page from any protected route
  - **Account Management Page**: Full user account page with sign-out, storage usage, account switching
  - **Route Protection**: Fix /map route to properly handle authentication state
  - **Consistent Auth Flow**: Ensure all routes respect authentication status consistently

## 🤝 Contributing

This is a private project, but the codebase follows modern React and TypeScript best practices. Key areas for future development include mobile optimization, performance enhancements, and additional file management features.

---

**Built with ❤️ for real estate professionals who need better document organization tools.**

## 🎯 Latest Update: Scrolling Satellite Image Behavior

**Change Made**: Implemented scrolling satellite image that moves away when users browse files, while keeping all navigation elements sticky.

**New Scrolling Behavior**: 
- **Satellite Image**: Now scrolls away naturally when browsing files, maximizing file viewing space
- **Sticky Navigation**: Breadcrumbs, search bar, and column headers remain visible at all times
- **Optimal File Browsing**: Users get full screen space for files when needed, but satellite image returns when scrolling to top

**Layout Structure**: 
1. Property Address Header (fixed)
2. Scrollable Area:
   - Satellite Image (scrolls away)
   - Sticky Breadcrumb Navigation 
   - Sticky Search Bar
   - Sticky Upload Section (when active)
   - File List with sticky column headers

**Benefits**:
- **Maximum File Browsing Space**: Satellite image scrolls away to give full space for document management
- **Always-Accessible Navigation**: Search, breadcrumbs, and headers always visible for efficient navigation
- **Smart Visual Context**: Satellite image visible when at top, hidden when focusing on files
- **Improved Workflow**: Users can see property context initially, then focus entirely on file management

This addresses the user request for the satellite image to scroll away during file browsing while maintaining all essential navigation functionality.

**Latest Fix: Universal Scroll Behavior**
- **Fixed Nested Scroll Issue**: Removed nested scroll containers that prevented satellite image from scrolling when mouse was over files area
- **Unified Scroll Experience**: Now the satellite image scrolls away regardless of where the user's cursor is positioned when they begin scrolling
- **Natural User Interaction**: Users can start scrolling from anywhere in the files area and the satellite image will respond correctly
- **Consistent Behavior**: Scrolling works identically whether mouse is over satellite image, files, folders, or any part of the modal content

**Latest Fix: Clean Sticky Positioning**
- **Eliminated Overlap Issues**: Removed sticky behavior from breadcrumbs, search bar, and upload section to prevent overlap with column headers
- **Simplified Sticky Logic**: Only column headers remain sticky for optimal file browsing experience
- **Clean Scrolling Flow**: Satellite image → Breadcrumbs → Search bar all scroll away together, leaving only column headers visible
- **Focused File Management**: Once scrolled, users get maximum space for file browsing with essential column headers always visible
- **No More Visual Conflicts**: Eliminated jarring overlap behavior where navigation elements would cover column headers


