interface SkeletonItemProps {
  type?: 'file' | 'folder';
}

export const SkeletonItem = ({ type = 'file' }: SkeletonItemProps) => (
  <div className={`animate-shimmer bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:400%_100%] ${type === 'folder' ? 'h-[40px]' : 'h-[48px]'} rounded-lg mb-2`}>
    <div className="h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
  </div>
); 