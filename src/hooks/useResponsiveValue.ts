import { useMobileViewport } from './useMobileViewport';

/**
 * Hook to get responsive values based on mobile/desktop viewport
 * Simplifies isMobile ? mobileValue : desktopValue patterns
 * 
 * @example
 * const padding = useResponsiveValue('px-4 py-4', 'px-4 py-2');
 * const textSize = useResponsiveValue('text-base', 'text-sm');
 * const className = useResponsiveValue('mobile-class', 'desktop-class');
 */
export const useResponsiveValue = <T,>(
  mobileValue: T,
  desktopValue: T
): T => {
  const { isMobile } = useMobileViewport();
  return isMobile ? mobileValue : desktopValue;
};

/**
 * Hook to get responsive className strings
 * Automatically handles spacing between classes
 * 
 * @example
 * const className = useResponsiveClass('text-base p-4', 'text-sm p-2');
 * const className = useResponsiveClass('text-base', 'text-sm', 'shared-class');
 */
export const useResponsiveClass = (
  mobileClass: string,
  desktopClass: string,
  sharedClass?: string
): string => {
  const { isMobile } = useMobileViewport();
  const responsiveClass = isMobile ? mobileClass : desktopClass;
  return sharedClass ? `${responsiveClass} ${sharedClass}` : responsiveClass;
};

