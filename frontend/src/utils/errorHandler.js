/**
 * API Error Handler Utility
 *
 * Provides centralized error handling for API requests with:
 * - Consistent error message extraction
 * - Error categorization by type
 * - User-friendly error messages
 * - Request ID tracking for debugging
 */

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, statusCode, code, details, requestId) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /**
   * Check if error is a specific type
   */
  isType(errorType) {
    return this.code === errorType;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError() {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError() {
    return this.statusCode >= 500;
  }

  /**
   * Check if error is a network error
   */
  isNetworkError() {
    return this.code === 'NetworkError';
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    return getUserFriendlyMessage(this);
  }
}

/**
 * Parse error response and extract error information
 */
export function parseErrorResponse(error) {
  // Network error (no response)
  if (!error.response) {
    return new APIError(
      error.message || 'Network error',
      0,
      'NetworkError',
      { originalError: error.message },
      null
    );
  }

  const { status, data } = error.response;

  // API returned structured error
  if (data && data.error) {
    return new APIError(
      data.error.message || 'An error occurred',
      status,
      data.error.code || 'UnknownError',
      data.error.details || {},
      data.error.request_id || null
    );
  }

  // API returned simple error message
  if (data && data.detail) {
    return new APIError(data.detail, status, 'UnknownError', {}, null);
  }

  // Fallback to status code
  return new APIError(`Request failed with status ${status}`, status, 'UnknownError', {}, null);
}

/**
 * Get user-friendly error message based on error type and status code
 */
export function getUserFriendlyMessage(error) {
  // Network errors
  if (error.isNetworkError()) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  // Authentication errors
  if (error.statusCode === 401) {
    return 'Your session has expired. Please log in again.';
  }

  // Authorization errors
  if (error.statusCode === 403) {
    return 'You do not have permission to perform this action.';
  }

  // Not found errors
  if (error.statusCode === 404) {
    return error.message || 'The requested resource was not found.';
  }

  // Validation errors
  if (error.statusCode === 400 || error.statusCode === 422) {
    return error.message || 'Invalid request. Please check your input.';
  }

  // Rate limiting
  if (error.statusCode === 429) {
    const retryAfter = error.details?.retry_after;
    if (retryAfter) {
      return `Too many requests. Please try again in ${retryAfter} seconds.`;
    }
    return 'Too many requests. Please try again later.';
  }

  // Server errors
  if (error.isServerError()) {
    if (error.statusCode === 502 || error.statusCode === 503) {
      return 'The service is temporarily unavailable. Please try again later.';
    }
    return 'An unexpected server error occurred. Please try again later.';
  }

  // Default to original message
  return error.message || 'An unexpected error occurred.';
}

/**
 * Handle API error and show appropriate user notification
 */
export function handleAPIError(error, customHandlers = {}) {
  const apiError = parseErrorResponse(error);

  // Log error for debugging
  console.error('API Error:', {
    message: apiError.message,
    code: apiError.code,
    statusCode: apiError.statusCode,
    requestId: apiError.requestId,
    details: apiError.details,
  });

  // Check for custom handler
  if (customHandlers[apiError.code]) {
    return customHandlers[apiError.code](apiError);
  }

  if (customHandlers[apiError.statusCode]) {
    return customHandlers[apiError.statusCode](apiError);
  }

  // Return user-friendly message
  return apiError.getUserMessage();
}

/**
 * Create an error handler with default notification behavior
 *
 * @param {Function} showNotification - Function to show notification (e.g., toast, alert)
 * @param {Object} customHandlers - Custom error handlers by code or status
 * @returns {Function} Error handler function
 */
export function createErrorHandler(showNotification, customHandlers = {}) {
  return (error) => {
    const message = handleAPIError(error, customHandlers);
    showNotification(message, 'error');
    return message;
  };
}

/**
 * Retry helper for failed requests
 */
export async function retryRequest(
  requestFn,
  maxRetries = 3,
  delayMs = 1000,
  shouldRetry = (error) => error.isServerError() || error.isNetworkError()
) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = parseErrorResponse(error);

      // Don't retry if error is not retryable
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (i === maxRetries - 1) {
        throw lastError;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }

  throw lastError;
}

/**
 * Common error type checks
 */
export const ErrorTypes = {
  NOT_FOUND: 'NotFoundError',
  VALIDATION: 'ValidationError',
  FILE_VALIDATION: 'FileValidationError',
  PROCESSING: 'ProcessingError',
  TRANSCRIPTION: 'TranscriptionError',
  DIARIZATION: 'DiarizationError',
  ANALYSIS: 'AnalysisError',
  EXTERNAL_SERVICE: 'ExternalServiceError',
  LLM_PROVIDER: 'LLMProviderError',
  EMBEDDING: 'EmbeddingError',
  CONFIGURATION: 'ConfigurationError',
  AUTHENTICATION: 'AuthenticationError',
  AUTHORIZATION: 'AuthorizationError',
  RATE_LIMIT: 'RateLimitError',
  NETWORK: 'NetworkError',
};

export default {
  APIError,
  parseErrorResponse,
  getUserFriendlyMessage,
  handleAPIError,
  createErrorHandler,
  retryRequest,
  ErrorTypes,
};
