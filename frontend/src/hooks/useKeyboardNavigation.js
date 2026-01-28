import { useEffect, useCallback } from 'react';

/**
 * useKeyboardNavigation Hook
 *
 * Provides keyboard shortcuts for common actions.
 * Returns handlers that can be attached to elements.
 */
const useKeyboardNavigation = (shortcuts = {}) => {
  const handleKeyDown = useCallback(
    (event) => {
      const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
      const modKey = ctrlKey || metaKey; // Support both Ctrl and Cmd

      // Build shortcut key (e.g., "ctrl+k", "shift+n")
      const parts = [];
      if (modKey) parts.push('ctrl');
      if (shiftKey) parts.push('shift');
      if (altKey) parts.push('alt');
      parts.push(key.toLowerCase());
      const shortcutKey = parts.join('+');

      // Check if this shortcut has a handler
      if (shortcuts[shortcutKey]) {
        event.preventDefault();
        shortcuts[shortcutKey]();
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    // Helper to focus first interactive element
    focusFirst: (container) => {
      if (!container) return;
      const firstFocusable = container.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) firstFocusable.focus();
    },

    // Helper to trap focus within container (for modals)
    trapFocus: (container) => {
      if (!container) return () => {};

      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTabKey = (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      };

      container.addEventListener('keydown', handleTabKey);
      return () => container.removeEventListener('keydown', handleTabKey);
    },
  };
};

// Common keyboard shortcuts
export const COMMON_SHORTCUTS = {
  SEARCH: 'ctrl+k',
  NEW_MEETING: 'ctrl+n',
  UPLOAD: 'ctrl+u',
  SETTINGS: 'ctrl+,',
  HELP: 'shift+?',
  CLOSE: 'escape',
  SAVE: 'ctrl+s',
  DELETE: 'delete',
  REFRESH: 'ctrl+r',
};

export default useKeyboardNavigation;
