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

### **Latest Update: Simplified Upload Progress Indicators**
- **Streamlined Upload Feedback**: Removed redundant 0-100% sliding progress bar to create cleaner, less cluttered upload experience:
  - **Single Progress Indicator**: Now shows only the circular spinning indicator for active uploads
  - **Cleaner Visual Design**: Eliminated duplicate progress feedback that was overwhelming the interface
  - **Focused User Experience**: Users can now concentrate on the file upload process without visual noise
  - **Maintained Status Feedback**: Kept all essential upload status information (success, error, cancel options)
- **Consistent Upload States**: 
  - **Uploading**: Clean circular spinner animation without percentage text
  - **Success**: Green checkmark with "Done!" message  
  - **Error**: Red X icon with "Failed" message and retry options
  - **Interactive Controls**: Preserved cancel, retry, and dismiss functionality

### **Previous Update: Mobile Map View Satellite Toggle**
- **Mobile Satellite Controls**: Added compact satellite toggle for mobile map view:
  - **Top Left Positioning**: Small, unobtrusive button positioned under the search bar
  - **Toggle Functionality**: Single button that switches between Map (🗺️) and Satellite (🛰️) views
  - **Responsive Design**: Desktop retains full Map/Satellite buttons, mobile gets space-efficient toggle
  - **Visual Feedback**: Clear icon and text indicators for current map type
- **Safe Area Support**: Implemented CSS `env(safe-area-inset-*)` for universal device compatibility:
  - **Bottom Safe Area**: Prevents URL bars and home indicators from blocking Upload/Create buttons
  - **Top Safe Area**: Accounts for notches and status bars in modal positioning
  - **Dynamic Viewport**: Uses `100dvh` instead of `100vh` for proper mobile browser behavior
- **Auto-Height Solution**: Replaced complex viewport height calculations with natural content-based sizing:
  - **Content-Driven Height**: Modal now sizes automatically to fit its actual content
  - **Eliminated Fixed Heights**: Removed `viewportHeight` calculations that created empty space
  - **Natural Overflow**: Modal ends exactly at the action buttons without forced spacing

### **Previous Update: Root Cause Fix for Mobile Modal White Space**
- **Identified the Real Issue**: The white space wasn't from modal margins - it was from the backdrop container's flexbox centering
- **Flexbox Alignment Fix**: Changed backdrop from `items-center` to `items-start` on mobile
- **Perfect Mobile Positioning**: Modal now starts from top margin and extends to calculated height without centering
- **Preserved Desktop Experience**: Desktop modal remains perfectly centered as intended
- **Clean Solution**: Single CSS class change that addresses the root cause instead of workarounds

### **Previous Update: Mobile Modal Bottom Spacing Fix**
- **Eliminated Bottom White Space**: Fixed the white gap that appeared after the action buttons on mobile
- **Perfect Mobile Alignment**: Modal now ends exactly at the action buttons, just like on desktop
- **Clean Mobile Experience**: Removed unnecessary bottom margin that was causing the floating white space
- **Preserved Desktop Styling**: Maintained the beautiful floating modal appearance on desktop

### **Previous Update: Clean Mobile Modal Sizing Implementation**
- **Simplified Mobile Dimensions Logic**: Replaced complex viewport calculations with a clean 5-step approach:
  1. **Device Detection**: Accurately identifies mobile vs desktop devices
  2. **Screen Dimensions**: Gets actual screen height and visual viewport dimensions
  3. **Browser Chrome Accounting**: Automatically detects and accounts for mobile browser bars (URL bar, etc.)
  4. **Modal Sizing**: Calculates optimal modal height based on available screen space
  5. **Background Visibility**: Ensures blurred map background shows through by removing bottom margins

- **Eliminated White Space Issues**: Fixed persistent white space at bottom of mobile modal:
  - **No Bottom Margin**: Modal now extends to screen bottom with only top margin
  - **Proper Height Calculation**: Uses visual viewport height for accurate mobile sizing
  - **Browser Chrome Aware**: Accounts for mobile browser UI elements automatically

