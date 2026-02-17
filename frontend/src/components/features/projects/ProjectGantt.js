import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  TextField,
  Button,
  Dialog as MuiDialog,
  DialogTitle as MuiDialogTitle,
  DialogContent as MuiDialogContent,
  IconButton,
  Link,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import { projectService } from '../../../services';
import './ProjectGanttTooltip.css';

import logger from '../../../utils/logger';
// Helper to format date for input fields
const formatDateForInput = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Helper to get default date range (1 week ago to 3 months ahead)
const getDefaultDateRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 7);

  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + 3);

  return { start: startDate, end: endDate };
};

const VIEW_MODES = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

const formatTooltipDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const buildTaskDetails = (task) => {
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

const ProjectGantt = ({ projectId }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const ThemeWrapper = isDarkMode ? WillowDark : Willow;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ganttData, setGanttData] = useState(null);
  const [viewMode] = useState(VIEW_MODES.week);
  const [filterType, setFilterType] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [links, setLinks] = useState([]);
  const ganttApiRef = useRef(null);
  const tasksRef = useRef([]);
  const ganttWrapperRef = useRef(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [todayLineStyle, setTodayLineStyle] = useState(null);
  const [addForm, setAddForm] = useState({
    task: '',
    owner: '',
    start_date: '',
    due_date: '',
    status: 'pending',
    priority: 'medium',
    notes: '',
  });

  // Track a refresh key to force re-render when presets are clicked
  const [refreshKey, setRefreshKey] = useState(0);
  const [priorityColors] = useState(() => {
    const stored = localStorage.getItem(`project-${projectId}-priority-colors`);
    return stored
      ? JSON.parse(stored)
      : {
          high: '#e53935',
          medium: '#fb8c00',
          low: '#43a047',
          none: '#90a4ae',
        };
  });

  // Custom date range state
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [dateRangeStart, setDateRangeStart] = useState(formatDateForInput(defaultRange.start));
  const [dateRangeEnd, setDateRangeEnd] = useState(formatDateForInput(defaultRange.end));

  useEffect(() => {
    loadGanttData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (ganttData) {
      convertToGanttTasks();
    }
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
      // Optimistic update
      setTasks((prevTasks) => prevTasks.map((t) => (t.id === task.id ? task : t)));

      await projectService.updateGanttItem(projectId, task.id, {
        start_date: task.start ? task.start.toISOString() : null,
        end_date: task.end ? task.end.toISOString() : null,
        // We aren't updating the name via drag/drop, but the object has it
      });
    } catch (err) {
      logger.error('Failed to update task:', err);
      setError('Failed to update task date');
      loadGanttData(); // Revert on error
    }
  };

  const convertToGanttTasks = () => {
    if (!ganttData || !ganttData.items) {
      setTasks([]);
      setLinks([]);
      return;
    }

    // Filter items based on type
    let filteredItems = ganttData.items;
    if (filterType !== 'all') {
      filteredItems = ganttData.items.filter((item) => item.type === filterType);
    }

    // Parse the custom date range
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

    // Filter items by time range - only include items that overlap with the range
    filteredItems = filteredItems.filter((item) => {
      if (!item.start_date) return false;
      const itemStart = new Date(item.start_date);
      if (Number.isNaN(itemStart.getTime())) return false;
      const itemEnd = item.end_date ? new Date(item.end_date) : itemStart;
      if (Number.isNaN(itemEnd.getTime())) return false;
      // Item overlaps if it starts before range ends AND ends after range starts
      return itemStart <= rangeEnd && itemEnd >= rangeStart;
    });

    // Convert to SVAR react-gantt format without date clamping
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
      if (!item.dependencies || !item.dependencies.length) return;
      item.dependencies.forEach((depId) => {
        convertedLinks.push({
          id: linkId++,
          source: depId,
          target: item.id,
          type: 'e2s',
        });
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

  const handleAddActionItemClose = () => {
    setAddDialogOpen(false);
  };

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

  // Quick range presets
  const applyPreset = (preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end;

    switch (preset) {
      case 'thisWeek':
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
        end = new Date(start);
        end.setDate(end.getDate() + 6); // End of week (Saturday)
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'next30days':
        start = new Date(today);
        start.setDate(start.getDate() - 7); // 1 week ago
        end = new Date(today);
        end.setDate(end.getDate() + 30);
        break;
      case 'next3months':
        start = new Date(today);
        start.setDate(start.getDate() - 7); // 1 week ago
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
    // Force refresh
    setRefreshKey((prev) => prev + 1);
  };

  const cellWidth = useMemo(() => {
    return 50;
  }, []);

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: '%F %Y' },
      { unit: 'week', step: 1, format: 'W%W' },
    ],
    []
  );

  const updateTodayLine = useCallback(() => {
    const wrapper = ganttWrapperRef.current;
    if (!wrapper) return;
    const chartEl = wrapper.querySelector('.wx-chart');
    const areaEl = wrapper.querySelector('.wx-area');
    if (!chartEl || !areaEl) {
      setTodayLineStyle(null);
      return;
    }

    const rangeStart = new Date(dateRangeStart);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(dateRangeEnd);
    rangeEnd.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      setTodayLineStyle(null);
      return;
    }

    if (today < rangeStart || today > rangeEnd) {
      setTodayLineStyle(null);
      return;
    }

    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    if (rangeMs <= 0) {
      setTodayLineStyle(null);
      return;
    }

    const contentWidth = areaEl.offsetWidth || chartEl.scrollWidth;
    if (!contentWidth) {
      setTodayLineStyle(null);
      return;
    }

    const percent = (today.getTime() - rangeStart.getTime()) / rangeMs;
    const absoluteLeft = percent * contentWidth;

    const wrapperRect = wrapper.getBoundingClientRect();
    const chartRect = chartEl.getBoundingClientRect();
    const visibleLeft = absoluteLeft - chartEl.scrollLeft;

    setTodayLineStyle({
      left: chartRect.left - wrapperRect.left + visibleLeft,
      top: chartRect.top - wrapperRect.top,
      height: chartRect.height,
    });
  }, [dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    const wrapper = ganttWrapperRef.current;
    if (!wrapper) return;
    const chartEl = wrapper.querySelector('.wx-chart');
    if (!chartEl) return;

    let frame = null;
    const scheduleUpdate = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateTodayLine);
    };

    scheduleUpdate();
    chartEl.addEventListener('scroll', scheduleUpdate, { passive: true });
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(wrapper);
    observer.observe(chartEl);

    return () => {
      chartEl.removeEventListener('scroll', scheduleUpdate);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [updateTodayLine, tasks, refreshKey]);

  const handleSelectTask = useCallback((event) => {
    const taskId = event?.id;
    if (!taskId) return;
    const task = tasksRef.current.find((t) => String(t.id) === String(taskId));
    if (!task) return;
    setSelectedTaskDetails(buildTaskDetails(task));
    setDetailsOpen(true);
  }, []);

  const getTypeCounts = () => {
    if (!ganttData || !ganttData.items) return {};

    const counts = {
      all: ganttData.items.length,
      meeting: 0,
      milestone: 0,
      action_item: 0,
    };

    ganttData.items.forEach((item) => {
      if (counts[item.type] !== undefined) {
        counts[item.type]++;
      }
    });

    return counts;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!ganttData || !ganttData.items || ganttData.items.length === 0) {
    return (
      <Box p={3}>
        <Alert severity="info">
          No timeline data available. Add meetings, milestones, or action items with dates to see
          them on the Gantt chart.
        </Alert>
      </Box>
    );
  }

  const typeCounts = getTypeCounts();

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
          {/* Type Filter */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Type</InputLabel>
            <Select value={filterType} label="Filter by Type" onChange={handleFilterChange}>
              <MenuItem value="all">All Items ({typeCounts.all})</MenuItem>
              <MenuItem value="meeting">Meetings ({typeCounts.meeting})</MenuItem>
              <MenuItem value="milestone">Milestones ({typeCounts.milestone})</MenuItem>
              <MenuItem value="action_item">Action Items ({typeCounts.action_item})</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ ml: 'auto' }}>
            <Button variant="contained" size="small" onClick={handleAddActionItemOpen}>
              Add Action Item
            </Button>
          </Box>
        </Stack>

        {/* Date Range Selection */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            Date Range:
          </Typography>

          <TextField
            type="date"
            label="From"
            size="small"
            value={dateRangeStart}
            onChange={(e) => {
              setDateRangeStart(e.target.value);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <TextField
            type="date"
            label="To"
            size="small"
            value={dateRangeEnd}
            onChange={(e) => {
              setDateRangeEnd(e.target.value);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <Box sx={{ borderLeft: `1px solid ${isDarkMode ? '#555' : '#e0e0e0'}`, pl: 2, ml: 1 }}>
            <Typography variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
              Quick Presets:
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => applyPreset('thisWeek')}>
                This Week
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('thisMonth')}>
                This Month
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('next30days')}>
                Next 30 Days
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('next3months')}>
                Next 3 Months
              </Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset('allData')}>
                All Data
              </Button>
            </Stack>
          </Box>

          {/* Current Range Info */}
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              Showing: {new Date(dateRangeStart).toLocaleDateString()} -{' '}
              {new Date(dateRangeEnd).toLocaleDateString()}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Legend */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ mr: 1 }}>
            Legend:
          </Typography>
          <Chip label="Meetings" size="small" sx={{ bgcolor: '#4CAF50', color: 'white' }} />
          <Chip label="Milestones" size="small" sx={{ bgcolor: '#9C27B0', color: 'white' }} />
          <Chip label="Action Items" size="small" sx={{ bgcolor: '#2196F3', color: 'white' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
            <Box sx={{ width: 20, height: 3, bgcolor: '#f44336', mr: 0.5 }} />
            <Typography variant="caption">Today</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Gantt Chart */}
      <Paper
        sx={{
          p: 2,
          overflow: 'hidden',
          bgcolor: isDarkMode ? '#1e1e1e' : undefined,
        }}
      >
        {tasks.length === 0 ? (
          <Alert severity="info">No items match the selected filter or date range.</Alert>
        ) : (
          <Box
            ref={ganttWrapperRef}
            sx={{
              position: 'relative',
              width: '100%',
              height: Math.max(tasks.length * 40 + 100, 300),
              maxHeight: '70vh',
              display: 'block',
              overflow: 'auto',
              bgcolor: isDarkMode ? '#1e1e1e' : 'transparent',
            }}
          >
            {todayLineStyle ? (
              <Box
                className="project-gantt-today-overlay"
                sx={{
                  position: 'absolute',
                  left: todayLineStyle.left,
                  top: todayLineStyle.top,
                  height: todayLineStyle.height,
                  width: '2px',
                  bgcolor: '#f44336',
                  zIndex: 6,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            <ThemeWrapper>
              <Gantt
                key={`${dateRangeStart}-${dateRangeEnd}-${viewMode}-${refreshKey}`}
                init={(api) => {
                  ganttApiRef.current = api;
                  api.on('add-link', handleAddLink);
                  api.on('delete-link', handleDeleteLink);
                  api.on('update-task', ({ id, task, inProgress }) => {
                    if (inProgress) return;
                    const current = tasksRef.current.find((t) => t.id === id);
                    if (!current) return;
                    const updated = { ...current, ...task };
                    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
                    if (updated.start && updated.end) {
                      handleTaskChange(updated);
                    }
                  });
                }}
                tasks={tasks}
                links={links}
                scales={scales}
                columns={false}
                start={new Date(dateRangeStart)}
                end={new Date(dateRangeEnd)}
                cellWidth={cellWidth}
                cellHeight={40}
                autoScale={false}
                onSelectTask={handleSelectTask}
              />
            </ThemeWrapper>
          </Box>
        )}
      </Paper>

      <Dialog open={addDialogOpen} onClose={handleAddActionItemClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Action Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Task"
              value={addForm.task}
              onChange={(e) => setAddForm((prev) => ({ ...prev, task: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Owner"
              value={addForm.owner}
              onChange={(e) => setAddForm((prev) => ({ ...prev, owner: e.target.value }))}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start Date"
                type="date"
                value={addForm.start_date}
                onChange={(e) => setAddForm((prev) => ({ ...prev, start_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Due Date"
                type="date"
                value={addForm.due_date}
                onChange={(e) => setAddForm((prev) => ({ ...prev, due_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={addForm.status}
                  label="Status"
                  onChange={(e) => setAddForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={addForm.priority}
                  label="Priority"
                  onChange={(e) => setAddForm((prev) => ({ ...prev, priority: e.target.value }))}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Notes"
              value={addForm.notes}
              onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddActionItemClose}>Cancel</Button>
          <Button variant="contained" onClick={handleAddActionItemSave}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <MuiDialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <MuiDialogTitle sx={{ pr: 5 }}>
          {selectedTaskDetails?.title || 'Item details'}
          <IconButton
            aria-label="close"
            onClick={() => setDetailsOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </MuiDialogTitle>
        <MuiDialogContent dividers>
          {selectedTaskDetails ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                {selectedTaskDetails.typeLabel}
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Dates</Typography>
                <Typography variant="body2">
                  Start: {formatTooltipDate(selectedTaskDetails.start)}
                </Typography>
                <Typography variant="body2">
                  End: {formatTooltipDate(selectedTaskDetails.end)}
                </Typography>
              </Stack>
              {selectedTaskDetails.priority ? (
                <Typography variant="body2">Priority: {selectedTaskDetails.priority}</Typography>
              ) : null}
              {selectedTaskDetails.status ? (
                <Typography variant="body2">Status: {selectedTaskDetails.status}</Typography>
              ) : null}
              {selectedTaskDetails.owner ? (
                <Typography variant="body2">Owner: {selectedTaskDetails.owner}</Typography>
              ) : null}
              {selectedTaskDetails.notes ? (
                <Typography variant="body2">Notes: {selectedTaskDetails.notes}</Typography>
              ) : null}
              {selectedTaskDetails.meetingId ? (
                <Typography variant="body2">
                  Meeting:{' '}
                  <Link href={`/meetings/${selectedTaskDetails.meetingId}`} underline="hover">
                    {selectedTaskDetails.meetingTitle}
                  </Link>
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No details available.
            </Typography>
          )}
        </MuiDialogContent>
      </MuiDialog>
    </Box>
  );
};

export default ProjectGantt;
