/**
 * useSpeakers Hook
 * Manages speaker data for a meeting
 */

import { useState, useEffect, useCallback } from 'react';
import { SpeakerService } from '../../../../services';
import logger from '../../../../utils/logger';

export const useSpeakers = (meetingId) => {
  const [speakers, setSpeakers] = useState([]);
  const [allSpeakers, setAllSpeakers] = useState([]);
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch speakers for meeting
   */
  const fetchSpeakers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await SpeakerService.getForMeeting(meetingId);
      setSpeakers(data);
      return data;
    } catch (err) {
      logger.error('Error fetching speakers:', err);
      setError('Failed to fetch speakers');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  /**
   * Fetch all available speakers
   */
  const fetchAllSpeakers = useCallback(async () => {
    try {
      const data = await SpeakerService.getAll();
      setAllSpeakers(data);
      return data;
    } catch (err) {
      logger.error('Error fetching all speakers:', err);
      return [];
    }
  }, []);

  /**
   * Initial fetch
   */
  useEffect(() => {
    if (!meetingId) return;
    fetchSpeakers();
    fetchAllSpeakers();
  }, [meetingId, fetchSpeakers, fetchAllSpeakers]);

  /**
   * Update speaker
   */
  const updateSpeaker = useCallback(async (speaker) => {
    if (!speaker) return false;
    try {
      setIsLoading(true);
      const data = await SpeakerService.update(speaker.id, speaker);
      setSpeakers((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      setEditingSpeaker(null);
      return true;
    } catch (err) {
      logger.error('Error updating speaker:', err);
      setError('Failed to update speaker');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete speaker
   */
  const deleteSpeaker = useCallback(async (speakerId) => {
    try {
      setIsLoading(true);
      await SpeakerService.delete(speakerId);
      setSpeakers((prev) => prev.filter((s) => s.id !== speakerId));
      return true;
    } catch (err) {
      logger.error('Error deleting speaker:', err);
      setError('Failed to delete speaker');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Add speaker by name
   */
  const addSpeaker = useCallback(
    async (speakerName) => {
      if (!meetingId || !speakerName) return null;
      try {
        setIsLoading(true);
        const data = await SpeakerService.add(meetingId, { name: speakerName });
        setSpeakers((prev) => [...prev, data]);
        // Refresh allSpeakers to include the new name
        fetchAllSpeakers();
        return data;
      } catch (err) {
        logger.error('Error adding speaker:', err);
        setError('Failed to add speaker');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [meetingId, fetchAllSpeakers]
  );

  return {
    // State
    speakers,
    allSpeakers,
    editingSpeaker,
    setEditingSpeaker,
    isLoading,
    error,

    // Actions
    fetchSpeakers,
    fetchAllSpeakers,
    updateSpeaker,
    deleteSpeaker,
    addSpeaker,
  };
};
