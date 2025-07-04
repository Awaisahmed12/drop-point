# DropPoint - Real Estate Document Management

DropPoint is a map-based document management platform for real estate professionals. Select properties from an interactive map, organize unlimited files per property, and access everything from anywhere.

## 🚀 Current Features

### **Interactive Map System**
- LandGlide-style crosshair cursor for precise property selection
- Satellite and roadmap views with toggle
- Smart address detection using reverse geocoding
- User geolocation with fallback to US center
- POI-free experience (no distracting business markers)

### **Property Management**
- One-click property saving from map coordinates
- Duplicate prevention system
- Property portfolio accessible from dashboard
- Address validation and coordinate snapping

### **File Management**
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

## 🏗️ Architecture

**Frontend**: Next.js 14 (Pages Router) + TypeScript + TailwindCSS
**Backend**: Supabase (PostgreSQL + Auth + Storage)
**Maps**: Google Maps JavaScript API + Places API
**Security**: Row Level Security (RLS) with signed URLs

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

## 🎯 Recent Updates

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