import { supabase } from '../utils/supabaseClient';
import type { PropertyFile, PropertyFolder } from '../../types';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface PropertyDataEntry {
  files: PropertyFile[];
  folders: PropertyFolder[];
  fetchedAt: number;
}

// Module-level: survives re-renders and React lifecycle within a page session.
// Synchronous reads mean zero latency on cache hits — no React state, no async getUser().
const dataStore = new Map<string, PropertyDataEntry>();
const inFlight = new Set<string>(); // prevent duplicate in-flight fetches

export function getPropertyDataSync(propertyId: string): PropertyDataEntry | null {
  const entry = dataStore.get(propertyId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL) {
    dataStore.delete(propertyId);
    return null;
  }
  return entry;
}

export function setPropertyDataCache(
  propertyId: string,
  files: PropertyFile[],
  folders: PropertyFolder[]
): void {
  dataStore.set(propertyId, { files, folders, fetchedAt: Date.now() });
}

export function invalidatePropertyCache(propertyId: string): void {
  dataStore.delete(propertyId);
}

// Fire-and-forget background prefetch. Safe to call repeatedly — no-ops if already
// cached (and fresh) or already in-flight.
export async function prefetchPropertyData(propertyId: string): Promise<void> {
  if (!propertyId) return;

  const existing = dataStore.get(propertyId);
  if (existing && Date.now() - existing.fetchedAt < CACHE_TTL) return;
  if (inFlight.has(propertyId)) return;

  inFlight.add(propertyId);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [folderResult, filesResult] = await Promise.all([
      supabase
        .from('property_folders')
        .select('*')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('property_files')
        .select('*')
        .eq('property_id', propertyId)
        .order('uploaded_at', { ascending: false }),
    ]);

    if (folderResult.data && filesResult.data) {
      setPropertyDataCache(propertyId, filesResult.data, folderResult.data);
    }
  } catch {
    // Silently fail — this is a background prefetch, not user-initiated
  } finally {
    inFlight.delete(propertyId);
  }
}
