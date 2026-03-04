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
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.meeting_date || a.created_at);
        const dateB = new Date(b.meeting_date || b.created_at);
        return dateB - dateA;
      });
      setMeetings(sorted);
      setError(null);
      return sorted; // return data so callers can use it directly
    } catch (err) {
      logger.error('Failed to fetch meetings', err);
      setError('Failed to fetch meetings.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch + smart polling.
  // FIX: previously `currentMeetings` was captured from a synchronous
  // `setMeetings(prev => ...)` call that ran before the async fetchMeetings
  // resolved, so it was always [] and polling never started.
  useEffect(() => {
    let pollTimeout = null;
    let cancelled = false;

    const POLL_INTERVAL_MS = 5000;

    const doPoll = async (latestData) => {
      if (cancelled) return;
      const hasProcessing = (latestData || []).some(
        (m) => m.status === 'processing' || m.status === 'pending'
      );
      if (!hasProcessing) return; // no active jobs — stop polling

      pollTimeout = setTimeout(async () => {
        if (cancelled) return;
        try {
          const updated = await MeetingService.getAll();
          const sorted = updated.sort((a, b) => {
            const dateA = new Date(a.meeting_date || a.created_at);
            const dateB = new Date(b.meeting_date || b.created_at);
            return dateB - dateA;
          });
          if (!cancelled) {
            setMeetings(sorted);
            doPoll(sorted); // schedule next poll based on fresh data
          }
        } catch (_) {
          if (!cancelled) doPoll(latestData); // keep polling on transient error
        }
      }, POLL_INTERVAL_MS);
    };

    const initialize = async () => {
      const data = await fetchMeetings();
      if (!cancelled && data) {
        doPoll(data); // start polling only after we have real data
      }
    };

    initialize();

    return () => {
      cancelled = true;
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
