# DropPoint - Real Estate Document Management

DropPoint is a map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere.

## 🚀 Current Features

### **Interactive Map System**
- **Google Maps-Style Pin Interaction**: Click/tap anywhere on map to drop new property pins
- **Pin-Only Property Access**: Property details ONLY accessible by clicking pins (no crosshair system)
- Three map views: Hybrid (default), Satellite, and Roadmap with seamless toggle
- Smart address detection using reverse geocoding
- User geolocation with fallback to US center
- POI-free experience (no distracting business markers)
- Current location button for instant navigation to user's position
- **Priority Search**: User's saved properties appear first in search results, even from different locations
- **List View**: Glassmorphic modal overlay for browsing properties (accessible via List button)

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
- **Dual View Modes**: Toggle between Grid view (default, iOS Files-style icons) and List view (detailed)
- **Persistent View Preferences**: User's preferred view mode saved across sessions
- **iOS Files-inspired Grid View**: Beautiful icon-based layout with 3 columns on mobile, 4-6 on desktop (default view)
- **Document Preview Thumbnails**: Clean file icons for enhanced file recognition and performance
  - **Professional File Icons**: Consistent, beautiful icons for all file types (PDF, images, documents, etc.)
  - **Zero Loading Time**: Instant display with no network delays or loading states
  - **Lag-Free Scrolling**: Smooth, responsive scrolling without thumbnail loading interference
  - **📋 PROFESSIONAL-GRADE PERFORMANCE**: Optimized for real estate workflow efficiency
    - **Instant Recognition**: Professional file icons allow immediate file type identification
    - **Filename-First**: Real estate professionals know their files by name, not thumbnails
    - **Enterprise Appearance**: Clean, consistent icons create professional document management experience
    - **Mobile-Optimized**: Perfect performance on mobile devices without image loading delays
    - **Memory Efficient**: No image caching or blob storage reduces memory usage
    - **Network Efficient**: Zero additional network requests for file previews
  - **🚀 COMPREHENSIVE PERFORMANCE SYSTEM**: Multi-level optimizations for lightning-fast experience
    - **Smart Property Caching**: Instant property switching with 5-minute cache timeout
    - **Global Cache Management**: Shared cache across components for zero redundant API calls
    - **Background Preloading**: User properties preloaded during map initialization
    - **Optimized Uploads**: Faster retry logic (500ms, 1s) and reduced database calls
    - **Intelligent Prefetching**: Property data loaded during search predictions and hover events
    - **Session Storage**: Instant ListView loading with background cache refresh
    - **Memory Management**: Proper cleanup and efficient state management
  - **Hook Compliance**: Fixed React Rules of Hooks violations for stable rendering and performance
  - **Code Quality**: Refactored MapSearch component with helper functions, useCallback optimization, and improved maintainability
  - **Search Enhancement**: Fixed custom property name search functionality - now "home" will find properties with custom names
  - **List View Integration**: Enhanced ListView and PropertySwitcher to prominently display custom names with search functionality
  - **Enhanced ListView Actions**: Replaced arrow with three-dot menu providing View Property, Rename, and Copy Address actions with clean popup rename experience
  - **Build Optimization**: ✅ Production build successful with TypeScript strict mode compliance
  - **Context Menu Fixes**: Corrected file vs folder delete operations for proper functionality

- **🚀 GOOGLE MAPS-STYLE PIN SYSTEM**: Complete replacement of crosshair with intuitive pin interaction
  - **📍 Interactive Property Pins**: Beautiful blue house icons for all saved properties visible on map
  - **🎯 Click-to-Drop**: Click/tap anywhere on map to instantly drop new property pins  
  - **🗺️ Free Map Exploration**: Explore map freely without any center-locked cursors or overlays
  - **📌 Pin-Only Property Access**: Property details modal ONLY opens via pin clicks - no other triggers
  - **⚡ Instant Pin Loading**: Properties load as pins immediately when map loads
  - **🎨 Custom House Icons**: Professional blue house pins with hover and selection states
  - **📍 Smart Pin Placement**: Prevents accidental drops near existing properties (50m threshold)
  - **🔄 Pin-to-Modal**: Click any property pin to instantly open property details with cached data
  - **📱 Mobile-Optimized**: Touch-friendly pin interaction optimized for mobile devices
  - **🎯 Visual Feedback**: Clear selected vs unselected pin states with custom icons
  - **📋 Property Info Cards**: Show for newly dropped pins only, clean experience for existing properties
  - **⚡ Performance Optimized**: Efficient pin rendering with zero lag or loading delays
  - **🎨 Professional Design**: Intuitive pin-based property management following Google Maps conventions

