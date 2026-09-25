# Reminders

A document can carry a day to be reminded about it: a lease end, an
insurance renewal, an inspection, a listing expiry. It is the one reason
the app calls someone back, and it lands them on the exact file.

### In the app

- File menu → **Set Reminder…** → In 30 Days / In 90 Days / In 1 Year /
  Pick a Date…; once set, **Change Reminder…** adds Remove. Whoever may
  rename or delete a file (its uploader or the property's owner) may set one.
- A file with a reminder carries a clock mark on its tile, orange when it
  is due within 30 days or has passed.
- The Properties page opens with **Upcoming**: up to three documents due
  within 30 days, soonest first, overdue included. Tapping a row opens the
  property on that file.
- Pins on the map and cards on the Properties page carry an orange dot when
  one of their documents is due soon.

### 1. Database

Run once in the Supabase SQL editor, after `collaboration.sql`:

```sql
\i database/reminders.sql
```

It adds `remind_at` (date) and `reminded_at` (timestamptz) to
`property_files`. The app runs without it: reminders simply stay empty.

### 2. The daily email

`/api/reminders/notify` sends each person one email listing their
documents that are a week out or due today, once per notice, and links
each one back to the file. Vercel runs it daily at 13:00 UTC
(`vercel.json`). It stays off until all of these are set in Vercel:

| Variable | What it is |
|---|---|
| `CRON_SECRET` | Any long random string. Vercel sends it as `Authorization: Bearer …` on cron calls; the route accepts nothing else. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API. Server-side only; never `NEXT_PUBLIC_`. |
| `RESEND_API_KEY` | resend.com → API Keys. The free tier is enough. |
| `REMINDER_FROM_EMAIL` | The sender, e.g. `DropPoint <reminders@yourdomain.com>`. Resend must have the domain verified; while testing, `onboarding@resend.dev` delivers only to the Resend account's own address. |
| `NEXT_PUBLIC_SITE_URL` | Already set; the links in the email use it. |

To try it by hand:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://drop-point-xi.vercel.app/api/reminders/notify
```

It answers `{ "sent": <emails>, "files": <documents> }`, or `501` naming
the variables still missing.

### Code map

- `utils/reminders.ts`: date rules (presets, "in 12 days", due-soon), with tests.
- `src/services/FileService.ts`: `setReminder`, `getUpcomingReminders`.
- `src/hooks/usePropertyFileActions.ts`: `setFileReminder`.
- `src/hooks/useUpcomingReminders.ts`: the Upcoming list for a page.
- `src/components/ListView.tsx`: the Upcoming group and card dot.
- `src/pages/api/reminders/notify.ts`: the email.
