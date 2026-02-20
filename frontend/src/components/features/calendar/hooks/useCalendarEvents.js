import { useState, useEffect, useCallback } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import CalendarService from '../../../../services/calendarService';
import ActionItemService from '../../../../services/actionItemService';
import { projectService } from '../../../../services';
import logger from '../../../../utils/logger';

/**
 * Manages calendar action items: fetching, creating, updating, deleting,
 * event drag-and-drop, project linking, and Google sync per-item.
 *
 * @param {Object} params
 * @param {string}  params.filterUserName   - Name to filter tasks by owner
 * @param {boolean} params.showOnlyMyTasks  - Whether to filter tasks by owner
 */
export function useCalendarEvents({ filterUserName, showOnlyMyTasks }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formData, setFormData] = useState({
    task: '',
    owner: '',
    due_date: '',
    status: 'pending',
    priority: 'medium',
    notes: '',
  });

  // Project linking
  const [projects, setProjects] = useState([]);
  const [linkedProjects, setLinkedProjects] = useState(new Set());
  const [newItemProjectIds, setNewItemProjectIds] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // ── Snackbar ───────────────────────────────────────────────────────────────
  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // ── Action items / events ──────────────────────────────────────────────────
  const fetchActionItems = useCallback(async () => {
    try {
      setLoading(true);
      let items = await CalendarService.getActionItems();

      if (showOnlyMyTasks && filterUserName) {
        items = items.filter((item) => {
          if (!item.owner) return false;
          return item.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim();
        });
      }

      const calendarEvents = items.map((item) => {
        let start = new Date();
        if (item.due_date && item.due_date.toLowerCase() !== 'tbd') {
          try {
            start = parseISO(item.due_date);
            if (isNaN(start)) {
              start = new Date(item.due_date.split(' ')[0]);
            }
          } catch {
            start = addDays(new Date(), 7);
          }
        } else {
          start = addDays(new Date(), 7);
        }
        return { id: item.id, title: item.task, start, end: start, resource: item };
      });

      setEvents(calendarEvents);
    } catch (error) {
      logger.error('Error fetching action items:', error);
      showSnackbar('Error loading action items', 'error');
    } finally {
      setLoading(false);
    }
  }, [showOnlyMyTasks, filterUserName, showSnackbar]);

  useEffect(() => {
    fetchActionItems();
  }, [fetchActionItems]);

  // ── Projects ───────────────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const response = await projectService.listProjects('active');
      setProjects(response?.data || response || []);
    } catch (error) {
      logger.error('Error fetching projects:', error);
      showSnackbar('Error loading projects', 'error');
    } finally {
      setLoadingProjects(false);
    }
  }, [showSnackbar]);

  const fetchLinkedProjects = useCallback(
    async (actionItemId) => {
      if (!actionItemId) {
        setLinkedProjects(new Set());
        return;
      }
      try {
        const checks = await Promise.all(
          projects.map(async (project) => {
            try {
              const response = await projectService.getActionItems(project.id);
              const items = response?.data || response || [];
              return items.some((item) => item.id === actionItemId) ? project.id : null;
            } catch {
              return null;
            }
          })
        );
        setLinkedProjects(new Set(checks.filter(Boolean)));
      } catch (error) {
        logger.error('Error checking linked projects:', error);
      }
    },
    [projects]
  );

  const handleProjectLink = useCallback(
    async (projectId) => {
      if (!selectedEvent?.id) return;
      try {
        if (linkedProjects.has(projectId)) {
          await ActionItemService.unlinkFromProject(projectId, selectedEvent.id);
          setLinkedProjects((prev) => {
            const s = new Set(prev);
            s.delete(projectId);
            return s;
          });
          showSnackbar('Action item removed from project', 'success');
        } else {
          await ActionItemService.linkToProject(projectId, selectedEvent.id);
          setLinkedProjects((prev) => new Set([...prev, projectId]));
          showSnackbar('Action item added to project', 'success');
        }
      } catch (error) {
        logger.error('Error linking/unlinking action item:', error);
        showSnackbar('Error updating project link', 'error');
      }
    },
    [selectedEvent, linkedProjects, showSnackbar]
  );

  // ── Calendar interaction handlers ──────────────────────────────────────────
  const handleSelectEvent = useCallback(
    (event) => {
      setSelectedEvent(event);
      setFormData({
        task: event.resource.task,
        owner: event.resource.owner || '',
        due_date: format(event.start, 'yyyy-MM-dd'),
        status: event.resource.status || 'pending',
        priority: event.resource.priority || 'medium',
        notes: event.resource.notes || '',
      });
      setEditMode(true);
      setDialogOpen(true);
      fetchProjects();
      if (event.id) fetchLinkedProjects(event.id);
    },
    [fetchProjects, fetchLinkedProjects]
  );

  const handleSelectSlot = useCallback(
    ({ start }) => {
      setSelectedEvent(null);
      setFormData({
        task: '',
        owner: '',
        due_date: format(start, 'yyyy-MM-dd'),
        status: 'pending',
        priority: 'medium',
        notes: '',
      });
      setEditMode(false);
      setLinkedProjects(new Set());
      setNewItemProjectIds([]);
      fetchProjects();
      setDialogOpen(true);
    },
    [fetchProjects]
  );

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!formData.task.trim()) {
      showSnackbar('Task description is required', 'warning');
      return;
    }
    try {
      if (editMode && selectedEvent) {
        await CalendarService.updateActionItem(selectedEvent.id, formData);
        showSnackbar('Action item updated', 'success');
      } else {
        const created = await CalendarService.createActionItem(formData);
        if (created?.id && newItemProjectIds.length > 0) {
          await Promise.all(
            newItemProjectIds.map((pid) => ActionItemService.linkToProject(pid, created.id))
          );
        }
        showSnackbar('Action item created', 'success');
      }
      setDialogOpen(false);
      fetchActionItems();
    } catch (error) {
      logger.error('Error saving action item:', error);
      showSnackbar('Error saving action item', 'error');
    }
  }, [formData, editMode, selectedEvent, newItemProjectIds, showSnackbar, fetchActionItems]);

  const handleDelete = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      if (selectedEvent.resource.synced_to_calendar) {
        await CalendarService.unsyncActionItemFromGoogle(selectedEvent.id);
      }
      await CalendarService.deleteActionItem(selectedEvent.id);
      showSnackbar('Action item deleted', 'success');
      setDialogOpen(false);
      fetchActionItems();
    } catch (error) {
      logger.error('Error deleting action item:', error);
      showSnackbar('Error deleting action item', 'error');
    }
  }, [selectedEvent, showSnackbar, fetchActionItems]);

  const handleEventDrop = useCallback(
    async ({ event, start }) => {
      try {
        await CalendarService.updateActionItem(event.id, { due_date: format(start, 'yyyy-MM-dd') });
        showSnackbar('Action item date updated', 'success');
        fetchActionItems();
      } catch (error) {
        logger.error('Error updating action item:', error);
        showSnackbar('Error updating action item date', 'error');
      }
    },
    [showSnackbar, fetchActionItems]
  );

  const handleEventResize = useCallback(
    ({ event, start, end }) => {
      handleEventDrop({ event, start, end });
    },
    [handleEventDrop]
  );

  const handleSyncItem = useCallback(
    async (itemId, currentlySynced) => {
      try {
        if (currentlySynced) {
          await CalendarService.unsyncActionItemFromGoogle(itemId);
          showSnackbar('Action item unsynced from Google Calendar', 'success');
        } else {
          await CalendarService.syncActionItemToGoogle(itemId);
          showSnackbar('Action item synced to Google Calendar', 'success');
        }
        fetchActionItems();
      } catch (error) {
        logger.error('Error syncing action item:', error);
        showSnackbar('Error syncing action item', 'error');
      }
    },
    [showSnackbar, fetchActionItems]
  );

  // ── Event style ────────────────────────────────────────────────────────────
  const eventStyleGetter = useCallback(
    (event) => {
      const item = event.resource;
      let backgroundColor = '#3174ad';
      if (item.status === 'completed') {
        backgroundColor = '#757575';
      } else if (item.status === 'in_progress') {
        backgroundColor = '#1976d2';
      } else {
        if (item.priority === 'high') backgroundColor = '#d32f2f';
        else if (item.priority === 'medium') backgroundColor = '#f57c00';
        else if (item.priority === 'low') backgroundColor = '#388e3c';
      }
      const isMyTask =
        filterUserName &&
        item.owner &&
        item.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim();
      return {
        style: {
          backgroundColor,
          borderRadius: '5px',
          opacity: item.status === 'completed' ? 0.6 : 1,
          color: 'white',
          border: item.synced_to_calendar ? '2px solid #4caf50' : '0px',
          display: 'block',
          fontWeight: isMyTask ? '600' : 'normal',
          boxShadow: isMyTask ? '0 0 8px rgba(33, 150, 243, 0.5)' : 'none',
        },
      };
    },
    [filterUserName]
  );

  return {
    // Events & loading
    events,
    loading,
    snackbar,
    showSnackbar,
    closeSnackbar,
    fetchActionItems,
    eventStyleGetter,
    // Dialog
    dialogOpen,
    setDialogOpen,
    editMode,
    selectedEvent,
    // Form
    formData,
    handleFormChange,
    // Project linking
    projects,
    linkedProjects,
    loadingProjects,
    newItemProjectIds,
    setNewItemProjectIds,
    handleProjectLink,
    // Handlers
    handleSelectEvent,
    handleSelectSlot,
    handleSave,
    handleDelete,
    handleEventDrop,
    handleEventResize,
    handleSyncItem,
  };
}