- Batch operations and smart file organization
- In-app file viewer for mobile (no pop-up blockers)

### **Mobile-First Design**
- Glassmorphic UI with backdrop blur effects
- Perfect viewport handling with safe area support
- Touch-optimized interface (44px+ touch targets)
- Responsive layout for all screen sizes
- iOS web app optimizations
- **🎯 Thumb-Friendly Map Controls**: Mobile map controls positioned lower for better thumb accessibility
- **🚫 Smart Control Hiding**: Map controls automatically hide during property interactions (pin drops, property viewing, modal open)
- **📱 Mobile-Optimized Positioning**: Controls positioned at 180px from bottom for comfortable thumb reach
- **🎭 Context-Aware UI**: Controls disappear when not needed, providing clean interface during property management

### **Enhanced User Experience**
- Global cursor pointer rules for all clickable elements
- Smart click handling with overlay-based dropdown controls
- Consistent hover states and interaction feedback
- Seamless property switching without page reloads
- **Social Media Integration**: Rich link previews with DropPoint logo when sharing on Twitter, Facebook, LinkedIn, etc.
- **FIXED**: Critical race condition bug where files disappeared during property switching
- Intuitive property dropdown that shows all properties with proper "Current" marking
- Resolved useEffect conflict that was clearing file state immediately after property switches

### **List View Experience** 🎯
- **Steve Jobs-inspired design**: Minimal, intuitive, and lightning-fast modal overlay
- **Glassmorphic integration**: Matches PropertyDetailsModal aesthetic perfectly
- **Instant search**: Real-time filtering with smart keyboard handling
- **Modal experience**: Stays within map context, no page navigation
- **Property icons**: Blue-accented house icons matching app theme
- **Smart states**: Loading, empty, error, and no-results states
- **PropertySwitcher-like navigation**: Instant modal opening with background map updates
- **Smart return flow**: Returns to list view when closing property accessed from list
- **Performance optimized**: Background preloading for instant access
- **Mobile-first**: Touch-friendly interactions with proper modal sizing
- **Context preservation**: Maintains map position and state throughout
- **Production ready**: TypeScript strict mode compliance and build optimizations

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

### Prerequisites
- Node.js 18.18+ (LTS recommended) and npm 9+
- Supabase project and Google Maps API key

### Windows PowerShell setup (first-time only)
If you see a script signing error when running npm commands in PowerShell, allow locally created scripts for your user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

1. **Install Dependencies (reproducible)**
   ```bash
   npm ci
   ```
   If you are actively changing dependencies, you can use:
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

### Build & Run (Production)
```bash
npm run build
npm start
```

## 🧾 Accounts & Usage (MVP)

- Free plan limit is configurable via `NEXT_PUBLIC_FREE_TIER_GB` (default 5 GB total).
- Uploads are blocked when the projected total exceeds the free limit.
- Account page (`/account`) shows a usage meter and plan info; billing upgrade CTA is stubbed for now.


## 📁 File Structure

