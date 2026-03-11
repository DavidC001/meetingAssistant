/**
 * useActionItems Hook
 * Manages action items state + CRUD for global kanban board
 * Handles filtering, searching, and project-specific queries
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectService, ActionItemService } from '../../../../services';
import logger from '../../../../utils/logger';

const normalizeItems = (items) =>
  (items || []).map((item) => ({
    ...item,
    task: item.task || '',
    status: (item.status || 'pending').replace('_', '-'),
  }));

export const useActionItems = ({
  mode = 'global',
  projectId = null,
  transcriptionId = null,
  initialItems = null,
  filterUserName = '',
  showOnlyMyTasks = false,
  timeHorizon = 'all',
  showCompleted = true,
  searchQuery = '',
  onActionItemsChanged = null,
}) => {
  const isMeetingMode = mode === 'meeting';
  const isProjectMode = mode === 'project';

  const [actionItems, setActionItems] = useState(() =>
    isMeetingMode ? normalizeItems(initialItems) : []
  );
  const [loading, setLoading] = useState(!isMeetingMode);
  const [error, setError] = useState(null);

  // Seed items from parent on mount or when the meeting changes.
  // Deliberately NOT re-running when initialItems reference changes so that
  // local optimistic updates (create/delete/edit) are not overwritten when
  // the parent silently re-fetches meeting data in the background.
  useEffect(() => {
    if (!isMeetingMode) return;
    setActionItems(normalizeItems(initialItems));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMeetingMode, transcriptionId]); // reset only when the meeting itself changes

  // Fetch action items based on mode and filters
  const fetchActionItems = useCallback(async () => {
    if (isMeetingMode) return; // items are provided via initialItems prop

    try {
      setLoading(true);
      let rawItems = [];

      if (isProjectMode && projectId) {
        const response = await projectService.getActionItems(projectId, {
          owner: showOnlyMyTasks && filterUserName ? filterUserName : undefined,
        });
        rawItems = response?.data || [];
      } else {
        rawItems = await ActionItemService.getGlobal();
      }

      // Normalize items
      const normalizedItems = rawItems.map((item) => ({
        ...item,
        task: item.task || '',
        status: (item.status || 'pending').replace('_', '-'),
      }));

      // Apply time horizon filter
      const now = new Date();
      let timeLimit = new Date();

      switch (timeHorizon) {
        case '1week':
          timeLimit.setDate(now.getDate() + 7);
          break;
        case '2weeks':
          timeLimit.setDate(now.getDate() + 14);
          break;
        case '1month':
          timeLimit.setMonth(now.getMonth() + 1);
          break;
        case '3months':
          timeLimit.setMonth(now.getMonth() + 3);
          break;
        case '6months':
          timeLimit.setMonth(now.getMonth() + 6);
          break;
        case '1year':
          timeLimit.setFullYear(now.getFullYear() + 1);
          break;
        case 'all':
        default:
          timeLimit = null;
          break;
      }

      let filteredItems = normalizedItems.filter((item) => {
        if (!item.due_date) return true;
        if (!timeLimit) return true;
        const dueDate = new Date(item.due_date);
        const isExpiredIncomplete = dueDate < now && item.status !== 'completed';
        return isExpiredIncomplete || (dueDate >= now && dueDate <= timeLimit);
      });

      // Apply user filter
      if (showOnlyMyTasks && filterUserName) {
        filteredItems = filteredItems.filter((item) => {
          if (!item.owner) return false;
          return item.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim();
        });
      }

      // Hide completed in project mode if disabled
      if (isProjectMode && !showCompleted) {
        filteredItems = filteredItems.filter((item) => item.status !== 'completed');
      }

      // Apply search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredItems = filteredItems.filter((item) => {
          const matchesTask = (item.task || '').toLowerCase().includes(query);
          const matchesOwner = (item.owner || '').toLowerCase().includes(query);
          const matchesMeeting = (item.meeting_title || '').toLowerCase().includes(query);
          return matchesTask || matchesOwner || matchesMeeting;
        });
      }

      setActionItems(filteredItems);
      setError(null);
    } catch (err) {
      logger.error('Error fetching action items:', err);
      setError('Failed to fetch action items.');
      setActionItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    isMeetingMode,
    isProjectMode,
    projectId,
    showOnlyMyTasks,
    filterUserName,
    timeHorizon,
    showCompleted,
    searchQuery,
  ]);

  // Fetch on mount and when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchActionItems();
    }, 500); // Debounce filter changes

    return () => clearTimeout(timeoutId);
  }, [fetchActionItems]);

  // Group by status
  const columns = useMemo(() => {
    const grouped = { pending: [], 'in-progress': [], completed: [] };
    actionItems.forEach((item) => {
      const status = item.status || 'pending';
      if (grouped[status]) {
        grouped[status].push(item);
      } else {
        grouped.pending.push(item);
      }
    });
    return grouped;
  }, [actionItems]);

  // Update single item status via drag-drop
  const updateItemStatus = useCallback(
    async (itemId, newStatus) => {
      const prevItems = actionItems;

      // Optimistic update
      setActionItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item))
      );

      try {
        if (isMeetingMode || isProjectMode) {
          const normalizedStatus = newStatus.replace('-', '_');
          await ActionItemService.update(itemId, { status: normalizedStatus });
        } else {
          await ActionItemService.updateGlobal(itemId, { status: newStatus });
        }
      } catch (err) {
        logger.error('Error updating action item status:', err);
        setActionItems(prevItems); // Revert on error
        setError('Failed to update action item status.');
      }
    },
    [isMeetingMode, isProjectMode, actionItems]
  );

  // Create new action item
  const createActionItem = useCallback(
    async (payload, linkedProjectIds = []) => {
      try {
        let createdItem;
        if (isMeetingMode && transcriptionId) {
          createdItem = await ActionItemService.add(transcriptionId, payload);
        } else if (isProjectMode && projectId) {
          const response = await projectService.createActionItem(projectId, payload);
          createdItem = response.data ?? response;
        } else {
          createdItem = await ActionItemService.createGlobal(payload);
        }

        if (!createdItem) {
          setError('Failed to create action item: no data returned.');
          return null;
        }

        // Normalize the created item the same way as fetchActionItems does
        const normalizedItem = {
          ...createdItem,
          task: createdItem.task || '',
          status: (createdItem.status || 'pending').replace('_', '-'),
        };

        // Link to selected projects
        if (linkedProjectIds.length > 0 && normalizedItem?.id) {
          const idsToLink = isProjectMode
            ? linkedProjectIds.filter((pid) => String(pid) !== String(projectId))
            : linkedProjectIds;

          if (idsToLink.length > 0) {
            await Promise.all(
              idsToLink.map((pid) => ActionItemService.linkToProject(pid, normalizedItem.id))
            );
          }
        }

        setActionItems((prev) => [...prev, normalizedItem]);
        setError(null);
        if (isMeetingMode && onActionItemsChanged) onActionItemsChanged();
        return createdItem;
      } catch (err) {
        logger.error('Error creating action item:', err);
        setError('Failed to create action item.');
        return null;
      }
    },
    [isMeetingMode, isProjectMode, transcriptionId, projectId, onActionItemsChanged]
  );

  // Update action item
  const updateActionItem = useCallback(
    async (itemId, payload) => {
      const prevItems = actionItems;
      try {
        let updated;
        if (isMeetingMode || isProjectMode) {
          updated = await ActionItemService.update(itemId, payload);
        } else {
          updated = await ActionItemService.updateGlobal(itemId, payload);
        }

        setActionItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
        setError(null);
        if (isMeetingMode && onActionItemsChanged) onActionItemsChanged();
        return true;
      } catch (err) {
        logger.error('Error updating action item:', err);
        setActionItems(prevItems);
        setError('Failed to update action item.');
        return false;
      }
    },
    [isMeetingMode, isProjectMode, actionItems, onActionItemsChanged]
  );

  // Delete action item (global mode) or unlink from project (project mode)
  const deleteActionItem = useCallback(
    async (itemId) => {
      const prevItems = actionItems;
      try {
        if (!isMeetingMode && isProjectMode && projectId) {
          await ActionItemService.unlinkFromProject(projectId, itemId);
        } else {
          await ActionItemService.delete(itemId);
        }

        setActionItems((prev) => prev.filter((item) => item.id !== itemId));
        setError(null);
        if (isMeetingMode && onActionItemsChanged) onActionItemsChanged();
        return true;
      } catch (err) {
        logger.error('Error deleting action item:', err);
        setActionItems(prevItems);
        setError('Failed to delete action item.');
        return false;
      }
    },
    [isMeetingMode, isProjectMode, projectId, actionItems, onActionItemsChanged]
  );

  // Permanently delete action item (global mode only)
  const deleteActionItemPermanently = useCallback(
    async (itemId) => {
      const prevItems = actionItems;
      try {
        await ActionItemService.delete(itemId);
        setActionItems((prev) => prev.filter((item) => item.id !== itemId));
        setError(null);
        if (isMeetingMode && onActionItemsChanged) onActionItemsChanged();
        return true;
      } catch (err) {
        logger.error('Error deleting action item permanently:', err);
        setActionItems(prevItems);
        setError('Failed to delete action item.');
        return false;
      }
    },
    [actionItems, isMeetingMode, onActionItemsChanged]
  );

  // Link action item to project (global mode only)
  const linkToProject = useCallback(async (itemId, pid) => {
    try {
      await ActionItemService.linkToProject(pid, itemId);
      setError(null);
      return true;
    } catch (err) {
      logger.error('Error linking action item to project:', err);
      setError('Failed to link action item to project.');
      return false;
    }
  }, []);

  // Unlink action item from project
  const unlinkFromProject = useCallback(
    async (itemId, pid) => {
      try {
        if (isProjectMode && projectId) {
          await ActionItemService.unlinkFromProject(pid, itemId);
        } else {
          await ActionItemService.unlinkFromProject(pid, itemId);
        }
        setError(null);
        return true;
      } catch (err) {
        logger.error('Error unlinking action item from project:', err);
        setError('Failed to unlink action item from project.');
        return false;
      }
    },
    [isProjectMode, projectId]
  );

  // Get available action items for linking to project (project mode only)
  const getAvailableActionItems = useCallback(async () => {
    if (!isProjectMode || !projectId) return [];

    try {
      const allItems = await ActionItemService.getGlobal();
      const linkedResponse = await projectService.getActionItems(projectId);
      const linkedItems = linkedResponse?.data || [];
      const linkedIds = new Set(linkedItems.map((item) => String(item.id)));
      return allItems.filter(
        (item) => !linkedIds.has(String(item.id)) && item.status !== 'completed'
      );
    } catch (err) {
      logger.error('Error fetching available action items:', err);
      return [];
    }
  }, [isProjectMode, projectId]);

  // Link existing action item to project
  const linkExistingItem = useCallback(
    async (itemId) => {
      if (!isProjectMode || !projectId) return false;

      try {
        await ActionItemService.linkToProject(projectId, itemId);
        // Re-fetch to include new item
        await fetchActionItems();
        setError(null);
        return true;
      } catch (err) {
        logger.error('Error linking existing action item:', err);
        setError('Failed to link action item to project.');
        return false;
      }
    },
    [isProjectMode, projectId, fetchActionItems]
  );

  return {
    // State
    actionItems,
    columns,
    loading,
    error,
    isProjectMode,
    isMeetingMode,

    // Actions
    fetchActionItems,
    updateItemStatus,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    deleteActionItemPermanently,
    linkToProject,
    unlinkFromProject,
    getAvailableActionItems,
    linkExistingItem,
  };
};
