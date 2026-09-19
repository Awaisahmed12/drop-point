import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { tagService } from '../services';
import type { Property, Tag, TagMember, TagRole } from '../../types';
import { HIDDEN_VIEWS_KEY, TAG_COLORS, TAG_NAME_MAX_LENGTH, UNTAGGED_VIEW_ID } from '../../constants';
import {
  isPropertyVisible,
  pinColorFor,
  parseHiddenViews,
  sortTags,
  normalizeTagName,
  normalizeEmail,
  isPropertyShared,
} from '../../utils/tagViews';

/**
 * Views (tags) as map layers, shared by the map, the Properties page, the
 * sidebar and the property sheet. One module-level store so every screen
 * shows the same switches; which views are off is remembered per device.
 */

interface ViewsState {
  tags: Tag[];
  hidden: ReadonlySet<string>;
  userId: string | null;
  loaded: boolean;
}

const initialState: ViewsState = { tags: [], hidden: new Set(), userId: null, loaded: false };
let state: ViewsState = initialState;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

const setState = (patch: Partial<ViewsState>) => {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn());
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
const getSnapshot = () => state;
const getServerSnapshot = () => initialState;

const persistHidden = (hidden: ReadonlySet<string>) => {
  try { localStorage.setItem(HIDDEN_VIEWS_KEY, JSON.stringify([...hidden])); } catch {}
};

const readHidden = (): Set<string> => {
  try { return parseHiddenViews(localStorage.getItem(HIDDEN_VIEWS_KEY)); } catch { return new Set(); }
};

/** Fetch views once per page session; later calls reuse the result. */
async function ensureLoaded(): Promise<void> {
  if (state.loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      let tags: Tag[] = [];
      if (userId) {
        await tagService.claimInvites();
        tags = sortTags(await tagService.getTags(), userId);
      }
      setState({ tags, userId, hidden: readHidden(), loaded: true });
    } catch (error) {
      // The migration may not be applied yet; the app works without views.
      logger.error('[Views] Could not load views:', error);
      setState({ hidden: readHidden(), loaded: true });
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

async function refresh(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const tags = userId ? sortTags(await tagService.getTags(), userId) : [];
  setState({ tags, userId, loaded: true });
}

/** Reset between sign-ins so one account's views never show for the next. */
export function resetTagViews(): void {
  state = initialState;
  loadPromise = null;
  listeners.forEach(fn => fn());
}

/** The first palette color no existing view uses, else the least used. */
function nextColor(tags: Tag[]): string {
  const counts = new Map(TAG_COLORS.map(c => [c.value, 0]));
  tags.forEach(t => counts.set(t.color, (counts.get(t.color) ?? 0) + 1));
  let best = TAG_COLORS[0].value;
  let bestCount = Infinity;
  for (const c of TAG_COLORS) {
    const n = counts.get(c.value) ?? 0;
    if (n < bestCount) { best = c.value; bestCount = n; }
  }
  return best;
}

export function useTagViews() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void ensureLoaded();
  }, []);

  const { tags, hidden, userId, loaded } = snap;

  const toggleView = useCallback((id: string) => {
    const next = new Set(state.hidden);
    if (next.has(id)) next.delete(id); else next.add(id);
    persistHidden(next);
    setState({ hidden: next });
  }, []);

  /** Show only this view (a second call on the same view shows everything). */
  const soloView = useCallback((id: string) => {
    const all = [...state.tags.map(t => t.id), UNTAGGED_VIEW_ID];
    const alreadySolo = all.every(x => (x === id) !== state.hidden.has(x));
    const next = alreadySolo ? new Set<string>() : new Set(all.filter(x => x !== id));
    persistHidden(next);
    setState({ hidden: next });
  }, []);

  const isVisible = useCallback(
    (property: Pick<Property, 'tag_ids'>) => isPropertyVisible(property, hidden, tags),
    [hidden, tags],
  );

  const pinColor = useCallback(
    (property: Pick<Property, 'tag_ids'>) => pinColorFor(property, tags, hidden),
    [tags, hidden],
  );

  const isShared = useCallback(
    (property: Pick<Property, 'tag_ids' | 'user_id'>) =>
      (property.user_id !== undefined && property.user_id !== userId) || isPropertyShared(property, tags, userId),
    [tags, userId],
  );

  const createView = useCallback(async (name: string, color?: string): Promise<Tag> => {
    const clean = normalizeTagName(name, TAG_NAME_MAX_LENGTH);
    if (!clean) throw new Error('INVALID_NAME');
    const tag = await tagService.createTag(clean, color ?? nextColor(state.tags));
    setState({ tags: sortTags([...state.tags, tag], state.userId) });
    return tag;
  }, []);

  const renameView = useCallback(async (id: string, name: string): Promise<void> => {
    const clean = normalizeTagName(name, TAG_NAME_MAX_LENGTH);
    if (!clean) throw new Error('INVALID_NAME');
    const updated = await tagService.updateTag(id, { name: clean });
    setState({ tags: sortTags(state.tags.map(t => (t.id === id ? { ...t, ...updated } : t)), state.userId) });
  }, []);

  const recolorView = useCallback(async (id: string, color: string): Promise<void> => {
    const updated = await tagService.updateTag(id, { color });
    setState({ tags: state.tags.map(t => (t.id === id ? { ...t, ...updated } : t)) });
  }, []);

  const deleteView = useCallback(async (id: string): Promise<void> => {
    await tagService.deleteTag(id);
    const next = new Set(state.hidden);
    next.delete(id);
    persistHidden(next);
    setState({ tags: state.tags.filter(t => t.id !== id), hidden: next });
  }, []);

  const leaveView = useCallback(async (id: string): Promise<void> => {
    await tagService.leaveTag(id);
    setState({ tags: state.tags.filter(t => t.id !== id) });
  }, []);

  const shareView = useCallback(async (id: string, email: string, role: TagRole): Promise<TagMember> => {
    const clean = normalizeEmail(email);
    if (!clean) throw new Error('INVALID_EMAIL');
    const member = await tagService.addMember(id, clean, role);
    setState({ tags: state.tags.map(t => (t.id === id ? { ...t, members: [...(t.members ?? []), member] } : t)) });
    return member;
  }, []);

  const setMemberRole = useCallback(async (tagId: string, memberId: string, role: TagRole): Promise<void> => {
    const updated = await tagService.updateMemberRole(memberId, role);
    setState({
      tags: state.tags.map(t =>
        t.id === tagId ? { ...t, members: (t.members ?? []).map(m => (m.id === memberId ? updated : m)) } : t,
      ),
    });
  }, []);

  const unshareView = useCallback(async (tagId: string, memberId: string): Promise<void> => {
    await tagService.removeMember(memberId);
    setState({
      tags: state.tags.map(t =>
        t.id === tagId ? { ...t, members: (t.members ?? []).filter(m => m.id !== memberId) } : t,
      ),
    });
  }, []);

  /** Put a property in exactly these views. Returns the ids as stored. */
  const setPropertyViews = useCallback(
    (propertyId: string, tagIds: string[]) => tagService.setPropertyTags(propertyId, tagIds),
    [],
  );

  return {
    tags,
    hidden,
    userId,
    loaded,
    toggleView,
    soloView,
    isVisible,
    pinColor,
    isShared,
    createView,
    renameView,
    recolorView,
    deleteView,
    leaveView,
    shareView,
    setMemberRole,
    unshareView,
    setPropertyViews,
    refresh,
  };
}
