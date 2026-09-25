import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropertyFile } from '../../types';
import { fileService } from '../services';
import { addDays, todayIso } from '../../utils/reminders';
import { logger } from '../utils/logger';

/** How far ahead "upcoming" looks. */
export const UPCOMING_DAYS = 30;

/**
 * Documents with a reminder due within the next 30 days (or already past),
 * across every property the person can see. The Properties page lists them;
 * the map marks their pins. `refresh` after a reminder changes.
 */
export function useUpcomingReminders(enabled = true) {
  const [files, setFiles] = useState<PropertyFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setFiles(await fileService.getUpcomingReminders(addDays(todayIso(), UPCOMING_DAYS)));
    } catch (error) {
      // A missing column (migration not run yet) just means no reminders.
      logger.error('[REMINDERS] Failed to load upcoming reminders:', error);
      setFiles([]);
    } finally {
      setLoaded(true);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byProperty = useMemo(() => new Set(files.map(f => f.property_id)), [files]);

  return { files, byProperty, loaded, refresh };
}
