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

### **Latest Update: Comprehensive Mobile UI & Search Bar Fixes**
- **Search Bar Disappearing Issue Resolved**: Fixed z-index conflicts that caused the search bar to disappear behind other elements:
  - **Proper Z-Index Hierarchy**: Navigation (z-50), Upload Progress (z-40), Column Headers (z-30)
  - **Consistent Sticky Positioning**: All sticky elements now properly stack without conflicts
  - **Mobile-Optimized Layering**: Search bar always visible and accessible on mobile devices

- **Enhanced Mobile Viewport Handling**: Comprehensive improvements to prevent UI elements from being hidden by mobile browser bars:
  - **Improved Modal Height Calculation**: Better logic for mobile viewport with 40px browser chrome buffer
  - **Dynamic Positioning**: Sticky elements adjust their position based on navigation and upload section heights
  - **Safe Area Insets**: Proper handling of device notches and dynamic islands
  - **Action Button Optimization**: Bottom buttons now properly account for mobile safe areas

- **Mobile UX Improvements**: 
  - **Touch Target Optimization**: Minimum 44px touch targets for better mobile interaction
  - **Smooth Scrolling**: Enhanced scroll behavior on mobile devices
  - **Input Zoom Prevention**: 16px font size prevents unwanted zoom on input focus
  - **Better Responsive Design**: Improved spacing and sizing for mobile interfaces

### **Previous Update: Mobile Loading Race Condition Fix**
- **Critical Mobile Bug Resolution**: Fixed a race condition that prevented files from loading on mobile devices on first property open:
  - **Root Cause**: Two competing `useEffect` hooks were both trying to fetch property data simultaneously
  - **Mobile Impact**: Different timing on mobile browsers caused the second hook to overwrite data and never clear loading states
  - **Solution**: Removed duplicate folder fetching logic since `fetchFiles()` already handles both files and folders
  - **Result**: Mobile users now see property files immediately on first open, matching desktop behavior

### **Previous Update: Mobile Viewport Optimization & Browser Bar Handling**
- **Dynamic Viewport Height Detection**: Implemented advanced mobile browser bar handling to prevent UI elements from being hidden:
  - **Visual Viewport API Integration**: Uses modern browser APIs to detect real-time viewport changes
  - **Dynamic Height Calculation**: Modal heights automatically adjust when mobile browser bars appear/disappear
  - **Fallback Support**: Graceful degradation for older browsers using CSS viewport units (dvh)
  - **Safe Area Insets**: Proper handling of device notches and dynamic islands on modern smartphones

- **Enhanced Mobile File Viewer**: Mobile file preview overlay now properly handles viewport changes:
  - **Full-Screen Optimization**: Takes advantage of entire available screen space
  - **Browser Chrome Awareness**: Content automatically adjusts when address bars hide/show
  - **Touch-Optimized Interface**: Larger touch targets and better spacing for mobile interaction

- **CSS Viewport Unit Support**: Added comprehensive CSS support for modern viewport handling:
  - **Dynamic Viewport Heights (dvh)**: Uses latest CSS viewport units for better mobile support
  - **Safe Area CSS**: Proper padding for devices with notches, dynamic islands, and rounded corners
  - **Input Zoom Prevention**: Prevents unwanted zoom on mobile form inputs
  - **Overscroll Behavior**: Optimized scrolling behavior to prevent bounce effects on iOS

### **Previous Update: Navigation Section Optimization & Dynamic Layout**
- **Eliminated Empty Gaps**: Optimized the navigation section to conditionally render breadcrumbs only when needed:
  - **At root folder**: Clean, minimal search bar without unnecessary spacing
  - **In nested folders**: Full breadcrumb navigation with back/home buttons
  - **Dynamic sticky positioning**: All elements (upload section, column headers) automatically adjust their position based on navigation height

- **Enhanced Sticky Behavior**: All navigation elements (breadcrumbs, search, upload status, column headers) now stick properly to the top of the scrollable area while maintaining perfect alignment
  - **Column Header Transparency Fixed**: Resolved z-index and margin issues that caused the "Size" column to appear see-through
  - **Consistent Background Coverage**: All sticky elements now have solid white backgrounds with no content bleeding through

### **Mobile-First File Opening System**
- **Pop-up Blocker Solution**: Completely eliminated mobile pop-up dependencies:
  - **In-App File Viewer**: Custom mobile overlay for images, PDFs, text, and CSV files
  - **Context Preservation**: Users never leave the app, maintaining their exact location in the file system
  - **Professional Interface**: Full-screen file viewer with download and close actions
  - **Responsive Design**: Adapts perfectly to different screen sizes and orientations

- **Dual Behavior System**: Smart detection provides optimal experience for each platform:
  - **Mobile**: Custom in-app viewers with touch-optimized controls
  - **Desktop**: Traditional pop-up windows with embedded viewers and download options
  - **Universal Fallbacks**: Graceful degradation for unsupported file types

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

## 🛣️ Roadmap & Future Enhancements

### **Immediate Priority**
- **Instant Loading with Smart Caching**: Implement optimistic UI updates where properties open instantly with cached data, then seamlessly update with any new changes from the server
  - Show cached content immediately while fetching updates in background
  - Highlight any new/changed files with subtle animations
  - Provide ultra-fast user experience while maintaining data accuracy

### **Upcoming Features**
- **Property Notes**: Rich text editing for property descriptions
- **File Sharing**: Share specific files or folders with other users
- **Advanced Search**: Full-text search across file contents
- **Mobile App**: React Native version for iOS/Android
- **Integration APIs**: Connect with MLS systems and other real estate tools
- **Bulk Operations**: Mass file operations and property imports

### **Technical Improvements**
- **Fix Supabase Rename Errors**: Improve error handling and retry logic for file/folder rename operations that fail at the database level
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


