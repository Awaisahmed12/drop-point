import { 
  DocumentIcon, 
  DocumentTextIcon, 
  DocumentArrowDownIcon, 
  DocumentChartBarIcon, 
  PhotoIcon, 
  FilmIcon, 
  GifIcon, 
  PresentationChartBarIcon, 
  ArchiveBoxIcon, 
  MusicalNoteIcon, 
  ExclamationTriangleIcon, 
  LockClosedIcon, 
  GlobeAltIcon 
} from '@heroicons/react/24/solid';

// Google Drive-inspired color map
const fileTypeColorMap: Record<string, string> = {
  doc: '#1a73e8', // Google blue
  docx: '#1a73e8',
  xls: '#188038', // Google green
  xlsx: '#188038',
  csv: '#188038',
  ppt: '#e37400', // Google orange
  pptx: '#e37400',
  pdf: '#d93025', // Google red
  png: '#d93025', // Google red for images
  jpg: '#d93025',
  jpeg: '#d93025',
  gif: '#d93025',
  webp: '#d93025',
  mp4: '#a142f4', // Google purple
  mov: '#a142f4',
  avi: '#a142f4',
  webm: '#a142f4',
};

interface FileIconProps {
  type: string;
  size?: number;
}

export function FileIcon({ type, size = 28 }: FileIconProps) {
  const ext = type.toLowerCase();
  const color = fileTypeColorMap[ext] || '#5f6368'; // Google gray fallback
  let IconComponent = DocumentIcon;

  // Map extensions to Heroicons
  if (["doc", "docx", "rtf", "odt"].includes(ext)) IconComponent = DocumentTextIcon;
  else if (["xls", "xlsx", "csv", "ods"].includes(ext)) IconComponent = DocumentChartBarIcon;
  else if (["ppt", "pptx", "odp"].includes(ext)) IconComponent = PresentationChartBarIcon;
  else if (["pdf"].includes(ext)) IconComponent = DocumentArrowDownIcon;
  else if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "svg", "heic"].includes(ext)) IconComponent = PhotoIcon;
  else if (["mp4", "mov", "avi", "webm", "mkv", "wmv"].includes(ext)) IconComponent = FilmIcon;
  else if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) IconComponent = MusicalNoteIcon;
  else if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) IconComponent = ArchiveBoxIcon;
  else if (["gif"].includes(ext)) IconComponent = GifIcon;
  else if (["key", "pem", "cert"].includes(ext)) IconComponent = LockClosedIcon;
  else if (["json", "xml", "html", "js", "ts", "jsx", "tsx", "css", "scss", "py", "java", "c", "cpp", "cs", "rb", "go", "php", "sh", "bat", "sql", "yml", "yaml"].includes(ext)) IconComponent = GlobeAltIcon;
  else if (["exe", "msi", "apk", "dmg", "pkg"].includes(ext)) IconComponent = ExclamationTriangleIcon;
  // fallback: DocumentIcon (neutral) for all other unknowns

  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <IconComponent style={{ width: size, height: size, color }} />
    </div>
  );
} 