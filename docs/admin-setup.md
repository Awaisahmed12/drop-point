## Admin Configuration Setup

This guide explains how to set up and use the admin configuration system.

### 1. Database setup

Run the SQL scripts in order:

```sql
\i database/admin_configurations.sql
\i database/setup_admin.sql
```

### 2. Make yourself an admin

After creating your user account, update your user type to `Admin`:

```sql
UPDATE user_profiles
SET user_type = 'Admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

### 3. Access the admin panel

1. Log in to your account.
2. Go to `/account`.
3. Set user type to `Admin` and save.
4. Open the "Admin Tools" section to access `/admin/config`.

### Adding new configurations

1. Add a row in `admin_configurations`:

```sql
INSERT INTO admin_configurations (key, value, description, category)
VALUES ('your_config_key', 'default_value', 'What this config does', 'category');
```

2. Update types in `types/index.ts`.
3. Add computed values in `src/contexts/ConfigContext.tsx`.
4. Add UI in `src/pages/admin/config.tsx`.

### Security

- Only users with `user_type = 'Admin'` can access the admin configuration page.
- RLS policies protect `admin_configurations`.
- Configuration changes should be logged with user IDs and timestamps.
