/**
 * Constants for the Meeting Assistant frontend application.
 */

// API endpoints
export const API_ENDPOINTS = {
  MEETINGS: '/api/v1/meetings',
  SETTINGS: '/api/v1/settings',
  ADMIN: '/api/v1/admin',
  UPLOAD: '/api/v1/meetings/upload',
  HEALTH: '/health'
};

// Meeting statuses
export const MEETING_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Processing stages
export const PROCESSING_STAGES = {
  CONVERSION: 'conversion',
  DIARIZATION: 'diarization',
  TRANSCRIPTION: 'transcription',
  ANALYSIS: 'analysis'
};

// Polling intervals (in milliseconds)
export const POLLING = {
  FAST_INTERVAL: 5000,    // 5 seconds
  NORMAL_INTERVAL: 15000, // 15 seconds
  SLOW_INTERVAL: 30000    // 30 seconds
};

// File upload
export const UPLOAD = {
  MAX_FILE_SIZE_MB: 3000,
  ALLOWED_EXTENSIONS: ['.wav', '.mp3', '.mp4', '.m4a', '.flac'],
  CHUNK_SIZE: 1024 * 1024 // 1MB chunks
};

// UI constants
export const UI = {
  DRAWER_WIDTH: 240,
  MAX_FILENAME_LENGTH: 50,
  DEBOUNCE_DELAY: 300
};

// Theme colors
export const COLORS = {
  PRIMARY: '#1976d2',
  SECONDARY: '#f50057',
  SUCCESS: '#4caf50',
  WARNING: '#ff9800',
  ERROR: '#f44336',
  INFO: '#2196f3'
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  FILE_TOO_LARGE: 'File size exceeds the maximum allowed limit.',
  INVALID_FILE_TYPE: 'Invalid file type. Please select a supported audio/video file.',
  UPLOAD_FAILED: 'File upload failed. Please try again.',
  PROCESSING_FAILED: 'Processing failed. Please restart the processing.',
  MEETING_NOT_FOUND: 'Meeting not found.',
  GENERIC_ERROR: 'An unexpected error occurred. Please try again.'
};

// Success messages
export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: 'File uploaded successfully!',
  MEETING_UPDATED: 'Meeting updated successfully!',
  MEETING_DELETED: 'Meeting deleted successfully!',
  PROCESSING_RESTARTED: 'Processing restarted successfully!'
};