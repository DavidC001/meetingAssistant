/**
 * Base API configuration and client setup.
 *
 * This module provides:
 * - Centralized axios instance configuration
 * - Request/response interceptors for error handling
 * - Automatic token management (if needed in future)
 * - Request retry logic
 */

import axios from 'axios';

/**
 * Base axios client with default configuration.
 * Uses empty baseURL so axios uses the current origin automatically.
 */
const apiClient = axios.create({
  baseURL: '',
  timeout: 120000, // 2 minutes for large file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Debug logging
console.log('API Client initialized with baseURL:', apiClient.defaults.baseURL);

/**
 * Request interceptor for adding auth headers and logging.
 */
apiClient.interceptors.request.use(
  (config) => {
    // Add any auth headers here if needed in future
    // const token = localStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for centralized error handling.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract error details
    const errorResponse = {
      message: 'An unexpected error occurred',
      status: error.response?.status || 500,
      code: error.response?.data?.error || 'UNKNOWN_ERROR',
      details: error.response?.data?.details || null,
    };

    if (error.response) {
      // Server responded with error
      errorResponse.message =
        error.response.data?.message ||
        error.response.data?.detail ||
        `Error: ${error.response.status}`;
    } else if (error.request) {
      // Request was made but no response
      errorResponse.message = 'Network error. Please check your connection.';
      errorResponse.code = 'NETWORK_ERROR';
    }

    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', errorResponse);
    }

    // Attach enriched error info
    error.apiError = errorResponse;
    return Promise.reject(error);
  }
);

/**
 * Helper to build query strings from objects.
 * @param {Object} params - Key-value pairs for query parameters
 * @returns {string} Encoded query string
 */
export const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

/**
 * Helper for downloading blob responses as files.
 * @param {Blob} blob - The blob data
 * @param {string} filename - Desired filename
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default apiClient;
