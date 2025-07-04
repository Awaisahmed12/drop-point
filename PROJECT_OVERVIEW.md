# DropPoint Project Overview

## Vision & Mission
DropPoint transforms how real estate professionals organize and access property documents by combining LandGlide-style satellite imagery with intelligent file management. Our mission: make property data accessible anywhere, anytime, on any device.

## Core Principles
- **Privacy First**: All properties and files are private by default. Only the owner can access unless explicitly shared.
- **Granular Sharing**: 
  - **Public Links**: Make properties/files accessible via shareable links
  - **Email-based Sharing**: Share with specific users by email/account
  - **Teams/Enterprise**: (Future) Team-based collaboration and shared access
- **Flexible Organization**: Tag properties for different map views, with user-specific but shareable perspectives
- **Data Ownership**: Export/download all documents and properties with reasonable size limits

## Current Status: MVP Phase

### ✅ **Completed Core Features**
- **Authentication System**: Supabase auth with modern UI
- **Interactive Map**: LandGlide-style crosshair, satellite/roadmap toggle, POI-free experience
- **Property Management**: Save from map, duplicate prevention, coordinate snapping
- **File Management**: Drag-and-drop uploads, hierarchical folders, Google Drive-style sorting
- **Mobile Optimization**: Perfect viewport handling, touch-friendly interface, in-app file viewer
- **Modern UI**: Glassmorphic design, responsive layout, smooth animations

### 🚧 **Next MVP Features**
- [ ] **Sharing System**: Public links and email-based sharing
- [ ] **Property Tagging**: Multiple map/list views with user-defined tags
- [ ] **Export Functionality**: Download all documents and property data
- [ ] **Properties Dashboard**: Manage saved properties outside of map view

## Data Model Philosophy

### **User-Centric Ownership**
Every property and file belongs to a specific user. This ensures:
- Clear data ownership and privacy
- Simplified permission model
- Easy data export and portability

### **Flexible Sharing Model**
- **Default Private**: Everything starts private
- **Explicit Sharing**: Users choose what to share and with whom
- **Multiple Share Types**: Public links, specific users, team access
- **Granular Control**: Share individual files or entire properties

### **Future Collaboration Vision**
As DropPoint grows, we'll support:
- **Global Property Records**: Unique properties that multiple users can access
- **Join Tables**: Manage user access and roles per property
- **Shared File Storage**: Collaborative document management
- **Team Workspaces**: Enterprise-level collaboration

## User Experience Goals

### **Simplicity**
- One-click property saving from map
- Intuitive file organization (like Google Drive per property)
- Familiar UI patterns that users already understand

### **Mobile-First**
- Perfect rendering on all devices
- Touch-optimized interactions
- No pop-up blockers or mobile limitations

### **Performance**
- Fast map interactions
- Real-time upload feedback
- Optimized file loading and preview

## Technical Strategy

### **Current Architecture**
- **Frontend**: Next.js + TypeScript + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Maps**: Google Maps API
- **Security**: Row Level Security (RLS)

### **Key Decisions**
1. **Supabase**: Rapid development, real-time features, scalable
2. **Google Maps**: Best-in-class mapping with property search
3. **Mobile-First**: Global viewport optimization system
4. **Property-Centric**: File organization around properties, not folders

## Business Model Considerations

### **Target Users**
- **Primary**: Real estate agents and brokers
- **Secondary**: Property managers, inspectors, appraisers
- **Enterprise**: Real estate teams and brokerages

### **Value Proposition**
- **Time Savings**: Instant property access from any device
- **Organization**: Never lose property documents again
- **Collaboration**: Share property data with clients and team
- **Mobility**: Field work without connectivity limitations

## Roadmap Phases

### **Phase 1: MVP** (Current)
- Core map and file management
- Basic sharing capabilities
- Mobile optimization

### **Phase 2: Collaboration**
- Team workspaces
- Advanced sharing controls
- Real-time collaboration features

### **Phase 3: Intelligence**
- AI-powered document categorization
- Smart property insights
- Automated workflows

### **Phase 4: Enterprise**
- Advanced security features
- Custom integrations
- White-label solutions

## Success Metrics

### **User Engagement**
- Properties saved per user
- Files uploaded per property
- Daily/weekly active users
- Mobile vs desktop usage

### **Feature Adoption**
- Sharing feature usage
- Map interaction patterns
- File organization depth
- Search and filter usage

### **Business Metrics**
- User retention rates
- Feature conversion rates
- Support ticket volume
- Performance benchmarks

## Design Philosophy

### **Modern & Professional**
- Glassmorphic design with subtle effects
- Clean typography and generous spacing
- Consistent color palette and interactions

### **Familiar Patterns**
- Google Drive-style file management
- LandGlide-inspired map interaction
- Mobile app-like experience

### **Accessibility**
- Touch-friendly interface (44px+ targets)
- High contrast and readable text
- Keyboard navigation support

## Future Considerations

### **Property Specificity**
Support for granular property management:
- Suite/unit numbers within buildings
- Sub-property organization
- Related property grouping

### **Advanced Features**
- Bulk operations and batch processing
- Advanced search and filtering
- Document versioning and history
- Offline capability (PWA)

### **Integration Opportunities**
- MLS system integration
- CRM platform connections
- Document scanning and OCR
- E-signature workflows

---

This overview serves as the north star for DropPoint development, ensuring we stay focused on our core mission while building toward a comprehensive real estate document management platform. 