import React, { useState, useMemo } from 'react';
import { HomeIcon, FolderIcon, ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const toggleExpanded = (nodeId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  function renderTree(nodes: FolderWithChildren[], depth = 0) {
    return nodes.map(node => {
      const isExpanded = expanded.has(node.id);
      const isSelected = selected === node.id;
      const isHovered = hoveredId === node.id;
      const isInvalid = invalidTargetIds.has(node.id);
      const hasChildren = node.children.length > 0;

      return (
        <div key={node.id} className="select-none">
          <div 
            className={`flex items-center group transition-all duration-200 rounded-lg mx-1 my-0.5 ${
              isInvalid 
                ? 'opacity-40 cursor-not-allowed' 
                : 'cursor-pointer hover:shadow-sm'
            } ${
              isSelected 
                ? 'bg-gradient-to-r from-accent to-accent text-white shadow-md' 
                : isHovered 
                  ? 'bg-accent-soft border border-accent/40' 
                  : 'hover:bg-surface-2'
            }`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
            onClick={() => !isInvalid && setSelected(node.id)}
            onMouseEnter={() => !isInvalid && setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Expand/Collapse Button */}
            <div className="w-6 h-6 flex items-center justify-center mr-1">
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(node.id);
                  }}
                  className={`w-5 h-5 flex items-center justify-center rounded transition-all duration-200 ${
                    isSelected 
                      ? 'text-white hover:bg-surface/20' 
                      : 'text-ink-3 hover:text-accent hover:bg-accent-soft'
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="w-5 h-5" />
              )}
            </div>

            {/* Folder Icon */}
            <div className="w-6 h-6 flex items-center justify-center mr-3">
              <FolderIcon 
                className={`w-5 h-5 transition-colors duration-200 ${
                  isSelected 
                    ? 'text-white' 
                    : isInvalid 
                      ? 'text-ink-3'
                      : 'text-warning'
                }`} 
              />
            </div>

            {/* Folder Name */}
            <div className={`flex-1 py-3 pr-3 font-medium transition-colors duration-200 ${
              isSelected 
                ? 'text-white' 
                : isInvalid 
                  ? 'text-ink-3'
                  : 'text-ink'
            }`}>
              {node.name}
            </div>

            {/* Selection Indicator */}
            {isSelected && (
              <div className="w-6 h-6 flex items-center justify-center mr-2">
                <div className="w-2 h-2 bg-surface rounded-full animate-pulse" />
              </div>
            )}
          </div>

          {/* Children */}
          {isExpanded && hasChildren && (
            <div className="overflow-hidden">
              <div className="transform transition-all duration-300 ease-out">
                {renderTree(node.children, depth + 1)}
              </div>
            </div>
          )}
        </div>
      );
    });
  }

  // Compute disabled state for Move Here button
  const moveDisabled = selected === currentFolderId || (currentItemType === 'folder' && selected && invalidTargetIds.has(selected));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col border border-hairline overflow-hidden transform transition-all duration-300 animate-scale-in"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline bg-gradient-to-r from-ground to-surface">
          <h2 className="text-xl font-bold text-ink flex items-center">
            <div className="w-8 h-8 bg-accent-soft rounded-lg flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            Choose Destination
          </h2>
          <p className="text-sm text-ink-2 mt-1 ml-11">
            Select where to move your {currentItemType}
          </p>
        </div>

        {/* Folder Tree Container */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto px-4 py-4" style={{ maxHeight: '400px' }}>
            {/* Root Option */}
            <div 
              className={`flex items-center group transition-all duration-200 rounded-lg mx-1 mb-2 cursor-pointer hover:shadow-sm ${
                selected === null 
                  ? 'bg-gradient-to-r from-accent to-accent text-white shadow-md' 
                  : hoveredId === 'root'
                    ? 'bg-accent-soft border border-accent/40' 
                    : 'hover:bg-surface-2'
              }`}
              onClick={() => setSelected(null)}
              onMouseEnter={() => setHoveredId('root')}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="w-6 h-6 ml-3 mr-4">
                <HomeIcon 
                  className={`w-5 h-5 transition-colors duration-200 ${
                    selected === null ? 'text-white' : 'text-accent'
                  }`} 
                />
              </div>
              <div className={`flex-1 py-3 pr-3 font-semibold transition-colors duration-200 ${
                selected === null ? 'text-white' : 'text-ink'
              }`}>
                Root Folder
              </div>
              {selected === null && (
                <div className="w-6 h-6 flex items-center justify-center mr-2">
                  <div className="w-2 h-2 bg-surface rounded-full animate-pulse" />
                </div>
              )}
            </div>

            {/* Folder Tree */}
            {tree.length > 0 ? (
              <div className="space-y-0.5">
                {renderTree(tree)}
              </div>
            ) : (
              <div className="text-center py-8 text-ink-3">
                <FolderIcon className="w-12 h-12 mx-auto mb-3 text-ink-3" />
                <p className="font-medium">No folders created yet</p>
                <p className="text-sm">Create a folder to organize your files</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-hairline bg-ground flex gap-3">
          <button
            className="flex-1 bg-surface-2 text-ink rounded-xl px-4 py-3 font-semibold text-base transition-all duration-200 hover:bg-ink-3 hover:shadow-sm active:scale-95"
            onClick={() => {
              onCancel();
            }}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`flex-1 rounded-xl px-4 py-3 font-semibold text-base transition-all duration-200 active:scale-95 ${
              moveDisabled 
                ? 'bg-surface-2 text-ink-3 cursor-not-allowed' 
                : 'bg-gradient-to-r from-accent to-accent text-white hover:from-accent hover:to-accent shadow-lg hover:shadow-xl'
            }`}
            onClick={() => {
              const target = selected === undefined ? null : selected;
              onMove(target);
              try {
                window.dispatchEvent(new CustomEvent('droppoint-move-request', {
                  detail: {
                    itemId: currentItemId,
                    itemType: currentItemType,
                    currentFolderId,
                    targetFolderId: target,
                  }
                }));
              } catch {
                // ignore event dispatch failures
              }
            }}
            type="button"
            disabled={!!moveDisabled}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveModal; 