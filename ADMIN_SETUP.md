# Admin Configuration System Setup

This document explains how to set up and use the admin configuration system for DropPoint.

## 🚀 Quick Setup

### 1. Database Setup

Run the SQL scripts in order:

```sql
-- 1. Create the admin configurations table
\i database/admin_configurations.sql

-- 2. Set up initial data
\i database/setup_admin.sql
```

### 2. Make Yourself an Admin

After creating your user account, update your user type to 'Admin':

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE user_profiles 
SET user_type = 'Admin' 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

### 3. Access Admin Panel

1. Log in to your account
2. Go to Account page (`/account`)
3. Set your user type to "Admin" and save
4. You'll see an "Admin Tools" section with a link to Configuration Management
5. Click "Configuration Management" to access `/admin/config`

## 🎛️ Configuration Management

### Current Configurations

- **Street View Toggle** (`street_view_enabled`)
  - Controls whether Street View is shown in property details modal
  - When enabled: Shows Street View on mobile, satellite view on desktop
  - When disabled: Always shows satellite view
  - Type: Boolean (true/false)

### Adding New Configurations

To add a new configuration:

1. **Add to database:**
```sql
INSERT INTO admin_configurations (key, value, description, category) 
VALUES (
  'your_config_key',
  'default_value',
  'Description of what this config does',
  'category_name'
);
```

2. **Update TypeScript types** in `types/index.ts`:
```typescript
export type YourConfigType = {
  // Define the structure
};
```

3. **Add to ConfigContext** in `src/contexts/ConfigContext.tsx`:
```typescript
// Add computed value
const yourConfigValue = configurations.your_config_key === 'expected_value';

// Add to context value
const value: ConfigContextType = {
  // ... existing values
  yourConfigValue,
};
```

4. **Add to admin page** in `src/pages/admin/config.tsx`:
```typescript
const configItems: ConfigItem[] = [
  // ... existing items
  {
    key: 'your_config_key',
    label: 'Your Config Label',
    description: 'Description of what this config does',
    type: 'boolean', // or 'string', 'number'
    category: 'Your Category',
    currentValue: configurations.your_config_key
  }
];
```

5. **Use in components:**
```typescript
import { useConfig } from '../contexts/ConfigContext';

const { yourConfigValue } = useConfig();
```

## 🔐 Security

- Only users with `user_type = 'Admin'` can access the admin configuration page
- Row Level Security (RLS) policies protect the `admin_configurations` table
- All configuration changes are logged with user IDs and timestamps

## 🏗️ Architecture

### Components

- **ConfigContext** (`src/contexts/ConfigContext.tsx`): Global configuration state management
- **Admin Config Page** (`src/pages/admin/config.tsx`): UI for managing configurations
- **useConfig Hook**: Access configurations in any component
- **useAdminConfig Hook**: Admin-specific operations with permission checks

### Database

- **admin_configurations table**: Stores all configuration key-value pairs
- **user_profiles.user_type**: Determines admin access
- **RLS Policies**: Secure access to configuration data

### Features

- ✅ Real-time configuration updates
- ✅ Automatic fallback to default values
- ✅ Admin permission checking
- ✅ Configuration change logging
- ✅ Type-safe configuration access
- ✅ Mobile-responsive admin interface

## 🎯 Usage Examples

### In Components

```typescript
import { useConfig } from '../contexts/ConfigContext';

function MyComponent() {
  const { streetViewEnabled } = useConfig();
  
  return (
    <div>
      {streetViewEnabled ? (
        <StreetViewComponent />
      ) : (
        <SatelliteViewComponent />
      )}
    </div>
  );
}
```

### Admin Operations

```typescript
import { useAdminConfig } from '../contexts/ConfigContext';

function AdminComponent() {
  const { isAdmin, updateConfiguration } = useAdminConfig();
  
  if (!isAdmin) {
    return <div>Access denied</div>;
  }
  
  const handleToggle = async () => {
    await updateConfiguration('street_view_enabled', !currentValue);
  };
  
  return <button onClick={handleToggle}>Toggle Street View</button>;
}
```

## 🚨 Troubleshooting

### Configuration Not Loading

1. Check if the database table exists
2. Verify RLS policies are set up correctly
3. Check browser console for errors
4. Ensure user has admin permissions

### Admin Access Issues

1. Verify `user_type = 'Admin'` in user_profiles table
2. Check if user is properly authenticated
3. Clear browser cache and reload

### Configuration Changes Not Taking Effect

1. Check if the configuration key matches exactly
2. Verify the component is using the useConfig hook
3. Check for typos in configuration keys
4. Ensure the configuration is marked as active (`is_active = true`)

## 📝 Future Enhancements

- Configuration categories and grouping
- Configuration change history and rollback
- Bulk configuration updates
- Configuration validation rules
- Environment-specific configurations
- Configuration templates and presets
