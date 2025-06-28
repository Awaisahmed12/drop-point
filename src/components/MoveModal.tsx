import React, { useState, useMemo } from 'react';
import type { PropertyFolder } from '../../types';

interface MoveModalProps {
  open: boolean;
  folders: PropertyFolder[];
  currentItemId: string;
  currentItemType: 'file' | 'folder';
  currentFolderId: string | null;
  onMove: (targetFolderId: string | null) => void;
  onCancel: () => void;
}

type FolderWithChildren = PropertyFolder & { children: FolderWithChildren[] };

// Helper to build a tree from flat folder list
function buildFolderTree(folders: PropertyFolder[]): FolderWithChildren[] {
  const map: Record<string, FolderWithChildren> = {};
  folders.forEach(f => {
    map[f.id] = { ...f, children: [] };
  });
  const roots: FolderWithChildren[] = [];
  Object.values(map).forEach(f => {
    if (f.parent_id && map[f.parent_id]) {
      map[f.parent_id].children.push(f);
    } else {
      roots.push(f);
    }
  });
  return roots;
}

// Helper to get all descendant ids of a folder
function getDescendantIds(folder: PropertyFolder, folders: PropertyFolder[]): Set<string> {
  const descendants = new Set<string>();
  function dfs(id: string) {
    folders.filter(f => f.parent_id === id).forEach(child => {
      descendants.add(child.id);
      dfs(child.id);
    });
  }
  dfs(folder.id);
  return descendants;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  open,
  folders,
  currentItemId,
  currentItemType,
  currentFolderId,
  onMove,
  onCancel,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(currentFolderId ?? null);

  // Find the folder being moved (if moving a folder)
  const currentFolder = useMemo(() =>
    currentItemType === 'folder' ? folders.find(f => f.id === currentItemId) : null,
    [currentItemType, currentItemId, folders]
  );

  // Prevent moving a folder into itself or its descendants
  const invalidTargetIds = useMemo(() => {
    if (currentItemType !== 'folder' || !currentFolder) return new Set<string>();
    const ids = getDescendantIds(currentFolder, folders);
    ids.add(currentFolder.id); // Can't move into itself
    return ids;
  }, [currentItemType, currentFolder, folders]);

  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  function renderTree(nodes: FolderWithChildren[], depth = 0) {
    return nodes.map(node => {
      const isExpanded = expanded.has(node.id);
      const isInvalid = invalidTargetIds.has(node.id);
      return (
        <div key={node.id} style={{ marginLeft: depth * 18 }} className="flex items-center gap-1 py-1">
          {node.children.length > 0 && (
            <button
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 focus:outline-none"
              onClick={() => {
                setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                  return next;
                });
              }}
              tabIndex={-1}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              {isExpanded ? (
                <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
          )}
          <button
            className={`flex-1 text-left px-2 py-1 rounded transition-all ${selected === node.id ? 'bg-blue-600 text-white font-bold' : isInvalid ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:bg-blue-100 text-gray-900'}`}
            disabled={isInvalid}
            onClick={() => setSelected(node.id)}
            type="button"
          >
            {node.name}
          </button>
          {isExpanded && node.children.length > 0 && (
            <div className="w-full">{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  }

  // Compute disabled state for Move Here button
  const moveDisabled = selected === currentFolderId || (currentItemType === 'folder' && selected && invalidTargetIds.has(selected));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div
        className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl p-6 w-11/12 max-w-xs flex flex-col gap-4 border border-blue-100 relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-lg font-bold text-gray-900 mb-2">Move to...</div>
        <div className="max-h-64 overflow-y-auto rounded bg-white/60 border border-blue-50 p-2">
          <button
            className={`w-full text-left px-2 py-1 rounded mb-1 transition-all ${selected === null ? 'bg-blue-600 text-white font-bold' : 'hover:bg-blue-100 text-gray-900'}`}
            onClick={() => setSelected(null)}
            disabled={currentFolderId === null}
            type="button"
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9" />
              </svg>
              Root
            </span>
          </button>
          {renderTree(tree)}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className={`flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 font-semibold text-base transition-all ${moveDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            onClick={() => {
              if (moveDisabled) return;
              onMove(selected);
            }}
            type="button"
            disabled={!!moveDisabled}
          >Move Here</button>
          <button
            className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-3 py-2 font-semibold text-base hover:bg-gray-200"
            onClick={onCancel}
            type="button"
          >Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default MoveModal; 