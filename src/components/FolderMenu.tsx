import React from 'react';
import type { PropertyFolder } from '../../types';

interface FolderMenuProps {
  folder: PropertyFolder;
  isOpen: boolean;
  onClose: () => void;
  onRename: (folder: PropertyFolder) => void;
  onDelete: (folder: PropertyFolder) => void;
  menuPosition: { top?: number; bottom?: number; left?: number; right?: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export const FolderMenu: React.FC<FolderMenuProps> = ({
  folder,
  isOpen,
  onClose,
  onRename,
  onDelete,
  menuPosition,
  menuRef,
}) => {
  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed w-44 bg-white/95 backdrop-blur-xl border border-gray-200/50 rounded-xl shadow-2xl overflow-hidden"
      style={{
        zIndex: 999999,
        position: 'fixed',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100vh - 16px)',
        ...menuPosition
      }}
    >
      <button
        className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150 border-b border-gray-100/50"
        onClick={e => {
          e.stopPropagation();
          onRename(folder);
          onClose();
        }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Rename
        </div>
      </button>
      <button
        className="block w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-150"
        onClick={e => {
          e.stopPropagation();
          onDelete(folder);
          onClose();
        }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </div>
      </button>
    </div>
  );
};

