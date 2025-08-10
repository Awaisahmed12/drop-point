import React from 'react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Keyboard shortcuts</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="text-sm text-gray-700 space-y-3">
          <div className="flex items-center justify-between"><span className="font-medium">/</span><span>Focus search</span></div>
          <div className="flex items-center justify-between"><span className="font-medium">N</span><span>Create folder</span></div>
          <div className="flex items-center justify-between"><span className="font-medium">U</span><span>Upload files</span></div>
          <div className="flex items-center justify-between"><span className="font-medium">Esc</span><span>Close dialogs</span></div>
        </div>
      </div>
    </div>
  );
};


