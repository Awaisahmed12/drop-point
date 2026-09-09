import { logger } from '../utils/logger';
import React from 'react';
import type { PropertyFile } from '../../types';
import { getFileSignedUrl } from '../utils/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';

interface FileMenuProps {
  file: PropertyFile;
  isOpen: boolean;
  onClose: () => void;
  onRename: (file: PropertyFile) => void;
  onMove?: (file: PropertyFile) => void;
  onDuplicate?: (file: PropertyFile) => void;
  onDelete: (file: PropertyFile) => void;
  /** `popover` (default) is an anchored menu; `sheet` is kept for confirmations. */
  presentation?: 'popover' | 'sheet';
  menuPosition: { top?: number; bottom?: number; left?: number; right?: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
}

const Icon = ({ d, extra }: { d: string; extra?: React.ReactNode }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    {extra}
  </svg>
);

/**
 * Per-file actions in three groups so the eye lands on one section at a
 * time: the primary action, organizing actions, then the destructive one.
 */
export const FileMenu: React.FC<FileMenuProps> = ({
  file,
  isOpen,
  onClose,
  onRename,
  onMove,
  onDuplicate,
  onDelete,
  presentation = 'popover',
  menuPosition,
  menuRef,
}) => {
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const fileUrl = await getFileSignedUrl(file.property_id, file.file_name, true);
      window.open(fileUrl, '_blank');
    } catch (error) {
      logger.error('Error downloading file:', error);
      showToast('Unable to download file. Please try again.');
    }
  };

  const groups: ActionSheetItem[][] = [
    [
      {
        label: 'Download',
        onSelect: handleDownload,
        icon: <Icon d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
      },
    ],
    [
      {
        label: 'Rename…',
        onSelect: () => onRename(file),
        icon: <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
      },
      ...(onMove
        ? [{
            label: 'Move to Folder…',
            onSelect: () => onMove(file),
            icon: <Icon d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
          }]
        : []),
      ...(onDuplicate
        ? [{
            label: 'Duplicate',
            onSelect: () => onDuplicate(file),
            icon: <Icon d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" extra={<rect x="9" y="9" width="11" height="11" rx="2" />} />,
          }]
        : []),
    ],
    [
      {
        label: 'Delete',
        tone: 'danger',
        onSelect: () => onDelete(file),
        icon: <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
      },
    ],
  ];

  if (presentation === 'sheet') {
    return <ActionSheet open onClose={onClose} title={file.file_name} groups={groups} />;
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
