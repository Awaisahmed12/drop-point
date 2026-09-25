import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * The daily reminder email. Vercel's cron calls this once a day (see
 * vercel.json); it finds every document whose reminder is a week out or
 * due today, sends its uploader one email listing them, and records the
 * send in `reminded_at` so each notice goes out once.
 *
 * Stays off until every variable is set:
 *   CRON_SECRET                Vercel sends it as `Authorization: Bearer …`.
 *   SUPABASE_SERVICE_ROLE_KEY  Reads across users and their emails.
 *   RESEND_API_KEY             Sends the email (https://resend.com).
 *   REMINDER_FROM_EMAIL        Sender, e.g. "DropPoint <reminders@yourdomain>".
 *   NEXT_PUBLIC_SITE_URL       Links back to the file.
 */

const DAYS_AHEAD = 7;
const OVERDUE_GRACE_DAYS = 30;

type DueFile = {
  id: string;
  file_name: string;
  property_id: string;
  user_id: string;
  remind_at: string;
  reminded_at: string | null;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const describe = (remindAt: string, today: string): string => {
  const n = Math.round((Date.parse(remindAt) - Date.parse(today)) / 86_400_000);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n > 1) return `in ${n} days`;
  if (n === -1) return 'yesterday';
  return `${-n} days ago`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing = ['CRON_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'REMINDER_FROM_EMAIL', 'NEXT_PUBLIC_SITE_URL']
    .filter(name => !process.env[name]);
  if (missing.length > 0) {
    return res.status(501).json({ error: `Reminder emails are not configured: set ${missing.join(', ')}` });
  }
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const now = new Date();
  const today = isoDate(now);
  const horizon = isoDate(plusDays(now, DAYS_AHEAD));
  const floor = isoDate(plusDays(now, -OVERDUE_GRACE_DAYS));

  // Everything inside the window. Which of these still need a notice is
  // decided below, so a day the job missed is caught up the next day.
  const { data: candidates, error } = await supabase
    .from('property_files')
    .select('id, file_name, property_id, user_id, remind_at, reminded_at')
    .not('remind_at', 'is', null)
    .gte('remind_at', floor)
    .lte('remind_at', horizon)
    .order('remind_at', { ascending: true });
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Two notices per reminder: the first time it is within a week, and on
  // the day itself (or the first run after, if that was missed).
  const due = (candidates as DueFile[]).filter(f => {
    if (!f.reminded_at) return true;
    const lastNotice = f.reminded_at.slice(0, 10);
    return f.remind_at <= today && lastNotice < f.remind_at;
  });
  if (due.length === 0) {
    return res.status(200).json({ sent: 0, files: 0 });
  }

  const propertyIds = Array.from(new Set(due.map(f => f.property_id)));
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address, label')
    .in('id', propertyIds);
  const propertyName = new Map((properties ?? []).map(p => [p.id, (p.label as string | null) || (p.address as string).split(',')[0]]));

  const byUser = new Map<string, DueFile[]>();
  for (const f of due) byUser.set(f.user_id, [...(byUser.get(f.user_id) ?? []), f]);

  const site = process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, '');
  let sent = 0;
  const notified: string[] = [];

  for (const [userId, files] of byUser) {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) continue;

    const rows = files.map(f => {
      const link = `${site}/list?property=${encodeURIComponent(f.property_id)}&file=${encodeURIComponent(f.id)}`;
      const where = escapeHtml(propertyName.get(f.property_id) ?? 'a property');
      return `<li style="margin:0 0 12px"><a href="${link}" style="color:#0a7aff;text-decoration:none;font-weight:600">${escapeHtml(f.file_name)}</a><br><span style="color:#6e6e73">${where} · ${describe(f.remind_at, today)}</span></li>`;
    });
    const first = files[0];
    const subject = files.length === 1
      ? `${first.file_name} — ${propertyName.get(first.property_id) ?? 'reminder'} · ${describe(first.remind_at, today)}`
      : `${files.length} documents need a look`;
    const html = `<div style="font-family:-apple-system,system-ui,Segoe UI,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.4;color:#1c1c1e;max-width:520px;margin:0 auto;padding:24px">
<p style="margin:0 0 16px;font-size:22px;font-weight:700">Coming up</p>
<ul style="list-style:none;padding:0;margin:0 0 24px">${rows.join('')}</ul>
<p style="margin:0;color:#6e6e73;font-size:13px">You set these reminders in DropPoint. Open a document to change or remove its reminder.</p>
</div>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.REMINDER_FROM_EMAIL, to: [email], subject, html }),
    });
    if (!response.ok) {
      console.error('[reminders] Resend rejected the email:', response.status, await response.text());
      continue;
    }
    sent += 1;
    notified.push(...files.map(f => f.id));
  }

  if (notified.length > 0) {
    await supabase.from('property_files').update({ reminded_at: now.toISOString() }).in('id', notified);
  }

  return res.status(200).json({ sent, files: notified.length });
}
