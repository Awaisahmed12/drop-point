import { useEffect, useState } from 'react';

// Mobile device detection utility
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 768;
};

// Mobile viewport hook for perfect mobile rendering
export const useMobileViewport = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };

    // Initial check
    checkMobile();

    // Listen for window resize
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Get mobile-optimized modal dimensions with safe area support
  const getModalDimensions = (options?: {
    topMargin?: number;
    sideMargin?: number;
    bottomMargin?: number;
  }) => {
    if (typeof window === 'undefined') return { height: '90vh', margin: '0', maxHeight: '90vh' };
    
    const {
      topMargin = 20,
      sideMargin = 10,
      bottomMargin = 20
    } = options || {};

    const isWeb = !isMobile;
    
    if (isWeb) {
      // Desktop: centered with margins
      return {
        height: '90vh',
        maxHeight: '90vh',
        margin: '0'
      };
    }
    
    // Mobile: explicit height so flex children (scroll area, action bar) are
    // correctly sized. Using `auto` breaks flex-1 because a flex child with
    // flex-1 needs its parent to have a known height.
    const sizeCalc = `calc(100dvh - ${topMargin}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, ${bottomMargin}px))`;
    return {
      height: sizeCalc,
      maxHeight: sizeCalc,
      margin: `calc(${topMargin}px + env(safe-area-inset-top, 0px)) ${sideMargin}px env(safe-area-inset-bottom, ${bottomMargin}px) ${sideMargin}px`
    };
  };

  // Get mobile-optimized container dimensions for full-screen layouts
  const getContainerDimensions = (options?: {
    includeSafeArea?: boolean;
    reserveSpace?: number;
  }) => {
    if (typeof window === 'undefined') return { height: '100vh', padding: '0' };
    
    const {
      includeSafeArea = true,
      reserveSpace = 0
    } = options || {};

    if (!isMobile) {
      return {
        height: '100vh',
        minHeight: '100vh',
        padding: '0'
      };
    }

    // Mobile optimizations
    const baseHeight = '100dvh';
    const adjustedHeight = reserveSpace > 0 ? `calc(100dvh - ${reserveSpace}px)` : baseHeight;
    
    return {
      height: adjustedHeight,
      minHeight: adjustedHeight,
      maxHeight: adjustedHeight,
      padding: includeSafeArea ? 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)' : '0'
    };
  };

  // Get mobile-optimized styles for different component types
  const getMobileStyles = (componentType: 'modal' | 'page' | 'container' | 'input') => {
    const baseStyles: React.CSSProperties = {};

    if (!isMobile) return baseStyles;

    switch (componentType) {
      case 'modal': {
        const h = 'calc(100dvh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 20px))';
        return {
          ...baseStyles,
          height: h,
          maxHeight: h,
          margin: 'calc(20px + env(safe-area-inset-top, 0px)) 10px env(safe-area-inset-bottom, 20px) 10px',
          maxWidth: 'calc(100vw - 20px)'
        };
      }
      
      case 'page':
        return {
          ...baseStyles,
          height: '100dvh',
          minHeight: '100dvh',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        };
      
      case 'container':
        return {
          ...baseStyles,
          maxHeight: '100dvh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        };
      
      case 'input':
        return {
          ...baseStyles,
          fontSize: '16px', // Prevents zoom on iOS
          minHeight: '48px' // Better touch targets
        };
    }
  };

  // Get mobile-optimized positioning for modals and overlays
  const getMobilePositioning = () => {
    if (!isMobile) {
      return {
        alignItems: 'center' as const,
        justifyContent: 'center' as const
      };
    }

    return {
      alignItems: 'flex-start' as const,
      justifyContent: 'center' as const
    };
  };

  return {
    isMobile,
    getModalDimensions,
    getContainerDimensions,
    getMobileStyles,
    getMobilePositioning,
    
    // Utility classes for common patterns
    mobileClasses: {
      modal: isMobile ? 'items-start' : 'items-center',
      fullScreen: 'mobile-viewport-fix mobile-safe-area',
      safeArea: 'mobile-safe-area',
      input: isMobile ? 'text-base' : '', // Prevents zoom
      touchTarget: isMobile ? 'min-h-[48px]' : '' // Better touch targets
    }
  };
};

// Export utility functions for use without hook
export { isMobileDevice as default }; 