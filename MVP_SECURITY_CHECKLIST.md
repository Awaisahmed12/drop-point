# MVP Security & Legal Compliance Checklist

This document outlines everything you need to do to make DropPoint legally sound and secure for users before launch.

## 1. Legal Requirements (CRITICAL - Do Before Launch)

### Terms of Service & Privacy Policy
**Status**: You have placeholder pages - these MUST be replaced before launch.

**Action Items:**
1. **Hire a lawyer** (or use a service like LegalZoom, Rocket Lawyer, or Termly)
   - Cost: $200-$1000 for basic review
   - Get proper Terms of Service and Privacy Policy
   - Must cover: data storage, user rights, liability, dispute resolution

2. **Key sections to include:**
   - **Terms**: User obligations, acceptable use, intellectual property, termination
   - **Privacy**: Data collection, storage, sharing, user rights (GDPR/CCPA), cookies
   - **Liability**: Service provided "as-is", limitations of liability
   - **Data Rights**: How users can export/delete their data

3. **Update your pages:**
   - Replace `/legal/terms.tsx` with lawyer-reviewed content
   - Replace `/legal/privacy.tsx` with lawyer-reviewed content
   - Ensure both pages are linked in footer/navigation

### GDPR/CCPA Compliance (If serving EU/CA users)
**Required if you have users in EU or California:**

1. **User Rights:**
   - Right to access their data
   - Right to delete their data
   - Right to export their data
   - Right to opt-out of data processing

2. **Implementation:**
   - Add "Export My Data" button in account settings
   - Add "Delete My Account" button in account settings
   - Document data retention policies
   - Add data processing consent checkboxes

3. **Cookie Consent:**
   - ✅ You already have this implemented
   - Ensure it's working correctly and tracking consent

### Business Entity
**Recommendation:**
- Form an LLC or Corporation before accepting payments
- Protects personal assets from business liability
- Cost: $50-$500 depending on state
- Can use services like Stripe Atlas or Clerky

---

## 2. Security Measures (CRITICAL - Verify Before Launch)

### Database Security (Supabase)

**Current Status**: You're using Supabase which provides:
- ✅ Encryption at rest (automatic)
- ✅ Encryption in transit (HTTPS/TLS)
- ✅ Row Level Security (RLS) - **VERIFY THIS IS ENABLED**

**Action Items:**