```
src/
├── components/           # React components
│   ├── PropertyDetailsModal.tsx  # Main property file management
│   ├── UserAuthForm.tsx          # Authentication UI
│   ├── MoveModal.tsx            # File/folder moving
│   ├── FileIcon.tsx             # File type icons (fallback)
│   └── FileThumbnail.tsx        # Document preview thumbnails
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

### **Enhanced Map Controls & Mobile UX ✅ COMPLETED (Latest Update)**

**Mobile Zoom Controls:**
- Added **+ and - zoom buttons** positioned directly under the current location re-centering button on mobile
- Styled consistently with existing Google Maps-style controls
- Provides explicit zoom controls for users who prefer buttons over pinch-to-zoom gestures
- Properly positioned to avoid overlapping with other UI elements

**Blended Search Experience (Google Maps + User Properties):**
- **Seamless Integration**: User's saved properties are blended directly into Google Maps search suggestions for unified experience
- **Priority Ranking**: User properties appear first in suggestions, ranked by most recently updated/accessed
- **Smart Matching**: Matches both property addresses and custom names/labels when searching
- **Visual Distinction**: User properties show with blue accent, house icon, and "My Property" label
- **Intelligent Display**: Shows custom property names prominently with full address as secondary text
- **Empty Search**: When search is empty or focused, shows recent properties as suggestions (top 8 most recent)
- **Deduplication**: Prevents duplicate entries when Google Maps returns user's own properties
- **Map Interaction Protection**: Prevents pin dropping when search is focused, automatically unfocuses search when clicking elsewhere on map
- **Immediate State Updates**: Search suggestions and recent properties disappear instantly when clicking outside, preventing race conditions

**Property Renaming Feature:**
- Enhanced PropertyInfoCard to support **custom property names** for both saved and unsaved properties
- Added edit button (pencil icon) next to property names for all properties
- When custom name is set, **real address appears subtly underneath** in smaller, lighter text
- **Auto-save on Rename**: Renaming an unsaved property automatically saves it to the database and locks in the pin
- Saves changes to database for saved properties and updates local state for unsaved ones
- Updates UI in real-time with proper error handling
- **Smart X Button Behavior**: X button is hidden during property renaming to prevent accidental closure
- **Improved X Button Positioning**: Moved to left side to prevent interference with zoom controls, especially on wide property cards
- Enhanced X button aesthetics with rounded background, better positioning, and smooth hover effects
- **Keyboard Shortcuts**: Press Enter to save or Escape to cancel during property renaming for improved workflow efficiency

**Accurate Current Location Blue Dot:**
- Implemented **CurrentLocationIndicator component** using Google Maps API best practices
- Creates custom blue dot matching Google Maps design (Google Blue #4285F4 with white border)
- Uses `navigator.geolocation.watchPosition` for continuous, accurate location tracking
- Includes **accuracy circle** showing location uncertainty radius
- **Commercial-friendly**: Uses Google Maps API features and custom canvas drawing
- Proper permission handling and automatic cleanup to prevent memory leaks

### **Selection Card for Existing Pins + Background Prefetch ✅ COMPLETED**

### **Current Location Zoom Tuning ✅ COMPLETED**

- Adjusted current location zoom to a friendlier neighborhood level on both web and mobile.
- Uses a dedicated `CURRENT_LOCATION_ZOOM` constant for consistent behavior.

- When clicking any existing property pin, the blue selection card now appears (same as for newly dropped pins) instead of immediately opening the details modal.
- While the card is visible, the app preloads that property's folders and files in the background. When you tap Select, the modal opens with data ready or near-ready for a snappy experience.
- Current location and map controls auto-adjust to avoid overlapping the card.

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
- **Interactive Map System**: Google Maps-style pin interaction with click-to-drop functionality
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
- **Responsive design**: Desktop button near search; on mobile it's a floating button above the bottom nav (not inside the nav)

### **Google Maps-Style Map Controls**
- **Three-way toggle**: Circular button cycles through Hybrid (default) → Satellite → Roadmap
- **Clean positioning**: Controls positioned below search bar to avoid interference
- **Smart icons**: Context-aware icons showing next map type in cycle
- **Desktop controls**: Three-button layout for direct access to any map type
- **Smart visibility**: Controls hide during search, reappear when done typing
- **Non-overlapping layout**: All controls positioned to avoid blocking search or other UI elements

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

### **Pin-Only Property Access (Google Maps Style) ✅ COMPLETED**

**Status**: Complete transformation from crosshair-based to pin-only property interaction

**Problem**: Users found the crosshair-based property selection intrusive and confusing. The PropertyInfoCard would constantly appear and disappear during map exploration, interrupting the browsing experience when users weren't actually trying to select properties.

**Solution**: 
- **Pin-Only Modal Access**: Property details modal now ONLY opens when clicking/tapping property pins
- **Google Maps-Style Interaction**: Click anywhere on map to drop new property pins, just like Google Maps
- **Removed Center-Based Selection**: Eliminated the PropertyInfoCard that appeared during map interaction
- **Clean Map Exploration**: Users can now freely explore the map without unwanted interruptions
- **Smart Pin Dropping**: Improved pin dropping logic with 50m threshold to prevent accidental drops near existing properties

**Technical Implementation**:
- **Removed PropertyInfoCard triggers**: Eliminated center-based address fetching and property card display
- **Enhanced pin dropping**: Improved `handleMapClick` with better error handling and user feedback
- **Simplified interaction model**: Cleaned up unused state variables and interaction handlers
- **Mobile-optimized**: Touch-friendly pin interaction that works reliably on mobile devices

**User Experience**:
- **Intuitive Interaction**: Familiar Google Maps-style behavior that users already understand
- **No More Interruptions**: Browse the map freely without constant property card pop-ups
- **Clear Intent**: Property selection only happens when users explicitly click pins
- **Better Mobile UX**: Touch-optimized pin dropping and selection for mobile devices

**Impact**: Map interaction is now intuitive and non-intrusive, following familiar Google Maps conventions while eliminating the annoying crosshair-based selection system.

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

### **PropertyDetailsModal UI Improvements ✅ COMPLETED**

**Status**: Enhanced header layout and property switcher UX with intuitive positioning

**Key Improvements**:
- **Intuitive Property Switcher Placement**: Moved property switcher right next to the property address for maximum user clarity
- **Right-Aligned Dropdown**: Dropdown positioned to prevent cutoff issues while staying within viewport bounds  
- **Optimized Dropdown Sizing**: Mobile `80vw` (max 350px), desktop `50vw` (max 400px) for better balance
- **Balanced Heights**: Dropdown max height `50vh` mobile / `60vh` desktop with property list `max-h-60` / `max-h-72`
- **Clear Visual Hierarchy**: Property switcher logically grouped with address, view controls separate on right
- **Anti-Cutoff Protection**: Right-aligned positioning and conservative sizing prevent viewport overflow

**Technical Details**:
- **Inline Address Layout**: Property switcher integrated into address container with `flex items-center`
- **Smart Responsive Sizing**: Uses viewport units with reasonable max-width constraints
- **Right-Aligned Positioning**: `top-full right-0` positioning for dropdown to prevent cutoff
- **Proper Spacing**: `ml-3 flex-shrink-0` wrapper prevents text overflow while maintaining button access

**Impact**: Property switching is now instantly recognizable as being related to the property address, eliminating user confusion while preventing any dropdown cutoff issues.

### **Property Switcher Text Optimization ✅ COMPLETED**

**Status**: Improved readability and space utilization in property dropdown

**Key Improvements**:
- **Removed "Current" Badge**: Eliminated the disappearing "Current" button that wasn't helpful and took up valuable space
- **Smaller Font Sizes**: Reduced to `text-sm` for property names and `text-xs` for location info to prevent address truncation
- **Better Text Wrapping**: Removed unnecessary `truncate` classes to allow full address display when space permits
- **Consistent Styling**: Applied same font sizing across both mobile and desktop dropdowns

**Technical Details**:
- **Mobile Property Names**: Changed from `text-base` to `text-sm` with `font-semibold`
- **Desktop Property Names**: Maintained `text-sm` with `font-medium` for desktop density
- **Location Info**: Standardized to `text-xs` on both mobile and desktop
- **Space Optimization**: Removed badge reduces horizontal space competition for longer addresses

**Impact**: Addresses now display more completely without truncation, and the interface feels cleaner without the unnecessary "Current" badge visual clutter.

### **Completely Redesigned Rename Experience ✅ COMPLETED**

**Status**: Transformed the poor rename UX into a modern, intuitive interface

**Problems Fixed**:
- **Poor Text Contrast**: White/unclear text that was hard to read
- **Tiny Input Fields**: Cramped, difficult-to-use input boxes
- **No Visual Feedback**: Unclear when rename mode was active
- **Missing Actions**: No clear Cancel/Save options
- **Mobile Unfriendly**: Small touch targets and zoom issues

**New Rename UX Features**:
- **Blue Highlight Container**: Clear visual indication when renaming with `bg-blue-50` and `border-blue-400`
- **Large, Touch-Friendly Inputs**: Proper padding (`px-3 py-2` desktop, `px-4 py-3` mobile) with focus rings
- **Explicit Action Buttons**: Clear "Cancel" and "Save" buttons instead of relying on blur/enter
- **File Extension Display**: Clean extension preview (`.pdf`, `.jpg`) shown separately
- **iOS Optimization**: `fontSize: '16px'` prevents unwanted zoom on mobile
- **Consistent Styling**: Same experience across List view, Mobile view, and Grid view

**Technical Implementation**:
- **Desktop List/Mobile**: Full-width containers with action buttons at bottom
- **Grid View**: Centered inputs with centered action buttons for compact display
- **Input Styling**: `text-gray-900 bg-white border-gray-300` for excellent contrast
- **Focus States**: `focus:ring-2 focus:ring-blue-500` for clear interaction feedback
- **Responsive Design**: Different padding and sizing for mobile vs desktop

**Impact**: Renaming files and folders is now a pleasure instead of a frustration - clear visual feedback, readable text, large touch targets, and intuitive save/cancel actions.

### **Fixed Grid View Rename Overlap Issue ✅ COMPLETED**

**Status**: Resolved awful overlapping rename interface in grid view

**Problem**: The full rename interface (with blue container and action buttons) was overlapping other grid items, creating visual chaos and making it impossible to see or interact with other files during rename.

**Solution**: 
- **Grid View**: Simplified to compact input-only interface that fits within grid item bounds
- **List/Mobile View**: Retained full-featured interface with action buttons (where there's space)
- **Clean Visual Design**: Blue border (`border-2 border-blue-400`) indicates rename mode without bulk
- **Layout Preservation**: Grid structure remains intact during rename operations

**Technical Details**:
- **Grid View Rename**: Just `input` with blue border, fits in existing space
- **List View Rename**: Full container with `Cancel`/`Save` buttons for feature-rich experience  
- **Responsive Strategy**: Different rename UX based on available space and context
- **Keyboard Shortcuts**: Enter/Escape work consistently across all view modes

**Impact**: Grid view rename is now clean and non-disruptive, while list view retains the full-featured rename experience where space allows.

### **Revolutionary Grid View Interaction & Beautiful Context Menus ✅ COMPLETED**

**Status**: Completely redesigned grid view interaction model with gorgeous floating menus

**New Interaction Model**:
- **Click Icon = Open Document**: Direct, intuitive interaction - clicking any file/folder icon opens it immediately
- **Floating Action Button**: Elegant `...` button appears on hover in top-right corner of each item
- **No More Context Menu Confusion**: Clear separation between opening items and accessing actions

**Stunning Menu Design**:
- **Glassmorphic Aesthetic**: `bg-white/95 backdrop-blur-xl` with subtle transparency effects
- **Floating Design**: Elegant rounded corners (`rounded-xl`) with sophisticated shadow system
- **Icon + Text Layout**: Beautiful SVG icons paired with clear action text
- **Color-Coded Actions**: Blue (rename), Purple (move), Green (download), Red (delete)
- **Smooth Interactions**: `transition-all duration-150` for buttery-smooth hover effects

**Technical Excellence**:
- **Perfect Positioning**: Smart positioning logic prevents viewport overflow
- **Consistent Design**: Same beautiful menu aesthetic across grid view and list view
- **Z-Index Management**: Proper layering with `z-[99999]` for reliable display
- **Touch-Friendly**: Adequate spacing and touch targets for mobile users
- **Glassmorphism Effects**: Advanced CSS with backdrop blur and semi-transparent backgrounds

**Menu Features**:
- **Visual Hierarchy**: Clear borders between actions with `border-gray-100/50`
- **Hover States**: Subtle color backgrounds on hover (blue-50, purple-50, green-50, red-50)
- **Professional Icons**: Hand-picked Heroicons for each action type
- **Smooth Animation**: All transitions use consistent 150ms duration

**Impact**: Grid view now feels like a premium iOS/macOS application with intuitive interactions and absolutely gorgeous context menus that match the app's sophisticated design language.

### **Mobile-First Action Button Visibility ✅ COMPLETED**

**Status**: Enhanced mobile UX with always-visible action buttons

**Mobile Optimization**:
- **Always Visible on Mobile**: Floating `...` buttons show by default on mobile devices since there's no hover state
- **Hover Behavior on Desktop**: Elegant hover-to-reveal behavior preserved for desktop users
- **Smart Responsive Logic**: Uses `isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'`

