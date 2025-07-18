# DropPoint - Real Estate Document Management

DropPoint is a map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere.

## 🚀 Current Features

### **Interactive Map System**
- LandGlide-style crosshair cursor for precise property selection
- Satellite and roadmap views with toggle
- Smart address detection using reverse geocoding
- User geolocation with fallback to US center
- POI-free experience (no distracting business markers)
- Current location button for instant navigation to user's position

### **Property Management**
- One-click property saving from map coordinates
- **Auto-save on Upload**: Properties are automatically saved when users upload their first file (no manual save required)
- Duplicate prevention system
- Property portfolio accessible from dashboard
- Address validation and coordinate snapping
- **Property Switcher**: Quick access dropdown to switch between properties with smart search
- Real-time property switching with instant file/folder loading
- Automatic map repositioning when switching properties
- Smart dropdown UX: shows all properties including current one (marked as "Current")
- Automatic "last accessed" timestamp updates for intelligent property ordering

### **File Management**
- **Seamless Upload Workflow**: Upload files to any property - system auto-saves new properties on first upload
- Drag-and-drop uploads with real-time progress tracking
- Hierarchical folder system with unlimited nesting
- Support for 30+ file formats (PDF, images, documents, etc.)
- Google Drive-style unified file/folder sorting (recency-first default)
- Batch operations and smart file organization
- In-app file viewer for mobile (no pop-up blockers)

### **Mobile-First Design**
- Glassmorphic UI with backdrop blur effects
- Perfect viewport handling with safe area support
- Touch-optimized interface (44px+ touch targets)
- Responsive layout for all screen sizes
- iOS web app optimizations

### **Enhanced User Experience**
- Global cursor pointer rules for all clickable elements
- Smart click handling with overlay-based dropdown controls
- Consistent hover states and interaction feedback
- Seamless property switching without page reloads
- **Social Media Integration**: Rich link previews with DropPoint logo when sharing on Twitter, Facebook, LinkedIn, etc.
- **FIXED**: Critical race condition bug where files disappeared during property switching
- Intuitive property dropdown that shows all properties with proper "Current" marking
- Resolved useEffect conflict that was clearing file state immediately after property switches

## 🏗️ Architecture

**Frontend**: Next.js 14 (Pages Router) + TypeScript + TailwindCSS
**Backend**: Supabase (PostgreSQL + Auth + Storage)
**Maps**: Google Maps JavaScript API + Places API
**Security**: Row Level Security (RLS) with signed URLs

## 📱💻 Mobile & Web UI Architecture

DropPoint is designed with **dual interfaces** - mobile and web - that share core logic while providing optimized experiences for each platform:

### **Shared Logic Layer (SRP Focus)**
- **Business Logic**: Centralized in `utils/` and custom hooks for consistent behavior
- **Data Management**: Unified Supabase client and API calls across both interfaces
- **State Management**: Shared React hooks for property, file, and user state
- **Validation**: Common form validation and error handling logic
- **File Operations**: Unified upload, download, and management functions

### **Platform-Specific UI Components**
- **Mobile Interface**: Touch-optimized components with 44px+ targets, swipe gestures, and mobile-first layouts
- **Web Interface**: Desktop-optimized components with hover states, keyboard shortcuts, and larger information density
- **Responsive Breakpoints**: Seamless transitions between mobile and desktop experiences
- **Conditional Rendering**: Components adapt based on screen size and device capabilities

### **Code Organization for Maintainability**
```
src/
├── components/
│   ├── shared/          # Platform-agnostic components
│   ├── mobile/          # Mobile-specific UI components
│   └── web/             # Web-specific UI components
├── hooks/               # Shared business logic hooks
├── utils/               # Platform-independent utilities
└── styles/              # Responsive CSS with mobile-first approach
```

### **Benefits of This Architecture**
- **DRY Principle**: Business logic written once, used everywhere
- **Single Responsibility**: Each component has a clear, focused purpose
- **Easier Testing**: Shared logic can be unit tested independently
- **Consistent Behavior**: Same functionality across all platforms
- **Faster Development**: New features implemented once, work everywhere
- **Better Maintenance**: Bug fixes and improvements benefit both interfaces

## 📊 Database Schema

