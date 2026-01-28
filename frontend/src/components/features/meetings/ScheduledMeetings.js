import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Event as EventIcon,
  CloudSync as CloudSyncIcon,
  Link as LinkIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  VideoCall as VideoCallIcon,
  LocationOn as LocationOnIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { format, isPast, isFuture, isToday, parseISO } from 'date-fns';
import api from '../../../api';

const ScheduledMeetings = () => {
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [needsUploadMeetings, setNeedsUploadMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedScheduledMeeting, setSelectedScheduledMeeting] = useState(null);

  // Form states
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    scheduled_time: '',
    duration_minutes: 60,
    location: '',
    attendees: '',
  });

  useEffect(() => {
    fetchScheduledMeetings();
    fetchMeetingsNeedingUpload();
  }, []);

  const fetchScheduledMeetings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/scheduled-meetings/');
      setScheduledMeetings(response.data);
    } catch (error) {
      console.error('Error fetching scheduled meetings:', error);
      showSnackbar('Failed to fetch scheduled meetings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingsNeedingUpload = async () => {
    try {
      const response = await api.get('/api/v1/scheduled-meetings/needs-upload/list');
      setNeedsUploadMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings needing upload:', error);
    }
  };

  const syncFromGoogleCalendar = async () => {
    setSyncing(true);
    try {
      const response = await api.post('/api/v1/scheduled-meetings/sync-from-google', null, {
        params: {
          days_ahead: 30,
          days_back: 7,
        },
      });
      showSnackbar(`Synced ${response.data.total} meetings from Google Calendar`, 'success');
      fetchScheduledMeetings();
      fetchMeetingsNeedingUpload();
    } catch (error) {
      console.error('Error syncing from Google Calendar:', error);
      showSnackbar('Failed to sync from Google Calendar. Make sure you are connected.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const createScheduledMeeting = async () => {
    try {
      // Convert local datetime to ISO string with proper timezone
      const meetingData = {
        ...newMeeting,
        scheduled_time: new Date(newMeeting.scheduled_time).toISOString(),
      };
      await api.post('/api/v1/scheduled-meetings/', meetingData);
      showSnackbar('Scheduled meeting created successfully', 'success');
      setCreateDialogOpen(false);
      resetForm();
      fetchScheduledMeetings();
    } catch (error) {
      console.error('Error creating scheduled meeting:', error);
      showSnackbar('Failed to create scheduled meeting', 'error');
    }
  };

  const deleteScheduledMeeting = async (id) => {
    if (!window.confirm('Are you sure you want to delete this scheduled meeting?')) {
      return;
    }

    try {
      await api.delete(`/api/v1/scheduled-meetings/${id}`);
      showSnackbar('Scheduled meeting deleted successfully', 'success');
      fetchScheduledMeetings();
      fetchMeetingsNeedingUpload();
    } catch (error) {
      console.error('Error deleting scheduled meeting:', error);
      showSnackbar('Failed to delete scheduled meeting', 'error');
    }
  };

  const openLinkDialog = (scheduledMeeting) => {
    setSelectedScheduledMeeting(scheduledMeeting);
    setLinkDialogOpen(true);
  };

  const linkMeetingToScheduled = async (meetingId) => {
    try {
      await api.post(`/api/v1/scheduled-meetings/${selectedScheduledMeeting.id}/link/${meetingId}`);
      showSnackbar('Meeting linked successfully', 'success');
      setLinkDialogOpen(false);
      fetchScheduledMeetings();
      fetchMeetingsNeedingUpload();
    } catch (error) {
      console.error('Error linking meeting:', error);
      showSnackbar('Failed to link meeting', 'error');
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const resetForm = () => {
    setNewMeeting({
      title: '',
      description: '',
      scheduled_time: '',
      duration_minutes: 60,
      location: '',
      attendees: '',
    });
  };

  const getStatusChip = (meeting) => {
    const scheduledTime = parseISO(meeting.scheduled_time);

    if (meeting.linked_meeting_id) {
      return <Chip label="Completed" color="success" size="small" icon={<CheckCircleIcon />} />;
    } else if (isPast(scheduledTime)) {
      return <Chip label="Needs Upload" color="warning" size="small" icon={<UploadFileIcon />} />;
    } else if (isToday(scheduledTime)) {
      return <Chip label="Today" color="primary" size="small" icon={<ScheduleIcon />} />;
    } else {
      return <Chip label="Upcoming" color="default" size="small" icon={<EventIcon />} />;
    }
  };

  const formatDateTime = (dateString) => {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const MeetingCard = ({ meeting, showUploadPrompt = false }) => {
    const scheduledTime = parseISO(meeting.scheduled_time);
    const isPastMeeting = isPast(scheduledTime);

    return (
      <Card
        sx={{
          mb: 2,
          border: showUploadPrompt ? '2px solid' : '1px solid',
          borderColor: showUploadPrompt ? 'warning.main' : 'divider',
          '&:hover': { boxShadow: 3 },
        }}
      >
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                {meeting.title}
              </Typography>
              {getStatusChip(meeting)}
            </Box>
            <Box>
              {!meeting.linked_meeting_id && isPastMeeting && (
                <Tooltip title="Link uploaded meeting">
                  <IconButton color="primary" onClick={() => openLinkDialog(meeting)} size="small">
                    <LinkIcon />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton
                size="small"
                onClick={() => deleteScheduledMeeting(meeting.id)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ScheduleIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(meeting.scheduled_time)} ({meeting.duration_minutes} min)
                </Typography>
              </Box>
            </Grid>

            {meeting.location && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LocationOnIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {meeting.location}
                  </Typography>
                </Box>
              </Grid>
            )}

            {meeting.google_meet_link && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <VideoCallIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                  <Typography
                    variant="body2"
                    component="a"
                    href={meeting.google_meet_link}
                    target="_blank"
                    sx={{ color: 'primary.main', textDecoration: 'none' }}
                  >
                    Join Google Meet
                  </Typography>
                </Box>
              </Grid>
            )}

            {meeting.attendees && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <PeopleIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary', mt: 0.3 }} />
                  <Typography variant="body2" color="text.secondary">
                    {meeting.attendees}
                  </Typography>
                </Box>
              </Grid>
            )}

            {meeting.description && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {meeting.description}
                </Typography>
              </Grid>
            )}

            {meeting.linked_meeting_id && (
              <Grid item xs={12}>
                <Alert severity="success" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Linked to uploaded meeting #{meeting.linked_meeting_id}
                  </Typography>
                </Alert>
              </Grid>
            )}

            {showUploadPrompt && !meeting.linked_meeting_id && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    This meeting has occurred. Please upload the recording to keep your records
                    complete.
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    sx={{ mt: 1 }}
                    onClick={() => openLinkDialog(meeting)}
                  >
                    Link Recording
                  </Button>
                </Alert>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Scheduled Meetings
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <CloudSyncIcon />}
            onClick={syncFromGoogleCalendar}
            disabled={syncing}
            sx={{ mr: 1 }}
          >
            {syncing ? 'Syncing...' : 'Sync from Google Calendar'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Add Meeting
          </Button>
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label={`All Meetings (${scheduledMeetings.length})`} />
        <Tab
          label={`Needs Upload (${needsUploadMeetings.length})`}
          icon={
            needsUploadMeetings.length > 0 ? (
              <Chip label={needsUploadMeetings.length} size="small" color="warning" />
            ) : null
          }
          iconPosition="end"
        />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tabValue === 0 && (
            <Box>
              {scheduledMeetings.length === 0 ? (
                <Alert severity="info">
                  No scheduled meetings found. Sync from Google Calendar or add one manually.
                </Alert>
              ) : (
                scheduledMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))
              )}
            </Box>
          )}

          {tabValue === 1 && (
            <Box>
              {needsUploadMeetings.length === 0 ? (
                <Alert severity="success">All recent meetings have recordings linked! 🎉</Alert>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    These meetings have occurred but don't have recordings linked yet.
                  </Alert>
                  {needsUploadMeetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} showUploadPrompt={true} />
                  ))}
                </>
              )}
            </Box>
          )}
        </>
      )}

      {/* Create Meeting Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Scheduled Meeting</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={newMeeting.title}
            onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={newMeeting.description}
            onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Scheduled Time"
            type="datetime-local"
            value={newMeeting.scheduled_time}
            onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_time: e.target.value })}
            margin="normal"
            required
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Duration (minutes)"
            type="number"
            value={newMeeting.duration_minutes}
            onChange={(e) =>
              setNewMeeting({ ...newMeeting, duration_minutes: parseInt(e.target.value) })
            }
            margin="normal"
          />
          <TextField
            fullWidth
            label="Location"
            value={newMeeting.location}
            onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Attendees (comma-separated)"
            value={newMeeting.attendees}
            onChange={(e) => setNewMeeting({ ...newMeeting, attendees: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={createScheduledMeeting}
            variant="contained"
            disabled={!newMeeting.title || !newMeeting.scheduled_time}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Meeting Dialog */}
      <LinkMeetingDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        scheduledMeeting={selectedScheduledMeeting}
        onLink={linkMeetingToScheduled}
      />

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Separate component for linking meetings
const LinkMeetingDialog = ({ open, onClose, scheduledMeeting, onLink }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      fetchMeetings();
    }
  }, [open]);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/meetings/');
      setMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMeetings = meetings.filter((meeting) =>
    meeting.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Link Recording to: {scheduledMeeting?.title}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Search recordings"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          margin="normal"
          placeholder="Search by filename..."
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto', mt: 2 }}>
            {filteredMeetings.length === 0 ? (
              <Alert severity="info">No recordings found</Alert>
            ) : (
              filteredMeetings.map((meeting) => (
                <React.Fragment key={meeting.id}>
                  <ListItem>
                    <ListItemText
                      primary={meeting.filename}
                      secondary={`Status: ${meeting.status} | Created: ${new Date(
                        meeting.created_at
                      ).toLocaleString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() => onLink(meeting.id)}
                      >
                        Link
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduledMeetings;
