/**
 * useProjectMeetings
 * Manages meetings list for a project tab: loading, search, filter and sort.
 */

import { useState, useCallback, useMemo } from 'react';
import { projectService } from '../../../../services/projectService';
import logger from '../../../../utils/logger';

export const useProjectMeetings = (projectId) => {
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const loadMeetings = useCallback(async () => {
    try {
      setMeetingsLoading(true);
      const response = await projectService.getProjectMeetings(projectId, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setMeetings(response.data || []);
    } catch (err) {
      logger.error('Failed to load meetings:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [projectId, statusFilter, sortBy, sortOrder]);

  const handleSort = useCallback(
    (field) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortOrder('desc');
      }
    },
    [sortBy]
  );

  const handleClearSearch = useCallback(() => setSearchQuery(''), []);

  const filteredMeetings = useMemo(
    () =>
      meetings.filter((meeting) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          meeting.title?.toLowerCase().includes(query) ||
          meeting.folder?.toLowerCase().includes(query) ||
          meeting.speakers?.some((s) => s.toLowerCase().includes(query))
        );
      }),
    [meetings, searchQuery]
  );

  return {
    meetings,
    meetingsLoading,
    filteredMeetings,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    sortOrder,
    handleSort,
    handleClearSearch,
    loadMeetings,
  };
};
