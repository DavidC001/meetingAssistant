import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Paper,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import { Sync as SyncIcon } from '@mui/icons-material';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../Calendar.css';

import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { CalendarToolbar } from '../presentation/CalendarToolbar';
import { EventDetailDialog } from '../presentation/EventDetailDialog';

const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(BigCalendar);

const CalendarContainer = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // ── User filter state (persisted to localStorage) ─────────────────────────
  const [filterUserName, setFilterUserName] = useState(
    () => localStorage.getItem('calendarUserName') || ''
  );
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(
    () => localStorage.getItem('calendarShowOnlyMyTasks') === 'true'
  );
  const [syncOnlyMyTasks, setSyncOnlyMyTasks] = useState(() => {
    const stored = localStorage.getItem('calendarSyncOnlyMyTasks');
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('calendarUserName', filterUserName);
  }, [filterUserName]);
  useEffect(() => {
    localStorage.setItem('calendarShowOnlyMyTasks', showOnlyMyTasks.toString());
  }, [showOnlyMyTasks]);
  useEffect(() => {
    localStorage.setItem('calendarSyncOnlyMyTasks', syncOnlyMyTasks.toString());
  }, [syncOnlyMyTasks]);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const calendarEvents = useCalendarEvents({ filterUserName, showOnlyMyTasks });

  const googleCalendar = useGoogleCalendar({
    filterUserName,
    syncOnlyMyTasks,
    showSnackbar: calendarEvents.showSnackbar,
    onSyncComplete: calendarEvents.fetchActionItems,
  });

  // Fetch Google status on mount
  useEffect(() => {
    googleCalendar.fetchGoogleStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    events,
    loading,
    snackbar,
    closeSnackbar,
    eventStyleGetter,
    dialogOpen,
    setDialogOpen,
    editMode,
    selectedEvent,
    formData,
    handleFormChange,
    projects,
    linkedProjects,
    loadingProjects,
    newItemProjectIds,
    setNewItemProjectIds,
    handleProjectLink,
    handleSelectEvent,
    handleSelectSlot,
    handleSave,
    handleDelete,
    handleEventDrop,
    handleEventResize,
    handleSyncItem,
  } = calendarEvents;

  const {
    googleConnected,
    googleEmail,
    syncDialogOpen,
    setSyncDialogOpen,
    syncing,
    handleGoogleConnect,
    handleGoogleDisconnect,
    handleSyncAll,
  } = googleCalendar;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <CalendarToolbar
        googleConnected={googleConnected}
        googleEmail={googleEmail}
        onGoogleConnect={handleGoogleConnect}
        onGoogleDisconnect={handleGoogleDisconnect}
        onOpenSyncDialog={() => setSyncDialogOpen(true)}
        filterUserName={filterUserName}
        onFilterNameChange={setFilterUserName}
        showOnlyMyTasks={showOnlyMyTasks}
        onToggleShowOnlyMine={setShowOnlyMyTasks}
        syncOnlyMyTasks={syncOnlyMyTasks}
        onToggleSyncOnlyMine={setSyncOnlyMyTasks}
      />

      {/* Calendar */}
      <Paper sx={{ flex: 1, p: 2, minHeight: '600px' }} className={isDarkMode ? 'dark-mode' : ''}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <DnDCalendar
            key={events.length}
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            selectable
            resizable
            draggableAccessor={() => true}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
          />
        )}
      </Paper>

      {/* Action item edit/create dialog */}
      <EventDetailDialog
        open={dialogOpen}
        editMode={editMode}
        selectedEvent={selectedEvent}
        formData={formData}
        onFormChange={handleFormChange}
        onSave={handleSave}
        onClose={() => setDialogOpen(false)}
        onDelete={handleDelete}
        projects={projects}
        loadingProjects={loadingProjects}
        linkedProjects={linkedProjects}
        newItemProjectIds={newItemProjectIds}
        onProjectLink={handleProjectLink}
        onNewItemProjectToggle={(projectId) =>
          setNewItemProjectIds((prev) =>
            prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
          )
        }
        googleConnected={googleConnected}
        onSyncItem={handleSyncItem}
      />

      {/* Sync All dialog */}
      <Dialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Sync Action Items to Google Calendar</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              This will sync pending action items to your Google Calendar.
            </Typography>
            {syncOnlyMyTasks && filterUserName ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Sync Mode:</strong> Only tasks assigned to you
                </Typography>
                <Typography variant="body2">
                  <strong>Your name:</strong> {filterUserName}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Only tasks with owner matching &quot;{filterUserName}&quot; will be synced.
                </Typography>
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Sync Mode:</strong> All tasks
                </Typography>
                <Typography variant="body2">
                  All pending action items will be synced, regardless of owner.
                </Typography>
                {!filterUserName && (
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                    Tip: Set your name above and enable &quot;Sync only my tasks&quot; to sync only
                    your tasks.
                  </Typography>
                )}
              </Alert>
            )}
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              Do you want to continue?
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSyncAll}
            variant="contained"
            disabled={syncing || (syncOnlyMyTasks && !filterUserName)}
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
          >
            {syncing ? 'Syncing...' : 'Sync All'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CalendarContainer;
