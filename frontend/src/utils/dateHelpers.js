/**
 * Date-related utility functions
 * Centralized date formatting and manipulation helpers
 */

/**
 * Format date to human readable format
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
  if (!date) return 'Unknown';

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

/**
 * Format date in short format (e.g., "Jan 15, 2024")
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date
 */
export const formatDateShort = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format relative date (e.g., "2 days ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatRelativeDate = (date) => {
  if (!date) return 'Unknown';

  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
};

/**
 * Check if date is overdue
 * @param {string|Date} dateString - Date to check
 * @returns {boolean} True if date is in the past
 */
export const isOverdue = (dateString) => {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
};

/**
 * Format duration in seconds to human readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get the date in YYYY-MM-DD format
 * @param {string|Date} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
export const getISODate = (date) => {
  if (!date) return null;
  const dateObj = new Date(date);
  return dateObj.toISOString().split('T')[0];
};

/**
 * Get date chip display info for action item cards
 * @param {string|Date} dateString - Due date to evaluate
 * @returns {{ text: string, isOverdue: boolean, isToday: boolean }}
 */
export const getDateChipInfo = (dateString) => {
  if (!dateString) return { text: '', isOverdue: false, isToday: false };
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return { text: '', isOverdue: false, isToday: false };
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isOverdue = date < now && !isToday;
  return {
    text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isOverdue,
    isToday,
  };
};
