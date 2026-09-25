-- Reminders on documents. Run once in the Supabase SQL editor, after
-- collaboration.sql. Additive: two columns and an index.
--
-- remind_at   The calendar day the person wants to be reminded about this
--             file (a lease end, an insurance renewal). Set from the file's
--             menu; NULL means no reminder.
-- reminded_at When the last reminder email went out, so the daily job
--             (/api/reminders/notify) sends each notice once.
--
-- Who may set a reminder is the existing update policy on property_files:
-- the uploader or the property's owner.

ALTER TABLE property_files
  ADD COLUMN IF NOT EXISTS remind_at DATE;
ALTER TABLE property_files
  ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS property_files_remind_at_idx
  ON property_files (remind_at)
  WHERE remind_at IS NOT NULL;
