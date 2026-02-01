## Security and Compliance Checklist

This checklist is the canonical reference for pre-launch and ongoing security work.

### Pre-launch essentials

- Verify Row Level Security is enabled for all tables.
- Confirm storage buckets are private and served with signed URLs.
- Enable email verification in Supabase Auth.
- Add security headers in `next.config.ts`.
- Restrict Google Maps API key to your domain.
- Validate file types and enforce file size limits.
- Ensure legal pages are replaced with counsel-reviewed Terms and Privacy.
- Confirm cookie consent banner behavior and logging.

### Database and storage

- RLS policies for `properties`, `property_files`, `property_folders`, and `user_profiles`.
- Storage bucket is private, not public.
- Signed URL expiration is reasonable for file access.

### Authentication

- Enforce password requirements in Supabase.
- Rate limiting and abuse protections verified in Supabase and Vercel.

### Data rights (GDPR/CCPA readiness)

- Ability to export user data.
- Ability to delete user data and associated storage.
- Document data retention policies.

### Monitoring and incident response

- Error monitoring (Sentry or equivalent) configured.
- Uptime monitoring in place.
- Runbook for backups and recovery documented.

### Ongoing cadence

- Monthly: review error logs and access anomalies.
- Quarterly: test backup restore and audit RLS policies.
- Annually: full security review and dependency audit.
