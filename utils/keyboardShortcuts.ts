import { useEffect } from 'react';

export type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Common keyboard shortcuts for the map application
export const MAP_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'Escape',
    action: () => {
      // Close modals, dropdowns, etc.
      const modals = document.querySelectorAll('[data-modal]');
      modals.forEach(modal => {
        const closeEvent = new CustomEvent('closeModal');
        modal.dispatchEvent(closeEvent);
      });
    },
    description: 'Close modal or cancel action'
  },
  {
    key: 'Enter',
    action: () => {
      // Trigger search or select current prediction
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput && document.activeElement === searchInput) {
        searchInput.form?.requestSubmit();
      }
    },
    description: 'Search or select current item'
  },
  {
    key: 's',
    ctrl: true,
    action: () => {
      // Save current property
      const saveButton = document.querySelector('[aria-label="Add property"]') as HTMLButtonElement;
      if (saveButton && !saveButton.disabled) {
        saveButton.click();
      }
    },
    description: 'Save current property'
  },
  {
    key: 'f',
    action: () => {
      // Focus search input
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    },
    description: 'Focus search input'
  }
];

// Accessibility helpers
export function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

export function focusTrap(element: HTMLElement) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
  
  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };
  
  element.addEventListener('keydown', handleTabKey);
  
  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
} 