**User Experience**:
- **Mobile Users**: Can immediately see and access action buttons without confusion
- **Desktop Users**: Clean interface with buttons appearing on hover for reduced visual clutter
- **Consistent Interaction**: Same beautiful floating button design across all devices

**Impact**: Mobile users no longer struggle to find action buttons, while desktop users retain the elegant hover-based discovery experience.

### **iOS-Style Perfectly Circular Action Buttons ✅ COMPLETED**

**Status**: Perfect iOS delete button style with true circular shape, white background

**Perfect Circular Design**:
- **Exact Size Control**: `width: 20px; height: 20px` (mobile) and `28px` (desktop) with `minWidth/minHeight` to force perfect circles
- **Top-Right Positioning**: `-top-2 -right-2` positioning in the top-right corner
- **iOS White Theme**: `bg-white/95 backdrop-blur-sm` with `shadow-lg` for authentic iOS floating effect
- **iOS Border**: `border-black/10` for the subtle dark border iOS uses on white buttons
- **Three Dots Icon**: `w-2.5 h-2.5` gray dots for clean contrast against white background

**Perfect Circle Solution**:
- **No More Ellipses**: Removed Tailwind `w-5 h-5` classes that can create elliptical shapes
- **Explicit Dimensions**: Using inline `style` with exact pixel values ensures perfect circles
- **Min Dimensions**: `minWidth/minHeight` prevents any compression or distortion
- **True Circular Shape**: Buttons are now perfectly round, not obtuse or elliptical

