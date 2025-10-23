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

  const scheduleNextPoll = useCallback((currentMeetings) => {
    const hasProcessingMeetings = currentMeetings.some(
      m => m.status === MEETING_STATUS.PROCESSING || m.status === MEETING_STATUS.PENDING
    );

    if (hasProcessingMeetings) {
      pollTimeoutRef.current = setTimeout(async () => {
        const updatedMeetings = await fetchMeetings();
        scheduleNextPoll(updatedMeetings);
      }, POLLING.NORMAL_INTERVAL);
    }
  }, [fetchMeetings]);

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
    refreshMeetings
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
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
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
    resetUpload
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

  const setStoredValue = useCallback((newValue) => {
    try {
      setValue(newValue);
      window.localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

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

  const execute = useCallback(async (...args) => {
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
  }, [asyncFunction]);

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