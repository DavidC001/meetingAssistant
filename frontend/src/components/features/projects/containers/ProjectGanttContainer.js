import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Box, CircularProgress, Paper, useTheme } from '@mui/material';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import useProjectGantt from '../hooks/useProjectGantt';
import GanttToolbar from '../presentation/GanttToolbar';
import TaskDetailDialog from '../presentation/TaskDetailDialog';
import AddActionItemDialog from '../presentation/AddActionItemDialog';
import '../ProjectGanttTooltip.css';

const ProjectGanttContainer = ({ projectId }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const ThemeWrapper = isDarkMode ? WillowDark : Willow;

  // DOM refs (must stay in the component that renders the Gantt)
  const ganttApiRef = useRef(null);
  const ganttWrapperRef = useRef(null);

  const [todayLineStyle, setTodayLineStyle] = useState(null);

  const {
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
  } = useProjectGantt(projectId);

  // Today line
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

  const cellWidth = useMemo(() => 50, []);
  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: '%F %Y' },
      { unit: 'week', step: 1, format: 'W%W' },
    ],
    []
  );

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

  if (!ganttData?.items?.length) {
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
      <GanttToolbar
        filterType={filterType}
        onFilterChange={handleFilterChange}
        typeCounts={typeCounts}
        dateRangeStart={dateRangeStart}
        onStartChange={setDateRangeStart}
        dateRangeEnd={dateRangeEnd}
        onEndChange={setDateRangeEnd}
        onApplyPreset={applyPreset}
        onAddActionItem={handleAddActionItemOpen}
        isDarkMode={isDarkMode}
      />

      {/* Gantt Chart */}
      <Paper sx={{ p: 2, overflow: 'hidden', bgcolor: isDarkMode ? '#1e1e1e' : undefined }}>
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
            {todayLineStyle && (
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
            )}
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
                    if (updated.start && updated.end) handleTaskChange(updated);
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

      <AddActionItemDialog
        open={addDialogOpen}
        onClose={handleAddActionItemClose}
        addForm={addForm}
        setAddForm={setAddForm}
        onSave={handleAddActionItemSave}
      />

      <TaskDetailDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        selectedTaskDetails={selectedTaskDetails}
      />
    </Box>
  );
};

export default ProjectGanttContainer;
