/**
 * useMeetingsList Hook
 * Manages the full meetings list: fetching, smart polling, and CRUD actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { MeetingService } from '../../../../services';
import logger from '../../../../utils/logger';

export const useMeetingsList = ({ refreshKey, onMeetingUpdate } = {}) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await MeetingService.getAll();
      setMeetings(
        data.sort((a, b) => {
          const dateA = new Date(a.meeting_date || a.created_at);
          const dateB = new Date(b.meeting_date || b.created_at);
          return dateB - dateA;
        })
      );
      setError(null);
    } catch (err) {
      logger.error('Failed to fetch meetings', err);
      setError('Failed to fetch meetings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch + smart polling
  useEffect(() => {
    fetchMeetings();

    let pollTimeout = null;
    let currentMeetings = [];

    const scheduleNextPoll = () => {
      const hasProcessing = currentMeetings.some(
        (m) => m.status === 'processing' || m.status === 'pending'
      );
      if (hasProcessing) {
        pollTimeout = setTimeout(async () => {
          try {
            const updated = await MeetingService.getAll();
            const sorted = updated.sort((a, b) => {
              const dateA = new Date(a.meeting_date || a.created_at);
              const dateB = new Date(b.meeting_date || b.created_at);
              return dateB - dateA;
            });
            setMeetings(sorted);
            currentMeetings = sorted;
            scheduleNextPoll();
          } catch (_) {}
        }, 15000);
      }
    };

    // Track current meetings in closure
    setMeetings((prev) => {
      currentMeetings = prev;
      return prev;
    });

    const initialTimer = setTimeout(scheduleNextPoll, 5000);
    return () => {
      clearTimeout(initialTimer);
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [refreshKey, fetchMeetings]);

  const rename = useCallback(
    async (meeting, newName) => {
      try {
        await MeetingService.rename(meeting.id, newName.trim());
        setError(null);
        await fetchMeetings();
        onMeetingUpdate?.();
        return true;
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to rename meeting.');
        return false;
      }
    },
    [fetchMeetings, onMeetingUpdate]
  );

  const deleteMeeting = useCallback(
    async (meeting) => {
      try {
        await MeetingService.delete(meeting.id);
        setError(null);
        await fetchMeetings();
        onMeetingUpdate?.();
        return true;
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to delete meeting.');
        return false;
      }
    },
    [fetchMeetings, onMeetingUpdate]
  );

  const regenerateAudio = useCallback(
    async (meeting) => {
      try {
        await MeetingService.regenerateAudio(meeting.id);
        setError(null);
        await fetchMeetings();
        onMeetingUpdate?.();
        return true;
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to regenerate audio.');
        return false;
      }
    },
    [fetchMeetings, onMeetingUpdate]
  );

  const restartProcessing = useCallback(
    async (meeting) => {
      try {
        await MeetingService.restartProcessing(meeting.id);
        setError(null);
        await fetchMeetings();
        onMeetingUpdate?.();
        return true;
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to restart processing.');
        return false;
      }
    },
    [fetchMeetings, onMeetingUpdate]
  );

  const downloadTranscript = useCallback(async (meeting, format = 'txt') => {
    try {
      await MeetingService.download(meeting.id, format, `${meeting.filename}.${format}`);
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to download transcript.');
      return false;
    }
  }, []);

  return {
    meetings,
    isLoading,
    error,
    setError,
    refresh: fetchMeetings,
    actions: { rename, deleteMeeting, regenerateAudio, restartProcessing, downloadTranscript },
  };
};
