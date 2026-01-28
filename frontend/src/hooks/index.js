/**
 * Custom React hooks for the Meeting Assistant application.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { POLLING, MEETING_STATUS } from '../constants';
import api from '../api';

/**
 * Hook for managing meetings list with automatic polling
 * @param {number} refreshKey - Key to trigger refresh
 * @returns {object} Meetings state and actions
 */
export const useMeetings = (refreshKey = 0) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollTimeoutRef = useRef(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/meetings/');
      const sortedMeetings = response.data.sort((a, b) => {
        const dateA = new Date(a.meeting_date || a.created_at);
        const dateB = new Date(b.meeting_date || b.created_at);
        return dateB - dateA;
      });
      setMeetings(sortedMeetings);
      setError(null);
      return sortedMeetings;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to fetch meetings.';
      setError(errorMessage);
      console.error('Error fetching meetings:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const scheduleNextPoll = useCallback(
    (currentMeetings) => {
      const hasProcessingMeetings = currentMeetings.some(
        (m) => m.status === MEETING_STATUS.PROCESSING || m.status === MEETING_STATUS.PENDING
      );

      if (hasProcessingMeetings) {
        pollTimeoutRef.current = setTimeout(async () => {
          const updatedMeetings = await fetchMeetings();
          scheduleNextPoll(updatedMeetings);
        }, POLLING.NORMAL_INTERVAL);
      }
    },
    [fetchMeetings]
  );

  useEffect(() => {
    fetchMeetings().then(scheduleNextPoll);

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [refreshKey, fetchMeetings, scheduleNextPoll]);

  const refreshMeetings = useCallback(() => {
    return fetchMeetings();
  }, [fetchMeetings]);

  return {
    meetings,
    isLoading,
    error,
    refreshMeetings,
  };
};

/**
 * Hook for managing file upload state
 * @returns {object} Upload state and actions
 */
export const useFileUpload = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const resetUpload = useCallback(() => {
    setUploadProgress(0);
    setIsUploading(false);
    setUploadError(null);
  }, []);

  const uploadFile = useCallback(async (file, options = {}) => {
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);

      if (options.transcriptionLanguage) {
        formData.append('transcription_language', options.transcriptionLanguage);
      }
      if (options.numberOfSpeakers) {
        formData.append('number_of_speakers', options.numberOfSpeakers);
      }

      const response = await api.post('/api/v1/meetings/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      setUploadProgress(100);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Upload failed';
      setUploadError(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    uploadProgress,
    isUploading,
    uploadError,
    uploadFile,
    resetUpload,
  };
};

/**
 * Hook for managing local storage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value
 * @returns {array} [value, setValue]
 */
export const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue) => {
      try {
        setValue(newValue);
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  return [value, setStoredValue];
};

/**
 * Hook for managing async operations with loading state
 * @param {Function} asyncFunction - Async function to execute
 * @returns {object} State and execute function
 */
export const useAsync = (asyncFunction) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      try {
        setLoading(true);
        setError(null);
        const result = await asyncFunction(...args);
        setData(result);
        return result;
      } catch (error) {
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [asyncFunction]
  );

  return { data, loading, error, execute };
};

/**
 * Hook for debouncing values
 * @param {*} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {*} Debounced value
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for managing previous value
 * @param {*} value - Current value
 * @returns {*} Previous value
 */
export const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

/**
 * Hook for managing confirmation dialogs
 * @returns {object} Dialog state and actions
 */
export const useConfirmDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    confirmColor: 'primary',
  });

  const openDialog = useCallback((dialogConfig) => {
    setConfig({
      title: dialogConfig.title || 'Confirm',
      message: dialogConfig.message || 'Are you sure?',
      onConfirm: dialogConfig.onConfirm,
      onCancel: dialogConfig.onCancel,
      confirmLabel: dialogConfig.confirmLabel || 'Confirm',
      cancelLabel: dialogConfig.cancelLabel || 'Cancel',
      confirmColor: dialogConfig.confirmColor || 'primary',
    });
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (config.onConfirm) {
      config.onConfirm();
    }
    closeDialog();
  }, [config, closeDialog]);

  const handleCancel = useCallback(() => {
    if (config.onCancel) {
      config.onCancel();
    }
    closeDialog();
  }, [config, closeDialog]);

  return {
    isOpen,
    config,
    openDialog,
    closeDialog,
    handleConfirm,
    handleCancel,
  };
};

/**
 * Hook for managing form state with validation
 * @param {object} initialValues - Initial form values
 * @param {object} validationRules - Validation rules
 * @returns {object} Form state and actions
 */
export const useForm = (initialValues = {}, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setFieldTouched = useCallback((name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;
      setValue(name, type === 'checkbox' ? checked : value);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (e) => {
      setFieldTouched(e.target.name);
    },
    [setFieldTouched]
  );

  const validate = useCallback(() => {
    const newErrors = {};

    Object.keys(validationRules).forEach((field) => {
      const rules = validationRules[field];
      const value = values[field];

      if (rules.required && !value) {
        newErrors[field] = rules.requiredMessage || 'This field is required';
      } else if (rules.minLength && value && value.length < rules.minLength) {
        newErrors[field] = rules.minLengthMessage || `Minimum ${rules.minLength} characters`;
      } else if (rules.maxLength && value && value.length > rules.maxLength) {
        newErrors[field] = rules.maxLengthMessage || `Maximum ${rules.maxLength} characters`;
      } else if (rules.pattern && value && !rules.pattern.test(value)) {
        newErrors[field] = rules.patternMessage || 'Invalid format';
      } else if (rules.validate) {
        const error = rules.validate(value, values);
        if (error) newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validationRules]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const handleSubmit = useCallback(
    (onSubmit) => async (e) => {
      e?.preventDefault();

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFieldTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    validate,
    reset,
    isValid: Object.keys(errors).length === 0,
  };
};

/**
 * Hook for clipboard operations
 * @returns {object} Clipboard functions and state
 */
export const useClipboard = () => {
  const [copiedValue, setCopiedValue] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);
      setCopySuccess(true);

      // Reset success state after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);

      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopySuccess(false);
      return false;
    }
  }, []);

  return { copy, copiedValue, copySuccess };
};

/**
 * Hook for keyboard shortcuts
 * @param {object} keyMap - Map of key combinations to handlers
 * @param {object} options - Options
 */
export const useKeyboardShortcut = (keyMap, options = {}) => {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      const key = [];

      if (event.ctrlKey || event.metaKey) key.push('ctrl');
      if (event.shiftKey) key.push('shift');
      if (event.altKey) key.push('alt');
      key.push(event.key.toLowerCase());

      const combo = key.join('+');

      if (keyMap[combo]) {
        event.preventDefault();
        keyMap[combo](event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyMap, enabled]);
};

/**
 * Hook for managing toggle state
 * @param {boolean} initialValue - Initial toggle value
 * @returns {array} [value, toggle, setValue]
 */
export const useToggle = (initialValue = false) => {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return [value, toggle, setValue];
};

/**
 * Hook for interval-based updates
 * @param {Function} callback - Function to call on each interval
 * @param {number|null} delay - Interval delay in ms (null to stop)
 */
export const useInterval = (callback, delay) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = () => savedCallback.current();
    const id = setInterval(tick, delay);

    return () => clearInterval(id);
  }, [delay]);
};

/**
 * Hook for detecting clicks outside an element
 * @param {Function} handler - Handler for outside clicks
 * @returns {ref} Ref to attach to the element
 */
export const useClickOutside = (handler) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [handler]);

  return ref;
};
