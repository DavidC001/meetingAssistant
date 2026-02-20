/**
 * useMeetingsBrowser Hook
 * Manages meetings fetch, filtering/sorting derivation, bulk operations, and meeting actions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MeetingService } from '../../../../services';
import logger from '../../../../utils/logger';

export const useMeetingsBrowser = ({ searchQuery, filters, sortBy, sortOrder } = {}) => {
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await MeetingService.getAll();
      setMeetings(data);
      setError(null);
    } catch (err) {
      logger.error('Failed to fetch meetings', err);
      setError('Failed to fetch meetings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Polling for processing meetings
  useEffect(() => {
    const pollInterval = setInterval(() => {
      MeetingService.getAll()
        .then((data) => {
          const hasProcessing = data.some(
            (m) => m.status === 'processing' || m.status === 'pending'
          );
          if (hasProcessing) setMeetings(data);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(pollInterval);
  }, []);

  // Available filter options derived from raw meetings
  const availableFilters = useMemo(() => {
    const statuses = [...new Set(meetings.map((m) => m.status))];
    const folders = [...new Set(meetings.map((m) => m.folder || 'Uncategorized'))];
    const tags = [
      ...new Set(
        meetings.flatMap((m) => {
          if (!m.tags) return [];
          if (typeof m.tags === 'string')
            return m.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
          return m.tags;
        })
      ),
    ];
    return { statuses, folders, tags };
  }, [meetings]);

  // Filtered + sorted meetings
  const filteredMeetings = useMemo(() => {
    if (!meetings.length) return [];

    let result = [...meetings];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          (m.filename || m.title || '').toLowerCase().includes(q) ||
          (m.folder || '').toLowerCase().includes(q) ||
          (m.tags || '').toLowerCase().includes(q)
      );
    }

    if (filters?.statuses?.length) {
      result = result.filter((m) => filters.statuses.includes(m.status));
    }

    if (filters?.folder) {
      result = result.filter((m) => (m.folder || 'Uncategorized') === filters.folder);
    }

    if (filters?.tags?.length) {
      result = result.filter((m) => {
        const meetingTags =
          typeof m.tags === 'string' ? m.tags.split(',').map((t) => t.trim()) : m.tags || [];
        return filters.tags.some((tag) => meetingTags.includes(tag));
      });
    }

    if (filters?.dateRange) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let cutoff;
      switch (filters.dateRange) {
        case 'today':
          cutoff = startOfDay;
          break;
        case 'week':
          cutoff = new Date(startOfDay);
          cutoff.setDate(cutoff.getDate() - 7);
          break;
        case 'month':
          cutoff = new Date(startOfDay);
          cutoff.setMonth(cutoff.getMonth() - 1);
          break;
        case 'year':
          cutoff = new Date(startOfDay);
          cutoff.setFullYear(cutoff.getFullYear() - 1);
          break;
        default:
          cutoff = null;
      }
      if (cutoff) result = result.filter((m) => new Date(m.meeting_date || m.created_at) >= cutoff);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison =
            new Date(a.meeting_date || a.created_at) - new Date(b.meeting_date || b.created_at);
          break;
        case 'title':
          comparison = (a.title || a.filename || '').localeCompare(b.title || b.filename || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [meetings, searchQuery, filters, sortBy, sortOrder]);

  // Individual meeting actions
  const handleViewMeeting = useCallback(
    (meeting) => navigate(`/meetings/${meeting.id}`),
    [navigate]
  );
  const handleEditMeeting = useCallback(
    (meeting) => navigate(`/meetings/${meeting.id}`),
    [navigate]
  );
  const handleChatMeeting = useCallback(
    (meeting) => navigate(`/meetings/${meeting.id}?tab=chat`),
    [navigate]
  );

  const handleDownloadMeeting = useCallback(
    async (meeting, format = 'txt') => {
      try {
        await MeetingService.download(meeting.id, format, `${meeting.filename}.${format}`);
        showSnackbar('Download started');
      } catch (err) {
        showSnackbar('Failed to download transcript', 'error');
      }
    },
    [showSnackbar]
  );

  const handleRegenerateAudio = useCallback(
    async (meeting) => {
      try {
        await MeetingService.regenerateAudio(meeting.id);
        showSnackbar('Audio regeneration started');
        await fetchMeetings();
      } catch (err) {
        showSnackbar('Failed to regenerate audio', 'error');
      }
    },
    [fetchMeetings, showSnackbar]
  );

  const handleRestartProcessing = useCallback(
    async (meeting) => {
      try {
        await MeetingService.restartProcessing(meeting.id);
        showSnackbar('Processing restarted');
        await fetchMeetings();
      } catch (err) {
        showSnackbar('Failed to restart processing', 'error');
      }
    },
    [fetchMeetings, showSnackbar]
  );

  const handleDeleteMeeting = useCallback(
    async (meeting) => {
      if (!window.confirm(`Are you sure you want to delete "${meeting.filename}"?`)) return;
      try {
        await MeetingService.delete(meeting.id);
        showSnackbar('Meeting deleted');
        await fetchMeetings();
      } catch (err) {
        showSnackbar('Failed to delete meeting', 'error');
      }
    },
    [fetchMeetings, showSnackbar]
  );

  // Bulk operations
  const bulkMove = useCallback(
    async (selectedIds, folder) => {
      if (!folder.trim()) return false;
      setProcessing(true);
      try {
        await Promise.all(
          selectedIds.map((id) => {
            const m = meetings.find((x) => x.id === id);
            return MeetingService.updateTagsFolder(id, m?.tags || '', folder.trim());
          })
        );
        showSnackbar(`Moved ${selectedIds.length} meeting(s) to ${folder}`);
        await fetchMeetings();
        return true;
      } catch (err) {
        showSnackbar('Failed to move some meetings', 'error');
        return false;
      } finally {
        setProcessing(false);
      }
    },
    [meetings, fetchMeetings, showSnackbar]
  );

  const bulkAddTags = useCallback(
    async (selectedIds, tags) => {
      if (!tags.length) return false;
      setProcessing(true);
      try {
        await Promise.all(
          selectedIds.map((id) => {
            const m = meetings.find((x) => x.id === id);
            const existing = m?.tags ? m.tags.split(',').map((t) => t.trim()) : [];
            const merged = [...new Set([...existing, ...tags])].join(', ');
            return MeetingService.updateTagsFolder(id, merged, m?.folder || '');
          })
        );
        showSnackbar(`Added tags to ${selectedIds.length} meeting(s)`);
        await fetchMeetings();
        return true;
      } catch (err) {
        showSnackbar('Failed to add tags to some meetings', 'error');
        return false;
      } finally {
        setProcessing(false);
      }
    },
    [meetings, fetchMeetings, showSnackbar]
  );

  const bulkDelete = useCallback(
    async (selectedIds) => {
      setProcessing(true);
      try {
        await Promise.all(selectedIds.map((id) => MeetingService.delete(id)));
        showSnackbar(`Deleted ${selectedIds.length} meeting(s)`);
        await fetchMeetings();
        return true;
      } catch (err) {
        showSnackbar('Failed to delete some meetings', 'error');
        return false;
      } finally {
        setProcessing(false);
      }
    },
    [fetchMeetings, showSnackbar]
  );

  return {
    meetings,
    filteredMeetings,
    availableFilters,
    isLoading,
    error,
    processing,
    snackbar,
    closeSnackbar: () => setSnackbar((s) => ({ ...s, open: false })),
    refresh: fetchMeetings,
    meetingActions: {
      onView: handleViewMeeting,
      onEdit: handleEditMeeting,
      onChat: handleChatMeeting,
      onDownload: handleDownloadMeeting,
      onRegenerateAudio: handleRegenerateAudio,
      onRestartProcessing: handleRestartProcessing,
      onDelete: handleDeleteMeeting,
    },
    bulkActions: { bulkMove, bulkAddTags, bulkDelete },
  };
};
