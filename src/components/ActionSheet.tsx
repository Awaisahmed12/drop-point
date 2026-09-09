import React, { useEffect } from 'react';

export interface ActionSheetItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void | Promise<void>;
  tone?: 'default' | 'danger';
  /** Renders with a checkmark; use for the current choice in a picker. */
  selected?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  /** Optional line above the actions, describing what they act on. */
  title?: string;
  /** Actions in visual groups. A hairline separates groups; a gap separates groups from Cancel. */
  groups: ActionSheetItem[][];
  cancelLabel?: string;
  /** `popover` (default): a menu anchored to `anchorRef`. `sheet`: an action sheet for follow-up choices. */
  presentation?: 'sheet' | 'popover';
  anchorRef?: React.RefObject<HTMLElement | null>;
}

/** Place a menu under its anchor, above it when there's no room below, and always on screen. */
function placePopover(menu: HTMLElement, anchor: HTMLElement | null | undefined) {
  if (!anchor) {
    Object.assign(menu.style, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
    return;
  }
  const margin = 8;
  const r = anchor.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.max(margin, Math.min(r.right - width, window.innerWidth - width - margin));
  menu.style.left = `${left}px`;
  if (r.bottom + margin + height <= window.innerHeight - margin) menu.style.top = `${r.bottom + margin}px`;
  else if (r.top - margin - height >= margin) menu.style.bottom = `${window.innerHeight - r.top + margin}px`;
  else menu.style.top = `${Math.max(margin, window.innerHeight - margin - height)}px`;
}

/**
 * Two presentations of one list of actions.
 *
 * `popover` (the default for anything a "⋯" or "+" reveals): an anchored menu,
 * grouped by separators, destructive items red and last, 44pt rows on touch.
 * `sheet`: an iOS action sheet for choices that follow an action (confirming a
 * discard, say). Per the HIG the destructive choice comes first there, and a
 * separate Cancel sits at the bottom.
 */
export const ActionSheet: React.FC<ActionSheetProps> = ({ open, onClose, title, groups, cancelLabel = 'Cancel', presentation = 'popover', anchorRef }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = (item: ActionSheetItem) => {
    onClose();
    void item.onSelect();
  };

  if (presentation === 'popover') {
    return (
      <div className="fixed inset-0 z-[100000]" onClick={onClose}>
        <div
          role="menu"
          aria-label={title || 'Actions'}
          className="fixed ios-float rounded-[14px] overflow-y-auto py-1 animate-fade-in w-max min-w-[224px] pointer-coarse:min-w-[260px] max-w-[min(320px,calc(100vw-16px))] max-h-[calc(100dvh-16px)]"
          ref={el => { if (el) placePopover(el, anchorRef?.current); }}
          onClick={e => e.stopPropagation()}
        >
          {title && (
            <div className="px-4 py-2 text-caption text-ink-2 truncate border-b border-hairline/60">{title}</div>
          )}
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'border-t border-hairline/60' : ''}>
              {group.map(item => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={`flex items-center gap-3 w-full text-left px-4 h-10 text-subhead pointer-coarse:h-11 pointer-coarse:text-body ios-row-press ${
                    item.tone === 'danger' ? 'text-danger' : 'text-ink'
                  }`}
                  onClick={() => run(item)}
                >
                  <span className={`flex-1 whitespace-nowrap ${item.selected ? 'font-semibold' : ''}`}>{item.label}</span>
                  {item.selected && (
                    <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {item.icon && <span className="text-ink-2">{item.icon}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100000] flex flex-col justify-end bg-black/40 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Actions'}
      onClick={onClose}
      onTouchMove={e => e.preventDefault()}
    >
      <div
        className="px-2 animate-sheet-up"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 8px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="glass rounded-[26px] overflow-hidden">
          {title && (
            <div className="px-4 py-3 text-center text-footnote text-ink-2 border-b border-hairline/60">
              {title}
            </div>
          )}
          {[...groups]
            .sort((a, b) => Number(b.some(i => i.tone === 'danger')) - Number(a.some(i => i.tone === 'danger')))
            .map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'border-t-[6px] border-black/5' : ''}>
              {group.map((item, ii) => (
                <button
                  key={item.label}
                  type="button"
                  className={`flex items-center justify-center gap-2.5 w-full h-[56px] text-[19px] font-normal active:bg-black/5 ${
                    ii > 0 ? 'border-t border-hairline/60' : ''
                  } ${item.tone === 'danger' ? 'text-danger' : 'text-accent'}`}
                  onClick={() => run(item)}
                >
                  {item.icon && <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>}
                  <span className={item.selected ? 'font-semibold' : ''}>{item.label}</span>
                  {item.selected && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="glass mt-2 w-full h-[56px] rounded-full text-[19px] font-semibold text-accent active:bg-black/5"
          onClick={onClose}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
};
