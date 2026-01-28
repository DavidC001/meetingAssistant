import {
  APIError,
  parseErrorResponse,
  getUserFriendlyMessage,
  handleAPIError,
  createErrorHandler,
  retryRequest,
  ErrorTypes,
} from '../errorHandler';

describe('APIError', () => {
  it('creates an APIError with all properties', () => {
    const error = new APIError(
      'Test message',
      400,
      'ValidationError',
      { field: 'email' },
      'req-123'
    );

    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('ValidationError');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.requestId).toBe('req-123');
  });

  it('checks if error is a specific type', () => {
    const error = new APIError('Test', 404, ErrorTypes.NOT_FOUND);

    expect(error.isType(ErrorTypes.NOT_FOUND)).toBe(true);
    expect(error.isType(ErrorTypes.VALIDATION)).toBe(false);
  });

  it('identifies client errors (4xx)', () => {
    const error400 = new APIError('Bad request', 400);
    const error404 = new APIError('Not found', 404);
    const error500 = new APIError('Server error', 500);

    expect(error400.isClientError()).toBe(true);
    expect(error404.isClientError()).toBe(true);
    expect(error500.isClientError()).toBe(false);
  });

  it('identifies server errors (5xx)', () => {
    const error400 = new APIError('Bad request', 400);
    const error500 = new APIError('Server error', 500);
    const error502 = new APIError('Bad gateway', 502);

    expect(error400.isServerError()).toBe(false);
    expect(error500.isServerError()).toBe(true);
    expect(error502.isServerError()).toBe(true);
  });

  it('identifies network errors', () => {
    const networkError = new APIError('Network failed', 0, ErrorTypes.NETWORK);
    const apiError = new APIError('API failed', 500, 'InternalError');

    expect(networkError.isNetworkError()).toBe(true);
    expect(apiError.isNetworkError()).toBe(false);
  });
});

describe('parseErrorResponse', () => {
  it('parses network error with no response', () => {
    const error = { message: 'Network Error' };

    const apiError = parseErrorResponse(error);

    expect(apiError.code).toBe(ErrorTypes.NETWORK);
    expect(apiError.statusCode).toBe(0);
    expect(apiError.message).toBe('Network Error');
  });

  it('parses structured API error response', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            code: 'ValidationError',
            message: 'Invalid input',
            details: { field: 'email' },
            request_id: 'req-123',
          },
        },
      },
    };

    const apiError = parseErrorResponse(error);

    expect(apiError.statusCode).toBe(400);
    expect(apiError.code).toBe('ValidationError');
    expect(apiError.message).toBe('Invalid input');
    expect(apiError.details).toEqual({ field: 'email' });
    expect(apiError.requestId).toBe('req-123');
  });

  it('parses simple error detail string', () => {
    const error = {
      response: {
        status: 404,
        data: {
          detail: 'Resource not found',
        },
      },
    };

    const apiError = parseErrorResponse(error);

    expect(apiError.statusCode).toBe(404);
    expect(apiError.message).toBe('Resource not found');
  });

  it('handles unknown error format', () => {
    const error = {
      response: {
        status: 500,
        data: {},
      },
    };

    const apiError = parseErrorResponse(error);

    expect(apiError.statusCode).toBe(500);
    expect(apiError.message).toContain('Request failed');
  });
});

describe('getUserFriendlyMessage', () => {
  it('returns friendly message for network errors', () => {
    const error = new APIError('', 0, ErrorTypes.NETWORK);

    const message = getUserFriendlyMessage(error);

    expect(message).toContain('Unable to connect');
  });

  it('returns friendly message for authentication errors', () => {
    const error = new APIError('', 401);

    const message = getUserFriendlyMessage(error);

    expect(message).toContain('session has expired');
  });

  it('returns friendly message for authorization errors', () => {
    const error = new APIError('', 403);

    const message = getUserFriendlyMessage(error);

    expect(message).toContain('do not have permission');
  });

  it('returns friendly message for not found errors', () => {
    const error = new APIError('Meeting not found', 404);

    const message = getUserFriendlyMessage(error);

    expect(message).toBe('Meeting not found');
  });

  it('returns friendly message for validation errors', () => {
    const error = new APIError('', 400);

    const message = getUserFriendlyMessage(error);

    expect(message).toContain('Invalid request');
  });

  it('returns friendly message for rate limiting', () => {
    const error = new APIError('', 429, 'RateLimitError', { retry_after: 60 });

    const message = getUserFriendlyMessage(error);

    expect(message).toContain('60 seconds');
  });

  it('returns friendly message for server errors', () => {
    const error = new APIError('', 500);

    const message = getUserFriendlyMessage(error);

    expect(message).toContain('unexpected server error');
  });

  it('returns original message as fallback', () => {
    const error = new APIError('Custom error', 418); // I'm a teapot

    const message = getUserFriendlyMessage(error);

    expect(message).toBe('Custom error');
  });
});

describe('handleAPIError', () => {
  it('returns user-friendly message', () => {
    const error = { response: { status: 404, data: { detail: 'Not found' } } };

    const message = handleAPIError(error);

    expect(message).toBe('Not found');
  });

  it('calls custom handler for specific error code', () => {
    const error = {
      response: {
        status: 400,
        data: { error: { code: 'ValidationError', message: 'Invalid' } },
      },
    };
    const customHandler = jest.fn(() => 'Custom message');

    const message = handleAPIError(error, { ValidationError: customHandler });

    expect(customHandler).toHaveBeenCalled();
    expect(message).toBe('Custom message');
  });

  it('calls custom handler for specific status code', () => {
    const error = { response: { status: 404, data: { detail: 'Not found' } } };
    const customHandler = jest.fn(() => 'Custom 404 message');

    const message = handleAPIError(error, { 404: customHandler });

    expect(customHandler).toHaveBeenCalled();
    expect(message).toBe('Custom 404 message');
  });
});

describe('createErrorHandler', () => {
  it('creates error handler that calls notification', () => {
    const showNotification = jest.fn();
    const errorHandler = createErrorHandler(showNotification);

    const error = { response: { status: 500, data: {} } };
    errorHandler(error);

    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('creates error handler with custom handlers', () => {
    const showNotification = jest.fn();
    const customHandler = jest.fn(() => 'Custom message');
    const errorHandler = createErrorHandler(showNotification, {
      ValidationError: customHandler,
    });

    const error = {
      response: {
        status: 400,
        data: { error: { code: 'ValidationError', message: 'Invalid' } },
      },
    };
    errorHandler(error);

    expect(customHandler).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith('Custom message', 'error');
  });
});

describe('retryRequest', () => {
  jest.useFakeTimers();

  it('retries failed request and succeeds', async () => {
    let attempt = 0;
    const requestFn = jest.fn(() => {
      attempt++;
      if (attempt < 3) {
        return Promise.reject({ response: { status: 500 } });
      }
      return Promise.resolve('success');
    });

    const promise = retryRequest(requestFn, 3, 100);

    // Fast-forward timers
    jest.runAllTimers();

    const result = await promise;

    expect(result).toBe('success');
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying after max retries', async () => {
    const requestFn = jest.fn(() => Promise.reject({ response: { status: 500 } }));

    const promise = retryRequest(requestFn, 2, 100);

    jest.runAllTimers();

    await expect(promise).rejects.toThrow();
    expect(requestFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const requestFn = jest.fn(() => Promise.reject({ response: { status: 400 } }));

    await expect(retryRequest(requestFn, 3, 100)).rejects.toThrow();
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  jest.useRealTimers();
});
