import { logger } from '../src/utils/logger';
// Debounce function for search inputs and other frequent events
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for scroll events and other high-frequency events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Memoization helper for expensive calculations
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Lazy loading helper for images
export function lazyLoadImage(img: HTMLImageElement, src: string) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        img.src = src;
        observer.unobserve(img);
      }
    });
  });
  
  observer.observe(img);
  return () => observer.unobserve(img);
}

// Virtual scrolling helper for large lists
export function createVirtualScroller<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  scrollTop: number
) {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  return {
    visibleItems: items.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    totalHeight: items.length * itemHeight,
    offsetY: startIndex * itemHeight
  };
}

// Performance monitoring
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  
  mark(name: string) {
    this.marks.set(name, performance.now());
  }
  
  measure(name: string, startMark: string, endMark: string) {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    
    if (start && end) {
      const duration = end - start;
      logger.debug(`${name}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    
    return 0;
  }
  
  clear() {
    this.marks.clear();
  }
}

// Batch updates helper
export function batchUpdates<T>(
  updates: (() => void)[],
  batchSize: number = 10
) {
  return new Promise<void>((resolve) => {
    let index = 0;
    
    function processBatch() {
      const batch = updates.slice(index, index + batchSize);
      
      if (batch.length === 0) {
        resolve();
        return;
      }
      
      batch.forEach(update => update());
      index += batchSize;
      
      // Use requestAnimationFrame for smooth UI updates
      requestAnimationFrame(processBatch);
    }
    
    processBatch();
  });
}

// Memory management helper
export function cleanupResources() {
  // Clear any cached data
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }
  
  // Clear any stored data if needed
  // localStorage.clear(); // Uncomment if you want to clear localStorage
  
  // Force garbage collection (if available)
  if ('gc' in window) {
    (window as any).gc();
  }
} 
