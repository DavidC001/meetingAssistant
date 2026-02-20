/**
 * Utility formatters — pure functions, no React or service imports.
 *
 * Centralises formatting logic that was previously duplicated inside components.
 */

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string} e.g. "1.5 MB"
 */
export function formatFileSize(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format a duration in seconds to mm:ss or hh:mm:ss.
 * @param {number} totalSeconds
 * @returns {string} e.g. "1:23:45" or "3:07"
 */
export function formatDuration(totalSeconds) {
  if (!totalSeconds && totalSeconds !== 0) return '—';
  const secs = Math.round(totalSeconds);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Format a number with thousands separators.
 * @param {number} value
 * @returns {string} e.g. "1,234"
 */
export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString();
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if needed.
 * @param {string} str
 * @param {number} [maxLength=100]
 * @returns {string}
 */
export function truncate(str, maxLength = 100) {
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
}

/**
 * Capitalise the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
export function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
