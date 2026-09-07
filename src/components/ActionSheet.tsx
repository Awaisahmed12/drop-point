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
}

/**
 * iOS action sheet: a stack of tall buttons rising from the bottom edge with
 * a separate Cancel. Every action is spelled out, grouped, and one tap away;
 * destructive actions are red and last.
 */
export const ActionSheet: React.FC<ActionSheetProps> = ({ open, onClose, title, groups, cancelLabel = 'Cancel' }) => {
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
        <div className="rounded-[14px] overflow-hidden bg-surface/95 backdrop-blur-xl">
          {title && (
            <div className="px-4 py-3 text-center text-footnote text-ink-2 border-b border-hairline/60">
              {title}
            </div>
          )}
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'border-t-[6px] border-ground' : ''}>
              {group.map((item, ii) => (
                <button
                  key={item.label}
                  type="button"
                  className={`flex items-center justify-center gap-2.5 w-full h-[56px] text-[20px] font-normal active:bg-surface-2 ${
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
          className="mt-2 w-full h-[56px] rounded-[14px] bg-surface text-[20px] font-semibold text-accent active:bg-surface-2"
          onClick={onClose}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
};