```sql
-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  address TEXT NOT NULL,
  lat DECIMAL NOT NULL,
  lng DECIMAL NOT NULL,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Property Files
CREATE TABLE property_files (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  user_id UUID REFERENCES auth.users(id),
  folder_id UUID REFERENCES property_folders(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  modified_at TIMESTAMP DEFAULT NOW()
);

-- Property Folders
CREATE TABLE property_folders (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  user_id UUID REFERENCES auth.users(id),
  parent_id UUID REFERENCES property_folders(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

## 🎨 Design System

**Colors**: Primary blue (#2563eb), success green (#10b981), error red (#ef4444)
**Typography**: Extrabold headers, medium body text, refined spacing
**Effects**: Glassmorphism, soft shadows, smooth animations
**Mobile**: Dynamic viewport units (100dvh), safe area support

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   # Create .env.local with:
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

3. **Database Setup**
   - Configure Supabase project
   - Set up authentication
   - Create storage buckets for property files
   - Apply RLS policies

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## 📁 File Structure

```
src/
├── components/           # React components
│   ├── PropertyDetailsModal.tsx  # Main property file management
│   ├── UserAuthForm.tsx          # Authentication UI
│   ├── MoveModal.tsx            # File/folder moving
│   └── FileIcon.tsx             # File type icons
├── hooks/               # Custom React hooks
│   └── useMobileViewport.ts     # Global mobile optimization
├── pages/               # Next.js pages
│   ├── index.tsx        # Login/signup page
│   ├── map.tsx          # Main application interface
│   └── _app.tsx         # App wrapper
├── utils/               # Utility functions
│   ├── supabaseClient.ts        # Database client
│   └── fileManagement.ts        # File operations
└── constants/           # Configuration
    └── index.ts         # API keys