### **Previous Update: Compact Header Design & File-Focused Layout**
- **Streamlined Header**: Redesigned property details modal with a more compact, refined header that prioritizes file browsing:
  - **Reduced Header Size**: Smaller padding (py-4 vs py-6) and more compact typography for less visual weight
  - **Optimized Text Sizing**: Smaller but still readable font sizes (text-lg/xl vs text-2xl/3xl) with refined spacing
  - **Subtle Visual Effects**: More understated gradients and shadows that don't compete with file content
  - **Compact Close Button**: Smaller, more refined close button with subtle glassmorphic effects

- **File-Focused Layout**: Prioritized file browsing experience with reduced visual distractions:
  - **Smaller Satellite Image**: Reduced from h-48/56 to h-32/40 to give more space to file management
  - **Enhanced File Visibility**: More screen real estate dedicated to the primary file browsing functionality
  - **Balanced Visual Hierarchy**: Header provides context without overwhelming the main content area

- **Refined Typography & Styling**:
  - **Subtle Text Gradients**: Softer gradient effects that enhance readability without being distracting  
  - **Optimized Letter Spacing**: Fine-tuned spacing for better readability at smaller sizes
  - **Reduced Shadow Effects**: More subtle shadows that add depth without visual noise
  - **Improved Line Heights**: Tighter spacing (leading-tight, leading-snug) for more compact presentation

### **Previous Update: Refined Global Address Formatting & Enhanced Visual Design**
- **Enhanced Address Display**: Redesigned property details modal header to show addresses in a more readable, hierarchical format:
  - **Street Address**: Prominently displayed as the main header (larger, bold text)
  - **Location Info**: City, state/province, ZIP/postal code, and country shown below in smaller text
  - **Global Compatibility**: Smart parsing handles various international address formats:
    - **US Format**: "5318 Gemstone Park Rd" → "Richmond, TX 77407, USA"
    - **International**: "123 Main Street" → "London, England, UK"
    - **Simple Format**: "Property Name" → "City, Country"
  - **Responsive Design**: Optimal text sizing for both mobile and desktop viewing
  - **Graceful Fallback**: If parsing fails, displays the full address as before

- **Smart Address Parsing Logic**:
  - Automatically detects US ZIP code patterns (e.g., "TX 77407")
  - Handles comma-separated address components intelligently
  - Supports various international address formats
  - Maintains backward compatibility with existing address data

### **Previous Update: iPhone URL Bar & Search Bar Fixes**
- **iPhone URL Bar Issue Resolved**: Fixed mobile viewport handling to prevent UI elements from being hidden behind the iPhone URL bar:
  - **Conservative Viewport Calculation**: Reduced modal height to 92% of viewport with 60px buffer for iPhone URL bar
  - **Enhanced Search Bar Positioning**: Search bar now stays sticky with higher z-index (60) and proper mobile positioning
  - **Better Mobile Margins**: Added bottom margins and safe area padding to ensure content is always visible
  - **iPhone-Specific CSS**: Added WebKit-specific fixes for iPhone URL bar behavior

- **Search Bar Always Visible**: Enhanced sticky positioning ensures search bar never gets lost when scrolling:
  - **Persistent Sticky Behavior**: Search bar remains at top with enhanced z-index and positioning
  - **Mobile-Optimized Sizing**: Larger touch targets (48px min height) and proper input sizing
  - **Zoom Prevention**: 16px font size prevents unwanted zoom on iPhone input focus
  - **Enhanced Visual Feedback**: Added subtle shadow and border to improve visibility

- **Mobile Viewport Improvements**:
  - **Dynamic Height Calculation**: Better handling of iPhone's variable viewport height
  - **Safe Area Integration**: Proper padding for devices with notches and dynamic islands
  - **Overscroll Prevention**: Improved scroll behavior to prevent bounce effects
  - **WebKit Optimizations**: iPhone-specific CSS fixes for better compatibility

### **Previous Update: Comprehensive Mobile UI & Search Bar Fixes**
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
- **Secondary Text**: `