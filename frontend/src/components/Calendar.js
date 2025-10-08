import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, parseISO } from 'date-fns';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
  Google as GoogleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';

const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

const Calendar = () => {
  const [actionItems, setActionItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    task: '',
    owner: '',
    due_date: '',
    status: 'pending',
    priority: 'medium',
    notes: '',
  });

  // Fetch Google Calendar status
  const fetchGoogleStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/calendar/google/status`);
      setGoogleConnected(response.data.is_connected);
      setGoogleEmail(response.data.email || '');
    } catch (error) {
      console.error('Error fetching Google Calendar status:', error);
    }
  }, []);

  // Fetch action items
  const fetchActionItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/calendar/action-items`);
      setActionItems(response.data);
      
      // Convert action items to calendar events
      const calendarEvents = response.data.map(item => {
        let start = new Date();
        
        // Parse due date
        if (item.due_date && item.due_date.toLowerCase() !== 'tbd') {
          try {
            // Try ISO format first
            start = parseISO(item.due_date);
            if (isNaN(start)) {
              // Try other formats
              const dateStr = item.due_date.split(' ')[0]; // Remove time if present
              start = new Date(dateStr);
            }
          } catch (e) {
            console.error('Error parsing date:', e);
            start = addDays(new Date(), 7); // Default to 7 days from now
          }
        } else {
          start = addDays(new Date(), 7); // Default for TBD items
        }
        
        return {
          id: item.id,
          title: item.task,
          start: start,
          end: start,
          resource: item,
        };
      });
      
      setEvents(calendarEvents);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching action items:', error);
      showSnackbar('Error loading action items', 'error');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActionItems();
    fetchGoogleStatus();
  }, [fetchActionItems, fetchGoogleStatus]);

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle event selection
  const handleSelectEvent = (event) => {
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
  };

  // Handle event drag and drop
  const handleEventDrop = async ({ event, start, end }) => {
    try {
      await axios.put(`${API_BASE_URL}/calendar/action-items/${event.id}`, {
        due_date: format(start, 'yyyy-MM-dd'),
      });
      
      showSnackbar('Action item date updated', 'success');
      fetchActionItems();
    } catch (error) {
      console.error('Error updating action item:', error);
      showSnackbar('Error updating action item date', 'error');
    }
  };

  // Handle event resize
  const handleEventResize = ({ event, start, end }) => {
    handleEventDrop({ event, start, end });
  };

  // Handle slot selection (clicking on empty calendar slot)
  const handleSelectSlot = ({ start }) => {
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
    setDialogOpen(true);
  };

  // Handle form changes
  const handleFormChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  // Save action item
  const handleSave = async () => {
    if (!formData.task.trim()) {
      showSnackbar('Task description is required', 'warning');
      return;
    }

    try {
      if (editMode && selectedEvent) {
        // Update existing action item
        await axios.put(`${API_BASE_URL}/calendar/action-items/${selectedEvent.id}`, formData);
        showSnackbar('Action item updated', 'success');
      } else {
        // Create new action item - we need to create it via a meeting
        // For now, show a message that action items must be created from meetings
        showSnackbar('New action items must be created from meeting details', 'info');
        setDialogOpen(false);
        return;
      }
      
      setDialogOpen(false);
      fetchActionItems();
    } catch (error) {
      console.error('Error saving action item:', error);
      showSnackbar('Error saving action item', 'error');
    }
  };

  // Delete action item
  const handleDelete = async () => {
    if (!selectedEvent) return;

    try {
      // First unsync from Google Calendar if synced
      if (selectedEvent.resource.synced_to_calendar) {
        await axios.delete(`${API_BASE_URL}/calendar/action-items/${selectedEvent.id}/sync`);
      }
      
      // Then delete from database
      await axios.delete(`${API_BASE_URL}/meetings/action-items/${selectedEvent.id}`);
      
      showSnackbar('Action item deleted', 'success');
      setDialogOpen(false);
      fetchActionItems();
    } catch (error) {
      console.error('Error deleting action item:', error);
      showSnackbar('Error deleting action item', 'error');
    }
  };

  // Google Calendar Integration
  const handleGoogleConnect = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/calendar/google/auth-url`);
      // Open Google OAuth in new window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const authWindow = window.open(
        response.data.auth_url,
        'Google Calendar Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth callback
      const handleMessage = async (event) => {
        if (event.data.type === 'google-oauth-success') {
          const code = event.data.code;
          try {
            await axios.post(`${API_BASE_URL}/calendar/google/authorize`, { code });
            showSnackbar('Connected to Google Calendar', 'success');
            fetchGoogleStatus();
            authWindow.close();
          } catch (error) {
            console.error('Error authorizing:', error);
            showSnackbar('Error connecting to Google Calendar', 'error');
          }
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error getting auth URL:', error);
      showSnackbar('Error initiating Google Calendar connection', 'error');
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await axios.post(`${API_BASE_URL}/calendar/google/disconnect`);
      setGoogleConnected(false);
      setGoogleEmail('');
      showSnackbar('Disconnected from Google Calendar', 'success');
      fetchActionItems();
    } catch (error) {
      console.error('Error disconnecting:', error);
      showSnackbar('Error disconnecting from Google Calendar', 'error');
    }
  };

  // Sync individual action item
  const handleSyncItem = async (itemId, currentlySynced) => {
    try {
      if (currentlySynced) {
        await axios.delete(`${API_BASE_URL}/calendar/action-items/${itemId}/sync`);
        showSnackbar('Action item unsynced from Google Calendar', 'success');
      } else {
        await axios.post(`${API_BASE_URL}/calendar/action-items/${itemId}/sync`);
        showSnackbar('Action item synced to Google Calendar', 'success');
      }
      fetchActionItems();
    } catch (error) {
      console.error('Error syncing action item:', error);
      showSnackbar('Error syncing action item', 'error');
    }
  };

  // Sync all pending items
  const handleSyncAll = async () => {
    if (!googleConnected) {
      showSnackbar('Please connect to Google Calendar first', 'warning');
      return;
    }

    setSyncing(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/calendar/sync-all?status=pending`);
      showSnackbar(response.data.message, 'success');
      fetchActionItems();
      setSyncDialogOpen(false);
    } catch (error) {
      console.error('Error syncing all items:', error);
      showSnackbar('Error syncing items to Google Calendar', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Event style based on priority and status
  const eventStyleGetter = (event) => {
    const item = event.resource;
    let backgroundColor = '#3174ad';

    // Color by priority
    if (item.priority === 'high') {
      backgroundColor = '#d32f2f';
    } else if (item.priority === 'medium') {
      backgroundColor = '#f57c00';
    } else if (item.priority === 'low') {
      backgroundColor = '#388e3c';
    }

    // Adjust for status
    if (item.status === 'completed') {
      backgroundColor = '#757575';
    } else if (item.status === 'in_progress') {
      backgroundColor = '#1976d2';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: item.status === 'completed' ? 0.6 : 1,
        color: 'white',
        border: item.synced_to_calendar ? '2px solid #4caf50' : '0px',
        display: 'block',
      },
    };
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            Action Items Calendar
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {googleConnected ? (
              <>
                <Chip
                  icon={<GoogleIcon />}
                  label={`Connected: ${googleEmail}`}
                  color="success"
                  onDelete={handleGoogleDisconnect}
                />
                <Button
                  variant="contained"
                  startIcon={<SyncIcon />}
                  onClick={() => setSyncDialogOpen(true)}
                >
                  Sync All
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleConnect}
              >
                Connect Google Calendar
              </Button>
            )}
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label="High Priority" size="small" sx={{ bgcolor: '#d32f2f', color: 'white' }} />
          <Chip label="Medium Priority" size="small" sx={{ bgcolor: '#f57c00', color: 'white' }} />
          <Chip label="Low Priority" size="small" sx={{ bgcolor: '#388e3c', color: 'white' }} />
          <Chip label="Completed" size="small" sx={{ bgcolor: '#757575', color: 'white' }} />
          <Chip label="Synced to Google" size="small" sx={{ border: '2px solid #4caf50' }} variant="outlined" />
        </Box>
      </Paper>

      {/* Calendar */}
      <Paper sx={{ flex: 1, p: 2, minHeight: '600px' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <BigCalendar
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
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
          />
        )}
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Action Item' : 'New Action Item'}
          {selectedEvent?.resource?.synced_to_calendar && (
            <Chip
              icon={<GoogleIcon />}
              label="Synced"
              size="small"
              color="success"
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Task"
              fullWidth
              value={formData.task}
              onChange={(e) => handleFormChange('task', e.target.value)}
              required
              multiline
              rows={2}
            />
            <TextField
              label="Owner"
              fullWidth
              value={formData.owner}
              onChange={(e) => handleFormChange('owner', e.target.value)}
            />
            <TextField
              label="Due Date"
              type="date"
              fullWidth
              value={formData.due_date}
              onChange={(e) => handleFormChange('due_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => handleFormChange('status', e.target.value)}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => handleFormChange('priority', e.target.value)}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              fullWidth
              value={formData.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              multiline
              rows={3}
            />
            {editMode && googleConnected && (
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedEvent?.resource?.synced_to_calendar || false}
                    onChange={(e) => handleSyncItem(selectedEvent.id, selectedEvent.resource.synced_to_calendar)}
                  />
                }
                label="Sync to Google Calendar"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {editMode && (
            <Button onClick={handleDelete} color="error" startIcon={<DeleteIcon />}>
              Delete
            </Button>
          )}
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync All Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)}>
        <DialogTitle>Sync All Action Items</DialogTitle>
        <DialogContent>
          <Typography>
            This will sync all pending action items that are not yet synced to your Google Calendar.
            Do you want to continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSyncAll}
            variant="contained"
            disabled={syncing}
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
          >
            {syncing ? 'Syncing...' : 'Sync All'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Calendar;
