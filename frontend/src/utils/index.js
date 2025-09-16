/**
 * Utility functions for the Meeting Assistant frontend application.
 */

import { MEETING_STATUS, ERROR_MESSAGES } from '../constants';

/**
 * Format file size in bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    minute: '2-digit'
  }).format(dateObj);
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
};

/**
 * Get meeting status color
 * @param {string} status - Meeting status
 * @returns {string} Material-UI color
 */
export const getStatusColor = (status) => {
  switch (status) {
    case MEETING_STATUS.COMPLETED:
      return 'success';
    case MEETING_STATUS.PROCESSING:
      return 'info';
    case MEETING_STATUS.PENDING:
      return 'warning';
    case MEETING_STATUS.FAILED:
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Get meeting status icon
 * @param {string} status - Meeting status
 * @returns {string} Icon name
 */
export const getStatusIcon = (status) => {
  switch (status) {
    case MEETING_STATUS.COMPLETED:
      return 'CheckCircle';
    case MEETING_STATUS.PROCESSING:
      return 'Schedule';
    case MEETING_STATUS.PENDING:
      return 'Pending';
    case MEETING_STATUS.FAILED:
      return 'Error';
    default:
      return 'Help';
  }
};

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @param {number} maxSizeMB - Maximum file size in MB
 * @param {string[]} allowedExtensions - Allowed file extensions
 * @returns {string|null} Error message or null if valid
 */
export const validateFile = (file, maxSizeMB = 3000, allowedExtensions = ['.wav', '.mp3', '.mp4', '.m4a', '.flac']) => {
  if (!file) {
    return 'Please select a file';
  }
  
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `${ERROR_MESSAGES.FILE_TOO_LARGE} (${formatFileSize(maxSizeBytes)} max)`;
  }
  
  // Check file extension
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return `${ERROR_MESSAGES.INVALID_FILE_TYPE} Allowed: ${allowedExtensions.join(', ')}`;
  }
  
  return null;
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Check if string is valid JSON
 * @param {string} str - String to check
 * @returns {boolean} True if valid JSON
 */
export const isValidJSON = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (err) {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

/**
 * Download file from blob
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};