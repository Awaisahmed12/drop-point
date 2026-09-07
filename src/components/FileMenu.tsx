import { logger } from '../utils/logger';
import React from 'react';
import type { PropertyFile } from '../../types';
import { getFileSignedUrl } from '../utils/supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface FileMenuProps {
  file: PropertyFile;
  isOpen: boolean;
  onClose: () => void;
  onRename: (file: PropertyFile) => void;
  onMove?: (file: PropertyFile) => void;
  onDuplicate?: (file: PropertyFile) => void;
  onDelete: (file: PropertyFile) => void;
  menuPosition: { top?: number; bottom?: number; left?: number; right?: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void | Promise<void>;
  tone?: 'default' | 'danger';
}

const itemClass = (tone: MenuItem['tone']) =>
  `flex items-center gap-2.5 w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-150 ${
    tone === 'danger'
      ? 'text-red-600 hover:bg-red-50'
      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
  }`;

/**
 * Per-file actions. Grouped so the eye lands on one section at a time
 * (Hick's Law): the primary action, then organizing actions, then the
 * destructive one on its own.
 */
export const FileMenu: React.FC<FileMenuProps> = ({
  file,
  isOpen,
  onClose,
  onRename,
  onMove,
  onDuplicate,
  onDelete,
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

  const groups: MenuItem[][] = [
    [
      {
        label: 'Download',
        onSelect: handleDownload,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
    ],
    [
      {
        label: 'Rename',
        onSelect: () => onRename(file),
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
      },
      ...(onMove
        ? [{
            label: 'Move',
            onSelect: () => onMove(file),
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            ),
          }]
        : []),
      ...(onDuplicate
        ? [{
            label: 'Duplicate',
            onSelect: () => onDuplicate(file),
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            ),
          }]
        : []),
    ],
    [
      {
        label: 'Delete',
        tone: 'danger',
        onSelect: () => onDelete(file),
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
      },
    ],
  ];

  const run = (item: MenuItem) => {
    void item.onSelect();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed w-44 bg-white/95 backdrop-blur-xl border border-gray-200/50 rounded-xl shadow-2xl overflow-hidden py-1"
      style={{
        zIndex: 999999,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        ...menuPosition,
      }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className={groupIndex > 0 ? 'border-t border-gray-100' : ''}>
          {group.map(item => (
            <button
              key={item.label}
              role="menuitem"
              className={itemClass(item.tone)}
              onClick={e => { e.stopPropagation(); run(item); }}
              onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); run(item); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};
