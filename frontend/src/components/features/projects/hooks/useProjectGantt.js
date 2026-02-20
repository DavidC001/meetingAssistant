import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { projectService } from '../../../../services';
import logger from '../../../../utils/logger';

// --- Pure helpers (exported for use in presentation) ---
export const formatDateForInput = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

export const getDefaultDateRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + 3);
  return { start: startDate, end: endDate };
};

export const formatTooltipDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

export const buildTaskDetails = (task) => {
  if (!task) return null;
  const metadata = task.metadata || {};
  const meetingId = metadata.meeting_id;
  const meetingTitle =
    metadata.meeting_title || metadata.meeting_filename || `Meeting ${meetingId}`;
  const typeLabel = task.kind || metadata.type || task.type || 'task';
  return {
    title: task.text || 'Untitled item',
    typeLabel,
    start: task.start,
    end: task.end,
    priority: metadata.priority,
    status: metadata.status,
    owner: metadata.owner,
    notes: metadata.notes,
    meetingId,
    meetingTitle,
  };
};

const VIEW_MODES = { day: 'day', week: 'week', month: 'month', year: 'year' };

// ---

const useProjectGantt = (projectId) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ganttData, setGanttData] = useState(null);
  const [viewMode] = useState(VIEW_MODES.week);
  const [filterType, setFilterType] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [links, setLinks] = useState([]);
  const tasksRef = useRef([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [priorityColors] = useState(() => {
    const stored = localStorage.getItem(`project-${projectId}-priority-colors`);
    return stored
      ? JSON.parse(stored)
      : { high: '#e53935', medium: '#fb8c00', low: '#43a047', none: '#90a4ae' };
  });

  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [dateRangeStart, setDateRangeStart] = useState(formatDateForInput(defaultRange.start));
  const [dateRangeEnd, setDateRangeEnd] = useState(formatDateForInput(defaultRange.end));

  // Add action item dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    task: '',
    owner: '',
    start_date: '',
    due_date: '',
    status: 'pending',
    priority: 'medium',
    notes: '',
  });

  // Task detail dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  useEffect(() => {
    loadGanttData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (ganttData) convertToGanttTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttData, filterType, dateRangeStart, dateRangeEnd, refreshKey, priorityColors]);

  useEffect(() => {
    localStorage.setItem(`project-${projectId}-priority-colors`, JSON.stringify(priorityColors));
  }, [priorityColors, projectId]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const loadGanttData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectService.getGanttData(projectId);
      setGanttData(response.data);
    } catch (err) {
      logger.error('Failed to load Gantt data:', err);
      setError(err.response?.data?.detail || 'Failed to load Gantt chart data');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskChange = async (task) => {
    try {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      await projectService.updateGanttItem(projectId, task.id, {
        start_date: task.start ? task.start.toISOString() : null,
        end_date: task.end ? task.end.toISOString() : null,
      });
    } catch (err) {
      logger.error('Failed to update task:', err);
      setError('Failed to update task date');
      loadGanttData();
    }
  };

  const convertToGanttTasks = () => {
    if (!ganttData || !ganttData.items) {
      setTasks([]);
      setLinks([]);
      return;
    }

    let filteredItems = ganttData.items;
    if (filterType !== 'all') {
      filteredItems = ganttData.items.filter((item) => item.type === filterType);
    }

    const rangeStart = new Date(dateRangeStart);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(dateRangeEnd);
    rangeEnd.setHours(23, 59, 59, 999);

    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime()) ||
      rangeEnd < rangeStart
    ) {
      setTasks([]);
      setLinks([]);
      return;
    }

    filteredItems = filteredItems.filter((item) => {
      if (!item.start_date) return false;
      const itemStart = new Date(item.start_date);
      if (Number.isNaN(itemStart.getTime())) return false;
      const itemEnd = item.end_date ? new Date(item.end_date) : itemStart;
      if (Number.isNaN(itemEnd.getTime())) return false;
      return itemStart <= rangeEnd && itemEnd >= rangeStart;
    });

    const convertedTasks = filteredItems
      .map((item) => {
        const startDate = new Date(item.start_date);
        const endDate = item.end_date
          ? new Date(item.end_date)
          : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        const priorityValue = (item.metadata?.priority || '').toLowerCase();
        const priorityColor = priorityColors[priorityValue] || null;
        return {
          id: item.id,
          text: item.name,
          start: startDate,
          end: endDate,
          progress: item.progress * 100,
          type: item.type === 'milestone' ? 'milestone' : 'task',
          parent: 0,
          kind: item.type,
          color:
            item.type === 'action_item'
              ? priorityColor || item.color || undefined
              : item.color || undefined,
          metadata: item.metadata,
        };
      })
      .filter(
        (task) =>
          task.start instanceof Date &&
          task.end instanceof Date &&
          !Number.isNaN(task.start.getTime()) &&
          !Number.isNaN(task.end.getTime())
      );

    const convertedLinks = [];
    let linkId = 1;
    filteredItems.forEach((item) => {
      if (!item.dependencies?.length) return;
      item.dependencies.forEach((depId) => {
        convertedLinks.push({ id: linkId++, source: depId, target: item.id, type: 'e2s' });
      });
    });

    setTasks(convertedTasks);
    if (Array.isArray(ganttData.links) && ganttData.links.length) {
      setLinks(
        ganttData.links.map((link) => ({
          id: String(link.id),
          source: String(link.source),
          target: String(link.target),
          type: link.type || 'e2s',
        }))
      );
    } else {
      setLinks(convertedLinks);
    }
  };

  const handleAddLink = useCallback(
    async (event) => {
      const link = event?.link || event?.data?.link || event;
      if (!link?.source || !link?.target) return;
      try {
        const response = await projectService.addGanttLink(projectId, {
          source: String(link.source),
          target: String(link.target),
          type: link.type || 'e2s',
        });
        const saved = response?.data || {
          id: String(link.id || Date.now()),
          source: String(link.source),
          target: String(link.target),
          type: link.type || 'e2s',
        };
        setLinks((prev) => [...prev, saved]);
      } catch (err) {
        logger.error('Failed to add gantt link:', err);
      }
    },
    [projectId]
  );

  const handleDeleteLink = useCallback(
    async (event) => {
      const linkId = event?.id || event;
      if (!linkId) return;
      try {
        await projectService.deleteGanttLink(projectId, linkId);
        setLinks((prev) => prev.filter((l) => String(l.id) !== String(linkId)));
      } catch (err) {
        logger.error('Failed to delete gantt link:', err);
      }
    },
    [projectId]
  );

  const handleFilterChange = (event) => {
    setFilterType(event.target.value);
  };

  const applyPreset = (preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end;

    switch (preset) {
      case 'thisWeek':
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay());
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'next30days':
        start = new Date(today);
        start.setDate(start.getDate() - 7);
        end = new Date(today);
        end.setDate(end.getDate() + 30);
        break;
      case 'next3months':
        start = new Date(today);
        start.setDate(start.getDate() - 7);
        end = new Date(today);
        end.setMonth(end.getMonth() + 3);
        break;
      case 'allData':
        if (ganttData?.date_range?.start && ganttData?.date_range?.end) {
          start = new Date(ganttData.date_range.start);
          end = new Date(ganttData.date_range.end);
          break;
        }
        return;
      default:
        return;
    }

    setDateRangeStart(formatDateForInput(start));
    setDateRangeEnd(formatDateForInput(end));
    setRefreshKey((prev) => prev + 1);
  };

  const handleAddActionItemOpen = () => {
    setAddForm({
      task: '',
      owner: '',
      start_date: dateRangeStart || '',
      due_date: dateRangeEnd || '',
      status: 'pending',
      priority: 'medium',
      notes: '',
    });
    setAddDialogOpen(true);
  };

  const handleAddActionItemClose = () => setAddDialogOpen(false);

  const handleAddActionItemSave = async () => {
    if (!addForm.task.trim()) return;
    try {
      await projectService.createActionItem(projectId, {
        task: addForm.task.trim(),
        owner: addForm.owner || null,
        start_date: addForm.start_date ? new Date(addForm.start_date).toISOString() : null,
        due_date: addForm.due_date || null,
        status: addForm.status,
        priority: addForm.priority,
        notes: addForm.notes || null,
      });
      handleAddActionItemClose();
      loadGanttData();
    } catch (err) {
      logger.error('Failed to create action item:', err);
      setError(err.response?.data?.detail || 'Failed to create action item');
    }
  };

  const handleSelectTask = useCallback((event) => {
    const taskId = event?.id;
    if (!taskId) return;
    const task = tasksRef.current.find((t) => String(t.id) === String(taskId));
    if (!task) return;
    setSelectedTaskDetails(buildTaskDetails(task));
    setDetailsOpen(true);
  }, []);

  const getTypeCounts = () => {
    if (!ganttData?.items) return {};
    const counts = { all: ganttData.items.length, meeting: 0, milestone: 0, action_item: 0 };
    ganttData.items.forEach((item) => {
      if (counts[item.type] !== undefined) counts[item.type]++;
    });
    return counts;
  };

  return {
    loading,
    error,
    ganttData,
    viewMode,
    filterType,
    tasks,
    setTasks,
    links,
    tasksRef,
    refreshKey,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    addDialogOpen,
    addForm,
    setAddForm,
    detailsOpen,
    setDetailsOpen,
    selectedTaskDetails,
    handleTaskChange,
    handleAddLink,
    handleDeleteLink,
    handleFilterChange,
    applyPreset,
    handleAddActionItemOpen,
    handleAddActionItemClose,
    handleAddActionItemSave,
    handleSelectTask,
    getTypeCounts,
  };
};

export default useProjectGantt;
