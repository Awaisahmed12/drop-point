import { describe, it, expect } from 'vitest';
import { addDays, daysUntil, describeDue, formatReminderDate, isDueSoon, todayIso } from './reminders';

describe('reminders', () => {
  it('formats today in the local calendar', () => {
    expect(todayIso(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05');
  });

  it('adds calendar days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-25', 30)).toBe('2027-01-24');
    expect(addDays('2027-02-28', 365)).toBe('2028-02-28');
  });

  it('counts whole days either way', () => {
    expect(daysUntil('2026-09-17', '2026-09-05')).toBe(12);
    expect(daysUntil('2026-09-05', '2026-09-05')).toBe(0);
    expect(daysUntil('2026-09-02', '2026-09-05')).toBe(-3);
  });

  it('describes when something is due in plain words', () => {
    const today = '2026-09-05';
    expect(describeDue('2026-09-05', today)).toBe('today');
    expect(describeDue('2026-09-06', today)).toBe('tomorrow');
    expect(describeDue('2026-09-17', today)).toBe('in 12 days');
    expect(describeDue('2026-09-04', today)).toBe('yesterday');
    expect(describeDue('2026-09-02', today)).toBe('3 days ago');
  });

  it('flags the next 30 days and anything overdue as due soon', () => {
    const today = '2026-09-05';
    expect(isDueSoon('2026-10-05', today)).toBe(true);
    expect(isDueSoon('2026-10-06', today)).toBe(false);
    expect(isDueSoon('2026-08-01', today)).toBe(true);
    expect(isDueSoon(null, today)).toBe(false);
    expect(isDueSoon(undefined, today)).toBe(false);
  });

  it('shows the year only when it differs', () => {
    expect(formatReminderDate('2026-10-12', '2026-09-05')).toBe('Oct 12');
    expect(formatReminderDate('2027-10-12', '2026-09-05')).toBe('Oct 12, 2027');
  });
});
