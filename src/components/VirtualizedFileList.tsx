import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FolderIcon as HeroFolderIcon } from '@heroicons/react/24/solid';
import { FileIcon } from './FileIcon';
import { formatDate, formatFileSize, splitFileNameAndExt, getFileNameWithoutExtension } from '../utils/formatting';
import { PropertyFile, PropertyFolder } from '../types';

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: (PropertyFile | PropertyFolder)[];
    type: 'file' | 'folder';
    onFolderClick?: (id: string) => void;
    renamingFileId: string | null;
    renamingFileName: string;
    setRenamingFileName: (name: string) => void;
    handleRename: (item: PropertyFile | PropertyFolder, name: string) => Promise<void>;
    setRenamingFileId: (id: string | null) => void;
    folderMenuId: string | null;
    setFolderMenuId: (id: string | null) => void;
    fileMenuId: string | null;
    setFileMenuId: (id: string | null) => void;
    folderMenuRef: React.RefObject<HTMLDivElement>;
    fileMenuRef: React.RefObject<HTMLDivElement>;
    handleDeleteFolder: (folder: PropertyFolder) => Promise<void>;
    handleDeleteFile: (file: PropertyFile) => Promise<void>;
    setMoveFileTarget: (file: PropertyFile | null) => void;
    setShowMoveModal: (show: boolean) => void;
  };
}

const Row = ({ index, style, data }: RowProps) => {
  const { items, type } = data;
  const item = items[index];
  
  if (type === 'folder') {
    const folder = item as PropertyFolder;
    return (
      <div style={style}>
        <div
          className="hidden sm:grid grid-cols-12 gap-4 items-center px-3 py-2 hover:bg-gray-100 rounded-lg transition group border border-gray-100 mb-1"
          style={{ cursor: 'pointer', minHeight: 40 }}
          onClick={() => data.onFolderClick?.(folder.id)}
        >
          <div className="col-span-6 flex items-center min-w-0">
            <HeroFolderIcon style={{ width: 28, height: 28, color: '#fbbf24' }} />
            <div className="ml-3 flex-1 min-w-0">
              {data.renamingFileId === folder.id ? (
                <input
                  className="font-semibold text-gray-900 bg-white border border-blue-300 rounded px-1 py-0.5 text-sm w-32"
                  value={data.renamingFileName}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onFocus={e => {
                    const input = e.target as HTMLInputElement;
                    input.setSelectionRange(0, folder.name.length);
                  }}
                  onChange={e => data.setRenamingFileName(e.target.value)}
                  onBlur={async () => {
                    await data.handleRename(folder, data.renamingFileName);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') {
                      data.setRenamingFileId(null);
                      data.setRenamingFileName('');
                    }
                  }}
                />
              ) : (
                <div className="text-gray-900 font-medium truncate">
                  {folder.name}
                </div>
              )}
            </div>
          </div>
          <div className="col-span-3 text-xs text-gray-500">
            {formatDate(folder.created_at)}
          </div>
          <div className="col-span-3 flex items-center justify-end relative">
            <button
              className="p-1 rounded hover:bg-gray-200 group-hover:bg-gray-200"
              style={{ minWidth: 24, minHeight: 24 }}
              onClick={e => {
                e.stopPropagation();
                data.setFileMenuId(null);
                data.setFolderMenuId(data.folderMenuId === folder.id ? null : folder.id);
              }}
              title="Folder actions"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            {data.folderMenuId === folder.id && (
              <div ref={data.folderMenuRef} className="absolute right-0 mt-2 w-40 bg-white border border-blue-200 rounded-lg shadow-xl z-50">
                <button
                  className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    data.setRenamingFileId(folder.id);
                    data.setRenamingFileName(folder.name);
                    data.setFolderMenuId(null);
                  }}
                >Rename</button>
                <button
                  className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    data.handleDeleteFolder(folder);
                  }}
                >Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // File row
  const file = item as PropertyFile;
  const [base, ext] = splitFileNameAndExt(file.file_name);
  return (
    <div style={style}>
      <div
        className="hidden sm:grid grid-cols-12 gap-4 items-center px-3 py-2 hover:bg-gray-100 rounded-lg transition group border border-gray-100 mb-1"
        style={{ cursor: 'pointer', minHeight: 40 }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
            return;
          }
          window.open(`https://bxfydeqjmfjeanapfhpr.supabase.co/storage/v1/object/public/property-files/${file.property_id}/${encodeURIComponent(file.file_name)}`, '_blank');
        }}
      >
        <div className="col-span-6 flex items-center min-w-0">
          <FileIcon
            type={file.file_name.split('.').pop() || 'file'}
            size={28}
          />
          <div className="ml-3 flex-1 min-w-0 text-gray-900 font-medium truncate">
            {data.renamingFileId === file.id ? (
              <span className="flex items-center">
                <input
                  className="font-semibold text-gray-900 bg-white border border-blue-300 rounded px-1 py-0.5 text-sm w-32"
                  value={data.renamingFileName}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onFocus={e => {
                    const input = e.target as HTMLInputElement;
                    input.setSelectionRange(0, base.length);
                  }}
                  onChange={e => data.setRenamingFileName(e.target.value)}
                  onBlur={async () => {
                    const trimmed = data.renamingFileName.trim();
                    const [, newExt] = splitFileNameAndExt(trimmed);
                    const [, oldExt] = splitFileNameAndExt(file.file_name);
                    if (!newExt && oldExt) {
                      alert('File extension cannot be removed. Aborting rename.');
                      data.setRenamingFileId(null);
                      data.setRenamingFileName('');
                      return;
                    }
                    await data.handleRename(file, trimmed);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') {
                      data.setRenamingFileId(null);
                      data.setRenamingFileName('');
                    }
                  }}
                />
                <span className="text-gray-400 text-xs ml-1">{ext}</span>
              </span>
            ) : (
              <span className="text-gray-900 font-medium truncate">
                {getFileNameWithoutExtension(file.file_name)}{ext}
              </span>
            )}
          </div>
        </div>
        <div className="col-span-3 text-xs text-gray-500">
          {formatDate(file.modified_at || file.uploaded_at)}
        </div>
        <div className="col-span-3 flex items-center justify-end relative">
          <span className="hidden sm:inline-block text-xs text-gray-500 mr-2">{formatFileSize(file.file_size)}</span>
          <button
            className="p-1 rounded hover:bg-gray-200 group-hover:bg-gray-200"
            style={{ minWidth: 24, minHeight: 24 }}
            onClick={e => {
              e.stopPropagation();
              data.setFolderMenuId(null);
              data.setFileMenuId(data.fileMenuId === file.id ? null : file.id);
            }}
            title="File actions"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          {data.fileMenuId === file.id && (
            <div ref={data.fileMenuRef} className="absolute right-0 mt-2 w-40 bg-white border border-blue-200 rounded-lg shadow-xl z-50">
              <button
                className="block w-full text-left px-4 py-2 rounded-t-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  data.setRenamingFileId(file.id);
                  data.setRenamingFileName(file.file_name);
                  setTimeout(() => {
                    data.setFileMenuId(null);
                    data.setFolderMenuId(null);
                  }, 50);
                }}
              >Rename</button>
              <button
                className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  data.setMoveFileTarget(file);
                  data.setShowMoveModal(true);
                  data.setFileMenuId(null);
                }}
              >Move</button>
              <button
                className="block w-full text-left px-4 py-2 rounded-none transition-colors duration-100 text-gray-900 bg-white hover:bg-blue-600 hover:text-white font-medium cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  window.open(`https://bxfydeqjmfjeanapfhpr.supabase.co/storage/v1/object/public/property-files/${file.property_id}/${encodeURIComponent(file.file_name)}`, '_blank');
                  data.setFileMenuId(null);
                }}
              >Open</button>
              <button
                className="block w-full text-left px-4 py-2 rounded-b-lg transition-colors duration-100 text-gray-900 bg-white hover:bg-red-600 hover:text-white font-medium cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  data.handleDeleteFile(file);
                }}
              >Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface VirtualizedFileListProps {
  folders: PropertyFolder[];
  files: PropertyFile[];
  onFolderClick: (id: string) => void;
  renamingFileId: string | null;
  renamingFileName: string;
  setRenamingFileName: (name: string) => void;
  handleRename: (item: PropertyFile | PropertyFolder, name: string) => Promise<void>;
  setRenamingFileId: (id: string | null) => void;
  folderMenuId: string | null;
  setFolderMenuId: (id: string | null) => void;
  fileMenuId: string | null;
  setFileMenuId: (id: string | null) => void;
  folderMenuRef: React.RefObject<HTMLDivElement>;
  fileMenuRef: React.RefObject<HTMLDivElement>;
  handleDeleteFolder: (folder: PropertyFolder) => Promise<void>;
  handleDeleteFile: (file: PropertyFile) => Promise<void>;
  setMoveFileTarget: (file: PropertyFile | null) => void;
  setShowMoveModal: (show: boolean) => void;
}