1. **Verify RLS Policies are Enabled:**
   ```sql
   -- Check if RLS is enabled on all tables
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

2. **Ensure RLS Policies Exist for:**
   - `properties` table: Users can only see/edit their own properties
   - `property_files` table: Users can only access their own files
   - `property_folders` table: Users can only access their own folders
   - `user_profiles` table: Users can only see/edit their own profile

3. **Example RLS Policy (verify these exist):**
   ```sql
   -- Properties: Users can only access their own
   CREATE POLICY "Users can view own properties" ON properties
     FOR SELECT USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can insert own properties" ON properties
     FOR INSERT WITH CHECK (auth.uid() = user_id);
   
   CREATE POLICY "Users can update own properties" ON properties
     FOR UPDATE USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can delete own properties" ON properties
     FOR DELETE USING (auth.uid() = user_id);
   ```

4. **Storage Bucket Security:**
   - Verify `property-files` bucket has RLS enabled
   - Ensure signed URLs are used (not public URLs)
   - Set bucket to private (not public)

### Authentication Security

**Current Status**: Using Supabase Auth (good choice)

**Action Items:**
1. ✅ Email/password auth (already implemented)
2. **Enable password requirements:**
   - Minimum 8 characters (Supabase default)
   - Consider requiring: uppercase, lowercase, number, special char
3. **Enable email verification:**
   - Check Supabase dashboard: Authentication > Settings
   - Enable "Confirm email" option
4. **Enable rate limiting:**
   - Supabase handles this automatically
   - Verify it's enabled in dashboard

### API Security

**Action Items:**
1. **Google Maps API Key:**
   - ✅ Restrict to your domain in Google Cloud Console
   - ✅ Use HTTP referrer restrictions
   - ✅ Monitor usage in Google Cloud Console

2. **Supabase Keys:**
   - ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose (it's public)
   - ❌ Never expose service role key in frontend
   - ✅ Verify environment variables are set correctly

3. **API Routes:**
   - Verify `/api/autocomplete.ts` validates user authentication
   - Add rate limiting if needed (Vercel handles basic rate limiting

### File Upload Security

**Action Items:**
1. **File Type Validation:**
   - ✅ You have this (check your upload code)
   - Verify: Only allow safe file types (PDF, images, documents)
   - Block: .exe, .sh, .bat, .js, .html (unless needed)

2. **File Size Limits:**
   - ✅ You have 5GB limit mentioned
   - Verify this is enforced in Supabase storage bucket
   - Consider per-file limit (e.g., 100MB per file)

3. **Virus Scanning:**
   - **Consider adding**: ClamAV or similar (can be expensive)
   - **For MVP**: Document that users are responsible for file content
   - **Future**: Add virus scanning before accepting files

4. **Storage Security:**
   - Files stored in Supabase Storage (encrypted at rest)
   - Signed URLs for access (not public URLs)
   - Verify signed URLs expire after reasonable time (e.g., 1 hour)

### Hosting Security (Vercel)

**Current Status**: Using Vercel (good choice)

**Vercel Provides:**
- ✅ HTTPS/SSL automatically
- ✅ DDoS protection
- ✅ CDN with global edge network
- ✅ Environment variable encryption

**Action Items:**
1. ✅ Verify HTTPS is enabled (should be automatic)
2. ✅ Verify environment variables are set in Vercel dashboard
3. **Enable Vercel Security Headers:**
   - Add to `next.config.ts`:
   ```typescript
   async headers() {
     return [
       {
         source: '/(.*)',
         headers: [
           {
             key: 'X-Frame-Options',
             value: 'DENY'
           },
           {
             key: 'X-Content-Type-Options',
             value: 'nosniff'
           },
           {
             key: 'Referrer-Policy',
             value: 'strict-origin-when-cross-origin'
           },
           {
             key: 'Permissions-Policy',
             value: 'camera=(), microphone=(), geolocation=()'
           }
         ]
       }
     ]
   }
   ```

---

## 3. Data Protection & Backup

### Backup Strategy

**Action Items:**
1. **Supabase Backups:**
   - Supabase Pro plan includes daily backups
   - Verify backup retention period (7-30 days)
   - Test restore process once

2. **Document Recovery Plan:**
   - How to restore from backup
   - Who has access to backups
   - Recovery time objective (RTO) and recovery point objective (RPO)

### Data Retention

**Action Items:**
1. **Define retention policy:**
   - How long to keep deleted user data (e.g., 30 days)
   - How long to keep inactive accounts (e.g., 2 years)
   - Document in Privacy Policy

2. **Implement data deletion:**
   - When user deletes account, delete all their data
   - Include: properties, files, folders, profile
   - Verify cascade deletes work correctly

---

## 4. Monitoring & Incident Response

### Error Monitoring

**Action Items:**
1. **Set up error tracking:**
   - **Sentry** (recommended): Free tier available
   - **LogRocket**: For session replay
   - **Vercel Analytics**: Built-in error tracking

2. **Set up alerts:**
   - Database errors
   - Authentication failures
   - File upload failures
   - High error rates

### Security Monitoring

**Action Items:**
1. **Monitor for:**
   - Unusual login patterns
   - Large file uploads
   - API rate limit violations
   - Failed authentication attempts

2. **Set up alerts:**
   - Multiple failed logins from same IP
   - Unusual data access patterns
   - Storage quota approaching limits

---

## 5. User Data Rights (GDPR/CCPA)

### Export User Data

**Action Items:**
1. **Create export endpoint:**
   - Export all user properties (JSON)
   - Export all file metadata
   - Provide download link

2. **Add to account page:**
   - "Export My Data" button
   - Generates ZIP file with all user data
   - Sends download link via email

### Delete User Data

**Action Items:**
1. **Create deletion endpoint:**
   - Delete all user properties
   - Delete all user files from storage
   - Delete user profile
   - Delete auth user

2. **Add to account page:**
   - "Delete My Account" button
   - Confirmation dialog with warning
   - 30-day grace period (optional but recommended)

---

## 6. Pre-Launch Security Audit

### Checklist Before Launch:

- [ ] RLS policies enabled on all tables
- [ ] RLS policies tested (try accessing another user's data - should fail)
- [ ] Storage bucket is private (not public)
- [ ] Signed URLs used for file access (not public URLs)
- [ ] Email verification enabled in Supabase
- [ ] Terms of Service reviewed by lawyer
- [ ] Privacy Policy reviewed by lawyer
- [ ] Cookie consent banner working
- [ ] Security headers added to next.config.ts
- [ ] Error monitoring set up (Sentry or similar)
- [ ] Backup strategy documented
- [ ] Data export functionality implemented
- [ ] Data deletion functionality implemented
- [ ] Environment variables secured in Vercel
- [ ] Google Maps API key restricted to your domain
- [ ] File type validation working
- [ ] File size limits enforced
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Test account deletion flow
- [ ] Test data export flow
- [ ] Document incident response plan

---

## 7. Post-Launch Security

### Ongoing Tasks:

1. **Monthly:**
   - Review error logs
   - Check for unusual activity
   - Review user feedback for security concerns

2. **Quarterly:**
   - Review and update security policies
   - Test backup restore process
   - Review and update Terms/Privacy if needed

3. **Annually:**
   - Security audit (consider hiring professional)
   - Review and update all dependencies
   - Penetration testing (if budget allows)

---

## Cost Estimates

- **Legal Review**: $200-$1000 (one-time)
- **LLC Formation**: $50-$500 (one-time)
- **Sentry (Error Monitoring)**: Free tier available
- **Supabase Pro** (for backups): $25/month
- **Security Audit**: $500-$2000 (optional, annual)

**Total MVP Launch Cost**: ~$300-$1500 (one-time) + $25/month

---

## Priority Order

**Before First User:**
1. ✅ Terms of Service (lawyer-reviewed)
2. ✅ Privacy Policy (lawyer-reviewed)
3. ✅ RLS policies verified and tested
4. ✅ Storage bucket security verified
5. ✅ Email verification enabled
6. ✅ Security headers added

**Within First Month:**
1. Error monitoring (Sentry)
2. Data export functionality
3. Data deletion functionality
4. Backup strategy documented

**Nice to Have:**
1. LLC formation
2. Security audit
3. Advanced monitoring

---

## Resources

- **Supabase Security**: https://supabase.com/docs/guides/auth/row-level-security
- **Vercel Security**: https://vercel.com/docs/security
- **GDPR Guide**: https://gdpr.eu/
- **CCPA Guide**: https://oag.ca.gov/privacy/ccpa
- **Termly** (Privacy Policy Generator): https://termly.io/
- **Sentry** (Error Monitoring): https://sentry.io/

