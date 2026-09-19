import React from 'react';
import type { PropertyFolder } from '../../types';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';

interface FolderMenuProps {
  folder: PropertyFolder;
  isOpen: boolean;
  onClose: () => void;
  onRename: (folder: PropertyFolder) => void;
  onDelete: (folder: PropertyFolder) => void;
  /** Flip the folder (and everything in it) between private and shared. Only offered on shared properties. */
  onToggleShared?: (folder: PropertyFolder) => void;
  presentation?: 'popover' | 'sheet';
  menuPosition: { top?: number; bottom?: number; left?: number; right?: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
}

const Icon = ({ d }: { d: string }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

/** Two things you can do to a folder: rename it, or delete it once empty. */
export const FolderMenu: React.FC<FolderMenuProps> = ({
  folder,
  isOpen,
  onClose,
  onRename,
  onDelete,
  onToggleShared,
  presentation = 'popover',
  menuPosition,
  menuRef,
}) => {
  if (!isOpen) return null;

  const groups: ActionSheetItem[][] = [
    [
      {
        label: 'Rename…',
        onSelect: () => onRename(folder),
        icon: <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
      },
    ],
    ...(onToggleShared
      ? [[{
          label: folder.visibility === 'shared' ? 'Make Private' : 'Share with Team',
          onSelect: () => onToggleShared(folder),
          icon: folder.visibility === 'shared'
            ? <Icon d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            : <Icon d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />,
        }]]
      : []),
    [
      {
        label: 'Delete',
        tone: 'danger',
        onSelect: () => onDelete(folder),
        icon: <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
      },
    ],
  ];

  if (presentation === 'sheet') {
    return <ActionSheet open onClose={onClose} title={folder.name} groups={groups} />;
  }

  const run = (item: ActionSheetItem) => {
    void item.onSelect();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed w-52 pointer-coarse:w-60 ios-float rounded-[14px] overflow-hidden py-1"
      style={{ zIndex: 999999, ...menuPosition }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className={groupIndex > 0 ? 'border-t border-hairline/60' : ''}>
          {group.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`flex items-center gap-3 w-full text-left px-4 h-11 text-subhead pointer-coarse:text-body ios-row-press ${
                item.tone === 'danger' ? 'text-danger' : 'text-ink'
              }`}
              onClick={e => { e.stopPropagation(); run(item); }}
              onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); run(item); }}
            >
              <span className="flex-1">{item.label}</span>
              <span className="text-ink-2">{item.icon}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};