export const VirtualizedFileList: React.FC<VirtualizedFileListProps> = ({
  folders,
  files,
  onFolderClick,
  renamingFileId,
  renamingFileName,
  setRenamingFileName,
  handleRename,
  setRenamingFileId,
  folderMenuId,
  setFolderMenuId,
  fileMenuId,
  setFileMenuId,
  folderMenuRef,
  fileMenuRef,
  handleDeleteFolder,
  handleDeleteFile,
  setMoveFileTarget,
  setShowMoveModal,
}) => {
  return (
    <div className="h-full">
      <AutoSizer>
        {({ height, width }) => (
          <>
            {/* Folders list */}
            {folders.length > 0 && (
              <List
                height={Math.min(folders.length * 48, height / 2)}
                itemCount={folders.length}
                itemSize={48}
                width={width}
                itemData={{
                  items: folders,
                  type: 'folder',
                  onFolderClick,
                  renamingFileId,
                  renamingFileName,
                  setRenamingFileName,
                  handleRename,
                  setRenamingFileId,
                  folderMenuId,
                  setFolderMenuId,
                  setFileMenuId,
                  folderMenuRef,
                  handleDeleteFolder,
                }}
              >
                {Row}
              </List>
            )}
            
            {/* Files list */}
            {files.length > 0 && (
              <List
                height={height - (folders.length > 0 ? Math.min(folders.length * 48, height / 2) : 0)}
                itemCount={files.length}
                itemSize={48}
                width={width}
                itemData={{
                  items: files,
                  type: 'file',
                  renamingFileId,
                  renamingFileName,
                  setRenamingFileName,
                  handleRename,
                  setRenamingFileId,
                  fileMenuId,
                  setFileMenuId,
                  setFolderMenuId,
                  fileMenuRef,
                  handleDeleteFile,
                  setMoveFileTarget,
                  setShowMoveModal,
                }}
              >
                {Row}
              </List>
            )}
          </>
        )}
      </AutoSizer>
    </div>
  );
}; 