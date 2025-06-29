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

### **Latest Update: Satellite Image Repositioning**
- **Improved Layout Hierarchy**: Satellite image now appears immediately after the property address header
- **Better Visual Flow**: Property title → Satellite image → Navigation (breadcrumbs, search, upload) → File list
- **Enhanced User Experience**: Satellite imagery is prominently featured while maintaining all navigation functionality
- **Maintained Sticky Behavior**: Search bar, upload section, and column headers remain sticky for optimal file browsing

### **Sticky Scroll Behavior**
- **Sticky Search Bar**: Remains at top during scrolling for constant access
- **Sticky Upload Section**: Always visible below search bar for easy file uploads
- **Sticky Column Headers**: File list headers remain visible during long file lists
- **Optimized Z-Index Layering**: Proper stacking order for all sticky elements

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

## 🤝 Contributing

This is a private project, but the codebase follows modern React and TypeScript best practices. Key areas for future development include mobile optimization, performance enhancements, and additional file management features.

---

**Built with ❤️ for real estate professionals who need better document organization tools.**

## 🎯 Latest Update: Satellite Image Repositioning

**Change Made**: Moved the satellite image to appear immediately after the property address header in the PropertyDetailsModal.

**New Layout Order**: 
1. Property Address Header
2. Satellite Image (prominently displayed)
3. Breadcrumb Navigation  
4. Search Bar (sticky)
5. Upload Section (sticky)
6. File List with sticky column headers

**Benefits**:
- **Better Visual Hierarchy**: Satellite imagery is now prominently featured right after the property title
- **Improved User Flow**: Users see the property image immediately, then access navigation tools
- **Maintained Functionality**: All sticky behaviors and navigation elements work exactly as before
- **Enhanced UX**: Satellite image provides immediate visual context for the property

This change addresses the user request to prioritize the satellite image visibility while keeping all important navigation elements (breadcrumbs, search, upload) easily accessible.