**Impact**: Action buttons are now perfectly circular with iOS-style white floating appearance - no more ellipses or obtuse shapes!

### **Smart Context Menu Positioning & Behavior ✅ COMPLETED**

**Status**: Complete overhaul of menu positioning and click behavior for perfect UX

**Smart Positioning System**:
- **Viewport-Aware**: Menus automatically position above or below based on available space
- **Horizontal Adjustment**: Menus shift left/right to avoid screen edges and prevent cutoff
- **Fixed Positioning**: All menus now use `position: fixed` with calculated coordinates for overlay behavior
- **Ultra-High Z-Index**: `zIndex: 999999` ensures menus appear above all other content

**Enhanced Click Behavior**:
- **Click-Outside Protection**: First click outside a menu only closes the menu without triggering the clicked element
- **Event Capture**: Uses capture phase event handling to intercept and prevent accidental interactions
- **Smooth UX**: Users can click anywhere to close menus without accidentally performing unintended actions

**Universal Menu Coverage**:
- **Grid View**: Both file and folder menus with smart positioning
- **List View**: Desktop and mobile file/folder menus with intelligent placement
- **Edge Detection**: Left-edge files no longer have cut-off menus
- **Perfect Visibility**: All menus display properly regardless of screen size or scroll position

**Technical Implementation**:
- **Dynamic Calculation**: `calculateMenuPosition()` function computes optimal placement in real-time
- **Viewport Detection**: Considers available space in all directions before positioning
- **State Management**: Tracks menu positions per item for consistent behavior