```

## 🔧 Key Dependencies

- **Next.js 14**: React framework with Pages Router
- **TypeScript**: Type safety and developer experience
- **Tailwind CSS**: Utility-first styling
- **Supabase**: Backend as a Service
- **Google Maps React**: Maps integration
- **React Hooks**: State management

## 📱 Mobile Optimization

- **Perfect Viewport**: Uses `100dvh` and safe areas for flawless mobile rendering
- **Touch-Friendly**: 44px+ touch targets, optimized interactions
- **Input Optimization**: Prevents zoom on iOS, proper keyboard handling
- **Performance**: GPU acceleration, optimized scrolling
- **Progressive Enhancement**: Works across all device sizes

## 🎯 Recent Updates & Features

### **PropertySwitcher Feature ✅ **COMPLETED & INTEGRATED**

**Status**: Fully implemented and integrated into PropertyDetailsModal

The PropertySwitcher allows users to quickly switch between their saved properties directly from the PropertyDetailsModal header. When a property is selected, the system automatically moves the background map, updates the satellite image, and loads the selected property's files and folders.

**Key Features**:
- **Searchable dropdown** with property addresses and file counts
- **Smart sorting** by last accessed date (most recent first)
- **File count display** (e.g., "123 Main St (45 files)")
- **Graceful handling** of properties with no files
- **Mobile-responsive** design with touch-friendly interactions
- **Improved Mobile UX**: Search input only focuses when user explicitly taps it (no auto-keyboard popup)
- **Enhanced Readability**: Darker placeholder text for better visibility
- **Performance optimized** for 20+ properties with virtualization
- **Loading states** and error handling

**Components**:
1. **useUserProperties Hook** (`src/hooks/useUserProperties.ts`) - Fetches user properties with file counts
2. **PropertySwitcher Component** (`src/components/PropertySwitcher.tsx`) - The dropdown UI component
3. **usePropertySwitcher Hook** (`src/hooks/usePropertySwitcher.ts`) - Handles property switching logic
4. **PropertyDetailsModal Integration** - Fully integrated into the modal header

**Location**: The PropertySwitcher appears in the PropertyDetailsModal header, between the property address and the close button, displaying a chevron (▼) dropdown icon.

**Usage**: When you open a PropertyDetailsModal, you'll see the dropdown next to the property address. Click it to see all your saved properties with file counts, search through them, and switch to any property instantly.

### **Key Features Implemented**
- **Interactive Map System**: LandGlide-style crosshair with dual view modes (Glider/Pin)
- **Property Management**: One-click saving with duplicate prevention
- **File Management**: Drag-and-drop uploads with 30+ file format support
- **Hierarchical Folders**: Nested folder structure with breadcrumb navigation
- **Mobile-First Design**: Responsive UI optimized for mobile and desktop
- **Real-time Updates**: Live file operations with progress tracking

### **Current Location Feature**
- **One-tap navigation**: Google Maps-style current location button for instant positioning
- **Smart geolocation**: High-accuracy positioning with intelligent fallback and caching
- **Visual feedback**: Loading spinner and proper error handling for location requests
- **Seamless integration**: Works with existing address detection and property prefetching
- **Permission handling**: Clear error messages for location access issues
- **Precise positioning**: Button calculates exact clearance (220px) above property info card to prevent overlap
- **Responsive design**: Separate positioning for mobile (bottom-right) and desktop (left sidebar) layouts

### **Google Maps-Style Map Controls**
- **Circular toggle button**: Redesigned mobile map controls to match Google Maps UX
- **Smart positioning**: Button positioned on right side, avoids search dropdown interference
- **Layers icon**: Professional layers icon instead of text labels
- **Improved visibility**: Shows when user finishes typing, stays accessible during navigation
- **Enhanced mobile experience**: 44px touch target, proper shadows and hover states

### **Race Condition Fix - PropertyDetailsModal**
- **Fixed mobile race condition**: Property details modal now loads data immediately on first click
- **Eliminated skeleton-only display**: Data fetching moved from useEffect to onSelect handler
- **Improved loading states**: Proper loading state management for cached vs fresh data
- **Enhanced mobile reliability**: Modal opens with data ready, no more second-click requirement

### **Google Drive-Style File Sorting**
- Unified file/folder display in single list
- Recency-first default sorting (most recently modified first)
- Smart date handling (uploaded_at for files, created_at for folders)
- All sort options preserved (name, date, size)

### **Folder Navigation Bug Fixes**
- **Fixed breadcrumb navigation**: Breadcrumbs now properly show when inside folders and allow back navigation
- **Added dedicated back button**: Clear "Back" button with left arrow icon appears when inside any folder for intuitive navigation
- **Corrected home icon behavior**: Home icon now properly navigates to root folder ('master') instead of causing blank state
- **Resolved empty state display**: Fixed issue where clicking home icon would show blank screen with no files/folders
- **Improved folder state management**: Consistent handling of 'master' vs empty string for root folder identification
- **Enhanced navigation reliability**: Back button and breadcrumb path now work correctly in all folder navigation scenarios
- **Smart parent navigation**: Back button intelligently navigates to parent folder or root, with proper fallback logic

### **Column Header Sorting Fix**
- **Fixed Name column sorting**: Removed conflicting useEffect that was preventing Name column from showing sort indicators
- **Consistent sort behavior**: All column headers (Name, Modified, Size) now properly display up/down arrows when clicked
- **Improved default sorting**: Changed initial sort state to 'date' descending (most recent first) to match Google Drive behavior
- **Eliminated sorting glitches**: Name column now toggles sort direction properly without interference from automatic sort field changes

### **Enhanced Desktop Current Location Button**
- **Intuitive positioning**: Moved current location button from left sidebar to right side of screen, positioned after the search bar
- **Better visual hierarchy**: Button now appears as a complement to the search functionality rather than separate map controls
- **Improved accessibility**: Larger button with clear "Current Location" label for better desktop usability
- **Smart layout**: Map type controls remain on left side, current location on right side for balanced interface
- **Contextual placement**: Button positioned where users naturally look after using the search bar for navigation

### **Mobile Map Improvements**
- Clean satellite/map toggle (hidden during search)
- POI-free experience (no distracting business markers)
- Enhanced mobile viewport handling
- Improved touch targets and interactions

### **Upload System Enhancements**
- Streamlined progress indicators
- Real-time upload tracking
- Batch file processing
- Smart error handling with retry

## 🚧 Next Steps

- [ ] Sharing system (public links, email-based sharing)
- [ ] Property tagging and multiple map views
- [ ] Export/download functionality
- [ ] "My Properties" dashboard
- [ ] Advanced search and filtering
- [ ] Collaboration features

---

**DropPoint** - Where properties meet digital organization.