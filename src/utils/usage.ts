import { supabase } from '../utils/supabaseClient';

export const bytesToGB = (bytes: number): number => bytes / (1024 * 1024 * 1024);

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const getUserUsageBytes = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('property_files')
    .select('file_size')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching usage:', error);
    throw error;
  }

  const total = (data || []).reduce((sum: number, row: { file_size: number | null }) => sum + (row.file_size || 0), 0);
  return total;
};


