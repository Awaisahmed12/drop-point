import { describe, it, expect } from 'vitest';
import {
  isPropertyVisible,
  pinColorFor,
  sortTags,
  isTagShared,
  isPropertyShared,
  parseHiddenViews,
  normalizeTagName,
  normalizeEmail,
} from './tagViews';
import { DEFAULT_PIN_COLOR, UNTAGGED_VIEW_ID } from '../constants';
import type { Tag } from '../types';

const tag = (overrides: Partial<Tag>): Tag => ({
  id: 't1', owner_id: 'me', name: 'LLC', color: '#34c759', ...overrides,
});

const llc = tag({ id: 'llc', name: 'Company LLC', color: '#34c759' });
const sold = tag({ id: 'sold', name: 'Sold', color: '#ff3b30' });
const theirs = tag({ id: 'theirs', name: 'Acme', color: '#af52de', owner_id: 'someone-else' });

describe('isPropertyVisible', () => {
  it('shows a property when any of its views is on', () => {
    expect(isPropertyVisible({ tag_ids: ['llc', 'sold'] }, new Set(['sold']))).toBe(true);
  });

  it('hides a property when all of its views are off', () => {
    expect(isPropertyVisible({ tag_ids: ['llc', 'sold'] }, new Set(['llc', 'sold']))).toBe(false);
  });

  it('treats untagged properties as the built-in layer', () => {
    expect(isPropertyVisible({ tag_ids: [] }, new Set())).toBe(true);
    expect(isPropertyVisible({}, new Set([UNTAGGED_VIEW_ID]))).toBe(false);
  });

  it('ignores ids of views the person can no longer see', () => {
    // A view that was deleted or un-shared still sits on the property row.
    expect(isPropertyVisible({ tag_ids: ['gone'] }, new Set([UNTAGGED_VIEW_ID]), [llc])).toBe(false);
    expect(isPropertyVisible({ tag_ids: ['gone'] }, new Set(), [llc])).toBe(true);
  });
});

describe('pinColorFor', () => {
  it('uses the first switched-on view in display order', () => {
    expect(pinColorFor({ tag_ids: ['sold', 'llc'] }, [llc, sold], new Set())).toBe('#34c759');
    expect(pinColorFor({ tag_ids: ['sold', 'llc'] }, [llc, sold], new Set(['llc']))).toBe('#ff3b30');
  });

  it('falls back to the accent for untagged pins', () => {
    expect(pinColorFor({ tag_ids: [] }, [llc], new Set())).toBe(DEFAULT_PIN_COLOR);
  });
});

describe('sortTags', () => {
  it('puts own views first, then alphabetical', () => {
    expect(sortTags([theirs, sold, llc], 'me').map(t => t.id)).toEqual(['llc', 'sold', 'theirs']);
  });
});

describe('sharing predicates', () => {
  it('a view is shared when it has members or someone else owns it', () => {
    expect(isTagShared(llc, 'me')).toBe(false);
    expect(isTagShared({ ...llc, members: [{ id: 'm', tag_id: 'llc', email: 'a@b.co', user_id: null, role: 'viewer' }] }, 'me')).toBe(true);
    expect(isTagShared(theirs, 'me')).toBe(true);
  });

  it('a property is shared when it carries a shared view', () => {
    expect(isPropertyShared({ tag_ids: ['llc'] }, [llc, theirs], 'me')).toBe(false);
    expect(isPropertyShared({ tag_ids: ['llc', 'theirs'] }, [llc, theirs], 'me')).toBe(true);
  });
});

describe('parseHiddenViews', () => {
  it('reads a JSON array of ids and survives junk', () => {
    expect([...parseHiddenViews('["a","b"]')]).toEqual(['a', 'b']);
    expect(parseHiddenViews(null).size).toBe(0);
    expect(parseHiddenViews('{oops').size).toBe(0);
    expect(parseHiddenViews('[1, "x"]').has('x')).toBe(true);
  });
});

describe('input normalizers', () => {
  it('collapses whitespace in names and rejects empty or long ones', () => {
    expect(normalizeTagName('  Gas   Stations ', 40)).toBe('Gas Stations');
    expect(normalizeTagName('   ', 40)).toBeNull();
    expect(normalizeTagName('x'.repeat(41), 40)).toBeNull();
  });

  it('lower-cases emails and rejects non-emails', () => {
    expect(normalizeEmail(' Pat@Example.com ')).toBe('pat@example.com');
    expect(normalizeEmail('not an email')).toBeNull();
  });
});
