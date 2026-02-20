/**
 * useMeetingDetail Hook
 * Manages meeting data fetching, updates, and related operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MeetingService, AttachmentService } from '../../../../services';
import logger from '../../../../utils/logger';

export const useMeetingDetail = (meetingId) => {
  // Meeting state
  const [meeting, setMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  // Metadata state
  const [tags, setTags] = useState([]);
  const [folder, setFolder] = useState('');
  const [notes, setNotes] = useState('');
  const [availableFolders, setAvailableFolders] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // Attachments
  const [attachments, setAttachments] = useState([]);

  // Smart polling refs
  const pollTimeoutRef = useRef(null);
  const pollCountRef = useRef(0);

  /**
   * Fetch meeting details
   */
  const fetchMeetingDetails = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) setIsLoading(true);
        else setIsUpdating(true);

        const meetingData = await MeetingService.getById(meetingId);
        setMeeting(meetingData);
        setTags(
          meetingData.tags
            ? meetingData.tags
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t)
            : []
        );
        setFolder(meetingData.folder || '');
        setNotes(meetingData.notes || '');
        setError(null);

        return meetingData;
      } catch (err) {
        logger.error('Error fetching meeting details:', err);
        setError('Failed to fetch meeting details.');
        return null;
      } finally {
        if (isInitial) setIsLoading(false);
        else setIsUpdating(false);
      }
    },
    [meetingId]
  );

  /**
   * Fetch attachments for meeting
   */
  const fetchAttachments = useCallback(async () => {
    try {
      const data = await AttachmentService.getForMeeting(meetingId);
      setAttachments(data);
    } catch (err) {
      logger.error('Error fetching attachments:', err);
    }
  }, [meetingId]);

  /**
   * Fetch available folders for autocomplete
   */
  const fetchAvailableFolders = useCallback(async () => {
    try {
      const response = await MeetingService.getAll();
      const folders = [
        ...new Set(response.map((m) => m.folder).filter((f) => f && f !== 'Uncategorized')),
      ];
      setAvailableFolders(folders.sort());
    } catch (err) {
      logger.error('Error fetching available folders:', err);
    }
  }, []);

  /**
   * Fetch available tags for autocomplete
   */
  const fetchAvailableTags = useCallback(async () => {
    try {
      const data = await MeetingService.getAllTags();
      setAvailableTags(data);
    } catch (err) {
      logger.error('Error fetching available tags:', err);
    }
  }, []);

  /**
   * Start smart polling based on meeting status
   */
  const startSmartPolling = useCallback(
    (currentMeeting) => {
      let pollInterval = 5000;
      if (currentMeeting.status === 'pending') pollInterval = 10000;
      else if (currentMeeting.overall_progress > 80) pollInterval = 3000;

      const doPoll = async () => {
        const updated = await fetchMeetingDetails(false);
        pollCountRef.current++;

        // Continue polling if still processing
        if (updated && (updated.status === 'pending' || updated.status === 'processing')) {
          pollTimeoutRef.current = setTimeout(doPoll, pollInterval);
        }
        // After completion, poll a few more times to catch audio_filepath update
        else if (
          updated &&
          updated.status === 'completed' &&
          pollCountRef.current <= 3 &&
          !updated.audio_filepath
        ) {
          pollTimeoutRef.current = setTimeout(doPoll, 3000);
        }
        // Final check after a short delay if audio still missing
        else if (
          updated &&
          updated.status === 'completed' &&
          !updated.audio_filepath &&
          pollCountRef.current === 4
        ) {
          pollTimeoutRef.current = setTimeout(doPoll, 5000);
        }
      };
      pollTimeoutRef.current = setTimeout(doPoll, pollInterval);
    },
    [fetchMeetingDetails]
  );

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    if (!meetingId) return;

    fetchMeetingDetails(true).then((initialMeeting) => {
      if (initialMeeting) {
        fetchAttachments();
        fetchAvailableFolders();
        fetchAvailableTags();

        // Smart polling if processing
        if (initialMeeting.status === 'pending' || initialMeeting.status === 'processing') {
          startSmartPolling(initialMeeting);
        }
      }
    });

    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [
    meetingId,
    fetchMeetingDetails,
    fetchAttachments,
    fetchAvailableFolders,
    fetchAvailableTags,
    startSmartPolling,
  ]);

  /**
   * Rename meeting
   */
  const rename = useCallback(
    async (newName) => {
      if (!newName.trim()) return;
      try {
        setIsUpdating(true);
        await MeetingService.rename(meetingId, newName.trim());
        setMeeting((prev) => ({ ...prev, filename: newName.trim() }));
        return true;
      } catch (err) {
        logger.error('Error renaming meeting:', err);
        setError('Failed to rename meeting.');
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [meetingId]
  );

  /**
   * Delete meeting
   */
  const deleteMeeting = useCallback(async () => {
    try {
      setIsUpdating(true);
      await MeetingService.delete(meetingId);
      return true;
    } catch (err) {
      logger.error('Error deleting meeting:', err);
      setError('Failed to delete meeting.');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [meetingId]);

  /**
   * Update notes
   */
  const updateNotes = useCallback(
    async (newNotes) => {
      try {
        setIsUpdating(true);
        const data = await MeetingService.updateNotes(meetingId, newNotes);
        setNotes(newNotes);
        setMeeting(data);
        return true;
      } catch (err) {
        logger.error('Error updating notes:', err);
        setError('Failed to update notes.');
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [meetingId]
  );

  /**
   * Update tags and folder
   */
  const updateTagsFolder = useCallback(
    async (newTags, newFolder) => {
      try {
        const data = await MeetingService.updateTagsFolder(meetingId, newTags.join(','), newFolder);
        setMeeting(data);
        setTags(newTags);
        setFolder(newFolder);
        return true;
      } catch (err) {
        logger.error('Error updating tags/folder:', err);
        setError('Failed to update tags/folder');
        return false;
      }
    },
    [meetingId]
  );

  /**
   * Restart processing
   */
  const restartProcessing = useCallback(async () => {
    try {
      setIsUpdating(true);
      const data = await MeetingService.restartProcessing(meetingId);
      setMeeting(data);
      pollCountRef.current = 0;
      startSmartPolling(data);
      return true;
    } catch (err) {
      logger.error('Error restarting processing:', err);
      setError('Failed to restart processing.');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [meetingId, startSmartPolling]);

  /**
   * Refresh meeting data
   */
  const refresh = useCallback(() => {
    return fetchMeetingDetails(false);
  }, [fetchMeetingDetails]);

  /**
   * Download meeting transcript/summary in the given format.
   */
  const download = useCallback(
    async (format) => {
      try {
        await MeetingService.download(meetingId, format);
      } catch (err) {
        logger.error('Error downloading meeting:', err);
        setError('Failed to download meeting.');
      }
    },
    [meetingId]
  );

  /**
   * Download attachment
   */
  const downloadAttachment = useCallback(async (attachmentId) => {
    try {
      await AttachmentService.download(attachmentId);
    } catch (err) {
      logger.error('Error downloading attachment:', err);
      setError('Failed to download attachment.');
    }
  }, []);

  /**
   * Delete attachment
   */
  const deleteAttachment = useCallback(async (attachmentId) => {
    try {
      await AttachmentService.delete(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      return true;
    } catch (err) {
      logger.error('Error deleting attachment:', err);
      setError('Failed to delete attachment.');
      return false;
    }
  }, []);

  /**
   * Upload attachment
   */
  const uploadAttachment = useCallback(
    async (file, description = '') => {
      try {
        setIsUpdating(true);
        await AttachmentService.upload(meetingId, file, description);
        await fetchAttachments();
        return true;
      } catch (err) {
        logger.error('Error uploading attachment:', err);
        setError('Failed to upload attachment.');
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [meetingId, fetchAttachments]
  );

  return {
    // State
    meeting,
    isLoading,
    isUpdating,
    error,
    tags,
    setTags,
    folder,
    setFolder,
    notes,
    setNotes,
    availableFolders,
    availableTags,
    attachments,

    // Actions
    refresh,
    rename,
    deleteMeeting,
    updateNotes,
    updateTagsFolder,
    restartProcessing,
    download,
    downloadAttachment,
    deleteAttachment,
    uploadAttachment,
  };
};