**Impact**: Context menus now provide a flawless, professional experience with intelligent positioning and intuitive click behavior - no more cut-off menus or accidental clicks!

### **Mobile Map Improvements**
- Clean satellite/map toggle as a floating side button (hidden during search)
- Current location is a floating button; removed from bottom nav for clearer IA
- Bottom nav reduced to Map, List, Account (no current location)
- POI-free experience (no distracting business markers)
- Enhanced mobile viewport handling
- Improved touch targets and interactions
- **🎯 Thumb-Optimized Controls**: Map controls positioned at 180px from bottom for comfortable thumb reach
- **🚫 Context-Aware Visibility**: Controls automatically hide during property interactions (pin drops, property viewing, modal open)
- **📱 Smart Control Management**: Uses `selectedProperty`, `isPropertyModalOpen`, and `showPropertyInfoCard` states to determine visibility
- **🎭 Clean Interface**: Provides distraction-free experience when users are focused on property management

### **Upload System Enhancements**
- Streamlined progress indicators
- Real-time upload tracking
- Batch file processing
- Smart error handling with retry

## 🚧 Next Steps

This roadmap consolidates the remaining high‑leverage work to take the app from polished MVP to a scalable, fundable product.

### Product & UX
- Onboarding and empty states (first‑run tour, sample property, CSV import)
- Sharing & collaboration (property‑level invites/roles, activity feed)
- Offline‑first PWA (installable, background sync, local cache)
- Global search (address, file names, OCR content, filters)
- AI assist (OCR → auto‑tags → semantic search → suggested folders)
- Mobile polish (haptics, bottom sheets, gestures, keyboard avoidance)
- Accessibility & i18n (WCAG AA, RTL, language packs)

