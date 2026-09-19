import React, { useEffect, useRef, useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';
import { InputAlert } from './InputAlert';
import { useTagViews } from '../hooks/useTagViews';
import { useSheetDrag } from '../hooks/useSheetDrag';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';
import { TAG_COLORS, UNTAGGED_VIEW_ID } from '../../constants';
import type { Tag, TagMember, TagRole } from '../../types';

interface ViewsSheetProps {
  open: boolean;
  onClose: () => void;
}

type Prompt =
  | { kind: 'new' }
  | { kind: 'rename'; tag: Tag }
  | { kind: 'invite'; tag: Tag }
  | null;

/** The calendar-style switch: a rounded square in the view's color. */
export const ViewCheck = ({ color, on, size = 22 }: { color: string; on: boolean; size?: number }) => (
  <span
    aria-hidden="true"
    className="inline-flex items-center justify-center rounded-[6px] flex-shrink-0 transition-colors"
    style={{
      width: size,
      height: size,
      background: on ? color : 'transparent',
      boxShadow: `inset 0 0 0 2px ${color}`,
    }}
  >
    {on && (
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    )}
  </span>
);

const initialOf = (email: string) => (email[0] ?? '?').toUpperCase();
const roleLabel = (role: TagRole) => (role === 'editor' ? 'Can edit' : 'Can view');

/**
 * The list of views, like the calendar list in Google Calendar: a colored
 * switch per view, a "⋯" for what you can do to it, and a row to make a new
 * one. Sharing a view is a page inside the same sheet, reached by its "⋯"
 * and left with Back.
 */
export const ViewsSheet: React.FC<ViewsSheetProps> = ({ open, onClose }) => {
  const views = useTagViews();
  const { showToast } = useToast();
  const [sharePageTagId, setSharePageTagId] = useState<string | null>(null);
  const [menuTagId, setMenuTagId] = useState<string | null>(null);
  const [colorTagId, setColorTagId] = useState<string | null>(null);
  const [memberMenu, setMemberMenu] = useState<{ tag: Tag; member: TagMember } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tag | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const close = () => {
    onClose();
    setSharePageTagId(null);
  };
  const sheetDrag = useSheetDrag({ onDismiss: close });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !prompt && !menuTagId && !colorTagId) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prompt, menuTagId, colorTagId]);

  if (!open) return null;

  const mine = views.tags.filter(t => t.owner_id === views.userId);
  const sharedWithMe = views.tags.filter(t => t.owner_id !== views.userId);
  const shareTag = sharePageTagId ? views.tags.find(t => t.id === sharePageTagId) ?? null : null;
  const menuTag = menuTagId ? views.tags.find(t => t.id === menuTagId) ?? null : null;
  const colorTag = colorTagId ? views.tags.find(t => t.id === colorTagId) ?? null : null;

  const openMenu = (e: React.MouseEvent<HTMLElement>, tagId: string) => {
    e.stopPropagation();
    anchorRef.current = e.currentTarget;
    setMenuTagId(tagId);
  };

  const failed = (what: string, error: unknown) => {
    logger.error(`[Views] ${what} failed:`, error);
    showToast(`Couldn’t ${what}. Please try again.`);
  };

  const viewRow = (tag: Tag) => {
    const on = !views.hidden.has(tag.id);
    const isMine = tag.owner_id === views.userId;
    const people = tag.members?.length ?? 0;
    const caption = isMine
      ? (people > 0 ? `Shared with ${people} ${people === 1 ? 'person' : 'people'}` : null)
      : 'Shared with you';
    return (
      <div key={tag.id} className="ios-row has-leading" role="group">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Show ${tag.name}`}
          className="flex items-center gap-3 flex-1 min-w-0 -my-[10px] -ml-4 py-[10px] pl-4 ios-press text-left"
          onClick={() => views.toggleView(tag.id)}
        >
          <ViewCheck color={tag.color} on={on} />
          <span className="flex-1 min-w-0">
            <span className="block text-body truncate">{tag.name}</span>
            {caption && <span className="block text-footnote text-ink-2 truncate">{caption}</span>}
          </span>
        </button>
        <button
          type="button"
          className="ios-close !w-[30px] !h-[30px] !shadow-none !bg-surface-2 flex-shrink-0"
          aria-label={`Actions for ${tag.name}`}
          aria-haspopup="menu"
          onClick={e => openMenu(e, tag.id)}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>
    );
  };

  const untaggedOn = !views.hidden.has(UNTAGGED_VIEW_ID);

  const menuGroups = (tag: Tag): ActionSheetItem[][] => {
    const isMine = tag.owner_id === views.userId;
    const groups: ActionSheetItem[][] = [
      [{ label: 'Show Only This View', onSelect: () => views.soloView(tag.id) }],
    ];
    if (isMine) {
      groups.push([
        { label: 'Rename…', onSelect: () => setPrompt({ kind: 'rename', tag }) },
        { label: 'Change Color…', onSelect: () => setColorTagId(tag.id) },
        { label: 'Share…', onSelect: () => setSharePageTagId(tag.id) },
      ]);
      groups.push([{ label: 'Delete', tone: 'danger', onSelect: () => setConfirmDelete(tag) }]);
    } else {
      groups.push([{ label: 'Leave View', tone: 'danger', onSelect: async () => {
        try { await views.leaveView(tag.id); showToast(`Left “${tag.name}”`, 'success'); }
        catch (error) { failed('leave this view', error); }
      } }]);
    }
    return groups;
  };

  const listPage = (
    <div className="px-4 pt-2 space-y-6" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
      {!views.loaded ? (
        <div className="ios-group">
          {[1, 2, 3].map(i => (
            <div key={i} className="ios-row animate-pulse">
              <div className="w-[22px] h-[22px] rounded-[6px] bg-surface-2" />
              <div className="h-3 bg-surface-2 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div>
            <div className="ios-group-label">My views</div>
            <div className="ios-group">
              {mine.map(viewRow)}
              <button type="button" className="ios-row ios-row-press has-leading" onClick={() => setPrompt({ kind: 'new' })}>
                <span className="w-[22px] h-[22px] rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14m7-7H5" /></svg>
                </span>
                <span className="flex-1 text-body text-accent">New View…</span>
              </button>
            </div>
            {mine.length === 0 && (
              <p className="text-footnote text-ink-2 px-4 pt-2">
                A view groups properties: an LLC, a status like Under Contract, a type like Gas Stations. Pins take the view’s color, and a view can be shared with your team.
              </p>
            )}
          </div>

          {sharedWithMe.length > 0 && (
            <div>
              <div className="ios-group-label">Shared with me</div>
              <div className="ios-group">{sharedWithMe.map(viewRow)}</div>
            </div>
          )}

          {views.tags.length > 0 && (
            <div>
              <div className="ios-group">
                <button
                  type="button"
                  role="switch"
                  aria-checked={untaggedOn}
                  className="ios-row ios-row-press has-leading"
                  onClick={() => views.toggleView(UNTAGGED_VIEW_ID)}
                >
                  <ViewCheck color="#8e8e93" on={untaggedOn} />
                  <span className="flex-1 text-body">Properties with no view</span>
                </button>
              </div>
              <p className="text-footnote text-ink-2 px-4 pt-2">
                Switched-off views hide their properties from the map and the Properties list on this device.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  const sharePage = shareTag && (
    <div className="px-4 pt-2 space-y-6" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
      <div>
        <div className="ios-group-label">People</div>
        <div className="ios-group">
          {(shareTag.members ?? []).map(member => (
            <button
              key={member.id}
              type="button"
              className="ios-row ios-row-press has-leading"
              aria-haspopup="menu"
              onClick={e => { anchorRef.current = e.currentTarget; setMemberMenu({ tag: shareTag, member }); }}
            >
              <span className="w-8 h-8 rounded-full bg-surface-2 text-ink-2 text-subhead font-semibold flex items-center justify-center flex-shrink-0" aria-hidden="true">
                {initialOf(member.email)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-body truncate">{member.email}</span>
                <span className="block text-footnote text-ink-2">
                  {roleLabel(member.role)}{member.user_id ? '' : ' · Invited'}
                </span>
              </span>
              <ChevronRightIcon className="ios-chevron w-4 h-4" strokeWidth={2.5} />
            </button>
          ))}
          <button type="button" className="ios-row ios-row-press has-leading" onClick={() => setPrompt({ kind: 'invite', tag: shareTag })}>
            <span className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14m7-7H5" /></svg>
            </span>
            <span className="flex-1 text-body text-accent">Add Person…</span>
          </button>
        </div>
        <p className="text-footnote text-ink-2 px-4 pt-2">
          People you share with see every property in “{shareTag.name}”, and on those properties only the folders and files marked Shared. Your other files stay private. Editors can also upload to shared folders and put their own properties in this view.
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-black/40 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={shareTag ? `Share ${shareTag.name}` : 'Views'}
      onClick={close}
    >
      <div
        className="ios-sheet sm:rounded-[28px] w-full sm:max-w-md flex flex-col overflow-hidden animate-sheet-up"
        style={{ maxHeight: 'min(80dvh, 640px)', height: '80dvh', ...sheetDrag.sheetStyle }}
        onClick={e => e.stopPropagation()}
      >
        <div {...sheetDrag.handleProps}>
          <div className="ios-grabber sm:hidden" />
          <div className="ios-navbar">
            {shareTag ? (
              <button type="button" className="ios-button-plain text-body font-normal -ml-2 flex items-center gap-0.5" onClick={() => setSharePageTagId(null)} aria-label="Back to views">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Views
              </button>
            ) : <span />}
            <h2 className="text-headline font-semibold text-center truncate">{shareTag ? shareTag.name : 'Views'}</h2>
            <button type="button" className="ios-button-plain text-body font-semibold justify-self-end" onClick={close}>
              Done
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-ground">
          {shareTag ? sharePage : listPage}
        </div>
      </div>

      {menuTag && (
        <ActionSheet open onClose={() => setMenuTagId(null)} presentation="popover" anchorRef={anchorRef} title={menuTag.name} groups={menuGroups(menuTag)} />
      )}

      {colorTag && (
        <ActionSheet
          open
          onClose={() => setColorTagId(null)}
          presentation="popover"
          anchorRef={anchorRef}
          title="Color"
          groups={[
            TAG_COLORS.map(c => ({
              label: c.name,
              selected: colorTag.color === c.value,
              leading: <span className="w-4 h-4 rounded-full" style={{ background: c.value }} aria-hidden="true" />,
              onSelect: async () => {
                try { await views.recolorView(colorTag.id, c.value); }
                catch (error) { failed('change the color', error); }
              },
            })),
          ]}
        />
      )}

      {memberMenu && (
        <ActionSheet
          open
          onClose={() => setMemberMenu(null)}
          presentation="popover"
          anchorRef={anchorRef}
          title={memberMenu.member.email}
          groups={[
            (['viewer', 'editor'] as TagRole[]).map(role => ({
              label: roleLabel(role),
              selected: memberMenu.member.role === role,
              onSelect: async () => {
                if (memberMenu.member.role === role) return;
                try { await views.setMemberRole(memberMenu.tag.id, memberMenu.member.id, role); }
                catch (error) { failed('change their access', error); }
              },
            })),
            [{
              label: 'Remove',
              tone: 'danger',
              onSelect: async () => {
                try { await views.unshareView(memberMenu.tag.id, memberMenu.member.id); }
                catch (error) { failed('remove them', error); }
              },
            }],
          ]}
        />
      )}

      {confirmDelete && (
        <ActionSheet
          open
          onClose={() => setConfirmDelete(null)}
          presentation="sheet"
          title={`Delete “${confirmDelete.name}”? Its properties and their files stay; the view disappears for everyone it was shared with.`}
          groups={[[{
            label: 'Delete View',
            tone: 'danger',
            onSelect: async () => {
              try { await views.deleteView(confirmDelete.id); showToast('View deleted', 'success'); }
              catch (error) { failed('delete this view', error); }
            },
          }]]}
        />
      )}

      <InputAlert
        open={prompt?.kind === 'new'}
        title="New View"
        message="Name it after what it groups: an LLC, a status, a property type."
        placeholder="Name"
        confirmLabel="Create"
        onConfirm={async name => {
          try { await views.createView(name); setPrompt(null); }
          catch (error) {
            const m = error instanceof Error ? error.message : '';
            if (m === 'DUPLICATE_TAG') return 'You already have a view with this name.';
            if (m === 'INVALID_NAME') return 'Use up to 40 characters.';
            logger.error('[Views] create failed:', error);
            return 'Couldn’t create the view. Please try again.';
          }
        }}
        onCancel={() => setPrompt(null)}
      />
      <InputAlert
        open={prompt?.kind === 'rename'}
        title="Rename View"
        initialValue={prompt?.kind === 'rename' ? prompt.tag.name : ''}
        placeholder="Name"
        confirmLabel="Rename"
        onConfirm={async name => {
          if (prompt?.kind !== 'rename') return;
          try { await views.renameView(prompt.tag.id, name); setPrompt(null); }
          catch (error) {
            const m = error instanceof Error ? error.message : '';
            if (m === 'DUPLICATE_TAG') return 'You already have a view with this name.';
            if (m === 'INVALID_NAME') return 'Use up to 40 characters.';
            logger.error('[Views] rename failed:', error);
            return 'Couldn’t rename the view. Please try again.';
          }
        }}
        onCancel={() => setPrompt(null)}
      />
      <InputAlert
        open={prompt?.kind === 'invite'}
        title="Add Person"
        message={prompt?.kind === 'invite' ? `They’ll see every property in “${prompt.tag.name}” once they sign in with this email.` : undefined}
        placeholder="Email"
        inputType="email"
        confirmLabel="Add"
        onConfirm={async email => {
          if (prompt?.kind !== 'invite') return;
          try { await views.shareView(prompt.tag.id, email, 'viewer'); setPrompt(null); }
          catch (error) {
            const m = error instanceof Error ? error.message : '';
            if (m === 'DUPLICATE_MEMBER') return 'This person already has access.';
            if (m === 'INVALID_EMAIL') return 'Enter a valid email address.';
            logger.error('[Views] share failed:', error);
            return 'Couldn’t share the view. Please try again.';
          }
        }}
        onCancel={() => setPrompt(null)}
      />
    </div>
  );
};
