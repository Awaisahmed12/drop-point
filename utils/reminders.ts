/**
 * Pure date rules for document reminders. Dates are calendar days as
 * `YYYY-MM-DD` strings (the `remind_at` column is a DATE), so a lease
 * ending on the 30th means the 30th wherever the person is.
 */

/** Today as `YYYY-MM-DD` in the device's local calendar. */
export const todayIso = (now: Date = new Date()): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** `iso` plus `days` calendar days. */
export const addDays = (iso: string, days: number): string =>
  parseIso(iso).getTime() + days * 86_400_000 > 0
    ? new Date(parseIso(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10)
    : iso;

/** Whole days from `today` to `iso`; negative when it has passed. */
export const daysUntil = (iso: string, today: string): number =>
  Math.round((parseIso(iso).getTime() - parseIso(today).getTime()) / 86_400_000);

/** "today", "tomorrow", "in 12 days", "yesterday", "3 days ago". */
export const describeDue = (iso: string, today: string): string => {
  const n = daysUntil(iso, today);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1) return `in ${n} days`;
  return `${-n} days ago`;
};

/** Due within the next `days` days, or already past. */
export const isDueSoon = (iso: string | null | undefined, today: string, days = 30): boolean =>
  Boolean(iso) && daysUntil(iso as string, today) <= days;

/** "Oct 12" this year, "Oct 12, 2027" otherwise. */
export const formatReminderDate = (iso: string, today: string): string => {
  const date = parseIso(iso);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
};

/** The presets the reminder sheet offers, in the order shown. */
export const REMINDER_PRESETS: ReadonlyArray<{ label: string; days: number }> = [
  { label: 'In 30 Days', days: 30 },
  { label: 'In 90 Days', days: 90 },
  { label: 'In 1 Year', days: 365 },
];