### Compliance & Legal (MVP-ready)
- Cookie consent banner (essential vs analytics) with Accept/Decline and links to legal pages
- Privacy Policy and Terms (draft placeholders; replace with counsel‑reviewed versions)
- User profile name (stored in Supabase user metadata)

### Data, Security & Scale
- Security hardening (RLS review, ownership invariants, signed URL rotation)
- Backups & disaster recovery (daily backups, PITR, runbook)
- Audit trails (per‑file/property events, export)
- Big‑file pipeline (chunked/resumable uploads, AV scan, dedupe)
- Performance (index tuning, CDN headers, image proxy, marker virtualization)

### Monetization & Growth
- Billing (Free/Pro/Team), metering (storage, collaborators), Stripe portal
- Usage insights (dashboards, weekly digests)
- Referral & trials (invite links, extended trial on invites)

### Ops & Quality
- Observability (Sentry, logs, uptime checks, Slack alerts)
- E2E tests for critical flows (auth, upload, share, search, map select)
- Release pipeline (preview envs, feature flags, staged rollouts)

### Execution plan (next 2 sprints)
- Sprint 1 (Foundations)
  - Property‑level sharing with invite links and roles (viewer/editor)
  - Stripe test‑mode billing (Free 5GB, Pro 200GB)
  - Sentry + uptime checks wired
  - DoD: share link opens read‑only; upgrade changes quota; errors visible in Sentry
- Sprint 2 (Value drivers)
  - OCR for PDFs/images (queued) → searchable text, basic auto‑tags
  - Global search with filters (address, file name, OCR text)
  - Offline cache for last 10 properties and recent files
  - DoD: search finds OCR text; offline works after first open; fast results

### KPIs
- Time‑to‑first upload
- Properties created/user
- Search success rate
- Upload success rate
- Retention (D7/D30)
- Conversion to Pro

---

**DropPoint** - Where properties meet digital organization.