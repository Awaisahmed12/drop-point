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
- **Priority Search**: User's saved properties appear first in search results, even from different locations

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
- **Apple-Inspired Upload Experience**: Toast notifications with micro-interactions that feel lightning-fast
- **Smart Progress Psychology**: Immediate visual feedback with smooth animations and perceived speed optimization
- **Intelligent Error Recovery**: One-tap retry functionality with clear, non-intrusive error messaging
- **Mobile-First Perfection**: Optimized toast positioning and touch targets for mobile and desktop
- Drag-and-drop uploads with real-time progress tracking
- Hierarchical folder system with unlimited nesting
- Support for 30+ file formats (PDF, images, documents, etc.)
- **Document Management Best Practices**: Folders automatically appear at the top of listings (standard industry practice)
- **Smart Search & Navigation**: Search automatically clears when entering folders for proper context management
- **Enhanced Search UX**: Clear button (X) for easy search cancellation without hassle
- **Google Drive-style unified file/folder sorting** with folders-first organization
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

### **Document Management UX Improvements ✅ COMPLETED**

**Status**: Fully implemented with industry-standard document management practices

**Key Improvements**:
- **Folders-First Organization**: Folders now appear at the top of file listings, following standard document management conventions (like Windows Explorer, macOS Finder, Google Drive)
- **Smart Search Context Management**: Search automatically clears when navigating into folders, maintaining proper context and avoiding confusion
- **Enhanced Search UX**: Added clear button (X) that appears when typing, allowing users to easily cancel searches without hassle
- **Comprehensive Search Clearing**: Search clears on all navigation actions - folder entry, breadcrumb navigation, back button, property switching, and modal close
- **Intuitive Navigation Flow**: Users can search globally, then enter folders or switch properties with a clean slate for context-specific browsing
- **Complete Property Switching**: Property selection card now updates to show the correct address when switching properties (previously showed old address)

**Technical Implementation**:
- Modified sorting algorithm to prioritize folders over files while maintaining secondary sort criteria
- Added `setSearchQuery('')` to all folder navigation handlers and property switching callback
- Implemented conditional clear button with proper mobile/desktop sizing
- Enhanced search input with right padding when clear button is visible
- Integrated search clearing into `usePropertySwitcher` hook's `onPropertyDataLoad` callback
- **Property Selection Card Sync**: Added `setAddress(property.address)` to property switching to update the map selection card
- **Complete Map Synchronization**: Property switching now updates map center, pans to new location, and prevents redundant address fetching

### **Google Drive-Style File Sorting**
- Unified file/folder display in single list
- **Folders-first organization** with secondary sorting by user criteria
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

### **Property Switching Synchronization Fix ✅ COMPLETED**

**Status**: Fixed property selection card address synchronization issue

**Problem**: When switching properties using the PropertySwitcher dropdown, the property selection card (blue card at bottom of map) would continue showing the previous property's address, creating confusion about which property was actually selected.

**Solution**: 
- **Property Selection Card Update**: Property switching now updates the selection card to show the correct address
- **Complete Map Synchronization**: Map center updates and pans to the new property location
- **Consistent State Management**: All UI elements (modal, satellite image, selection card, map center) now stay perfectly synchronized
- **Prevents Redundant Fetching**: Updates internal tracking to prevent unnecessary address API calls

**Impact**: Property switching now provides a seamless, consistent experience where all UI elements update together, eliminating confusion about which property is currently selected.

### **Mobile Upload RLS Race Condition Fix ✅ COMPLETED**

**Status**: Fixed mobile-specific Row Level Security errors during file uploads

**Problem**: Users experienced intermittent RLS (Row Level Security) errors when uploading files on mobile devices, particularly when uploading to new properties. This didn't occur on desktop/localhost due to network timing differences.

**Root Cause**: Race condition in property auto-save + file upload flow:
1. User uploads files to unsaved property (no `property_id` yet)
2. System auto-saves property to database to get `property_id`  
3. File uploads immediately start using that `property_id`
4. On mobile networks with higher latency, uploads would start before property was fully propagated in Supabase
5. RLS policies denied file inserts because they couldn't verify the property existed or belonged to the user

**Solution**:
- **Propagation Delay**: Added 500ms wait after property save to ensure database propagation
- **Property Verification**: Added explicit check that property exists and is accessible before starting uploads
- **Retry Logic**: Implemented exponential backoff retry (3 attempts) for database inserts to handle remaining edge cases
- **Better Error Handling**: Enhanced logging and error messages for easier debugging

**Technical Details**:
- Mobile networks typically have 100-300ms higher latency than desktop
- Supabase's real-time propagation can take additional time on slower connections
- RLS policies need consistent view of related data (properties + property_files)

**Impact**: Mobile users now experience reliable file uploads without mysterious permission errors, especially on slower networks.

### **Zoom-Based Property Selection ✅ COMPLETED**

**Status**: Property selection card now only appears at appropriate zoom levels

**Problem**: Users reported the property selection card was annoying - constantly popping up and disappearing as they browsed/swiped around the map at city or neighborhood zoom levels, when they weren't actually trying to select specific properties.

**Solution**: 
- **Zoom Threshold**: Added `PROPERTY_SELECTION_MIN_ZOOM = 16` constant for minimum zoom level
- **Smart Address Fetching**: Only fetch addresses and show selection card when zoomed in to property level (zoom ≥ 16)
- **Automatic Cleanup**: Clear address and hide card when zooming out below threshold
- **Improved UX**: Users can now browse freely at neighborhood/city level without constant card interruptions

**Technical Details**:
- **Zoom Level 16**: Sweet spot where individual buildings/properties are clearly visible
- **Event Handling**: Added `onZoomChanged` handler to track zoom level changes
- **State Management**: Automatically clear interaction state when zooming out
- **Address Caching**: Preserves performance while respecting zoom boundaries

**Zoom Level Context**:
- **Level 12** (Default): City/neighborhood overview
- **Level 16** (Selection threshold): Individual properties visible 
- **Level 19** (Search zoom): Street-level detail

**Impact**: Users can now browse the map freely without property selection interruptions until they zoom in to actually select properties.

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