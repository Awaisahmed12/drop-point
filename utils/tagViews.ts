import type { Property, Tag } from '../types';
import { DEFAULT_PIN_COLOR, UNTAGGED_VIEW_ID } from '../constants';

/**
 * Pure rules for views (tags) as map layers. Each view is a switch, like a
 * calendar in Google Calendar; a property shows when any of its views is on.
 * Properties with no view belong to the built-in "no view" layer.
 */

/** Ids of the views a property carries that are known to the caller. */
const knownTagIds = (property: Pick<Property, 'tag_ids'>, tags: Tag[]): string[] => {
  const ids = property.tag_ids ?? [];
  if (tags.length === 0) return ids;
  const known = new Set(tags.map(t => t.id));
  return ids.filter(id => known.has(id));
};

/** Whether a property is on screen given which views are switched off. */
export function isPropertyVisible(
  property: Pick<Property, 'tag_ids'>,
  hidden: ReadonlySet<string>,
  tags: Tag[] = [],
): boolean {
  const ids = knownTagIds(property, tags);
  if (ids.length === 0) return !hidden.has(UNTAGGED_VIEW_ID);
  return ids.some(id => !hidden.has(id));
}

/** The views a property carries, in the order the caller lists them. */
export function tagsForProperty(property: Pick<Property, 'tag_ids'>, tags: Tag[]): Tag[] {
  const ids = new Set(property.tag_ids ?? []);
  return tags.filter(t => ids.has(t.id));
}

/** Pin color: the first switched-on view the property carries, else the accent. */
export function pinColorFor(
  property: Pick<Property, 'tag_ids'>,
  tags: Tag[],
  hidden: ReadonlySet<string>,
): string {
  const first = tagsForProperty(property, tags).find(t => !hidden.has(t.id));
  return first?.color ?? DEFAULT_PIN_COLOR;
}

/** Views sorted for display: the person's own first, then shared-in, each alphabetical. */
export function sortTags(tags: Tag[], userId: string | null): Tag[] {
  return [...tags].sort((a, b) => {
    const aOwn = a.owner_id === userId ? 0 : 1;
    const bOwn = b.owner_id === userId ? 0 : 1;
    if (aOwn !== bOwn) return aOwn - bOwn;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/** A view is shared when it has members or belongs to someone else. */
export function isTagShared(tag: Tag, userId: string | null): boolean {
  return tag.owner_id !== userId || (tag.members?.length ?? 0) > 0;
}

/** A property is shared when it carries at least one shared view. */
export function isPropertyShared(property: Pick<Property, 'tag_ids'>, tags: Tag[], userId: string | null): boolean {
  return tagsForProperty(property, tags).some(t => isTagShared(t, userId));
}

/** Read the persisted hidden set; tolerant of a missing or corrupt value. */
export function parseHiddenViews(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Trim and validate a view name. Returns null when it can't be used. */
export function normalizeTagName(name: string, maxLength: number): string | null {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lower-cased email, or null when it doesn't look like one. */
export function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}
