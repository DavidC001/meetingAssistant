import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Box,
  LinearProgress,
  Skeleton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Tooltip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import api from '../api';

const MeetingsList = ({ refreshKey, onMeetingUpdate }) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/meetings/');
      setMeetings(response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setError(null);
    } catch (err) {
      setError('Failed to fetch meetings.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
    
    // Smart polling: only poll if there are processing meetings, with longer intervals
    let pollTimeout = null;
    let currentMeetings = meetings; // Capture current meetings for closure
    
    const scheduleNextPoll = () => {
      const hasProcessingMeetings = currentMeetings.some(m => m.status === 'processing' || m.status === 'pending');
      if (hasProcessingMeetings) {
        // Poll every 15 seconds for processing meetings (much less aggressive)
        pollTimeout = setTimeout(async () => {
          try {
            const response = await api.get('/api/v1/meetings/');
            const updatedMeetings = response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setMeetings(updatedMeetings);
            currentMeetings = updatedMeetings; // Update reference
            scheduleNextPoll();
          } catch (error) {
            console.error('Error polling meetings:', error);
          }
        }, 15000);
      }
    };
    
    // Start polling after initial load
    const initialPollTimer = setTimeout(scheduleNextPoll, 5000);
    
    return () => {
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
      clearTimeout(initialPollTimer);
    };
  }, [refreshKey]); // Only depend on refreshKey

  const handleMenuOpen = (event, meeting) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedMeeting(meeting);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMeeting(null);
  };

  const handleRename = () => {
    setNewName(selectedMeeting.filename);
    setRenameDialogOpen(true);
    handleMenuClose();
  };

  const handleRenameConfirm = async () => {
    if (newName && newName.trim() && newName !== selectedMeeting.filename) {
      try {
        await api.renameMeeting(selectedMeeting.id, newName.trim());
        onMeetingUpdate();
      } catch (err) {
        setError('Failed to rename meeting.');
        console.error(err);
      }
    }
    setRenameDialogOpen(false);
    setNewName('');
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteMeeting(selectedMeeting.id);
      onMeetingUpdate();
    } catch (err) {
      setError('Failed to delete meeting.');
      console.error(err);
    }
    setDeleteDialogOpen(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'processing':
        return <ScheduleIcon color="primary" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <PendingIcon color="warning" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'primary';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading && meetings.length === 0) {
    return (
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            All Meetings
          </Typography>
          <Box>
            {[...Array(3)].map((_, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Skeleton variant="text" height={40} />
                <Skeleton variant="text" height={20} width="60%" />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={3}>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            All Meetings
          </Typography>
          
          {meetings.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No meetings found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload your first meeting recording to get started!
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {meetings.map((meeting) => (
                <ListItem
                  key={meeting.id}
                  component={Link}
                  to={`/meetings/${meeting.id}`}
                  sx={{
                    textDecoration: 'none',
                    color: 'inherit',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                    {getStatusIcon(meeting.status)}
                  </Box>
                  
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" fontWeight="medium">
                        {meeting.filename}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(meeting.created_at)}
                        </Typography>
                        {meeting.status === 'processing' && (
                          <Box sx={{ mt: 1, width: '200px' }}>
                            <LinearProgress
                              variant="determinate"
                              value={meeting.overall_progress || 0}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {Math.round(meeting.overall_progress || 0)}% complete
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={meeting.status}
                      color={getStatusColor(meeting.status)}
                      size="small"
                      variant="outlined"
                    />
                    
                    <ListItemSecondaryAction>
                      <Tooltip title="More options">
                        <IconButton
                          edge="end"
                          onClick={(e) => handleMenuOpen(e, meeting)}
                          size="small"
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRename}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Rename
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename Meeting</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Meeting Name"
            fullWidth
            variant="outlined"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRenameConfirm} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Meeting</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedMeeting?.filename}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MeetingsList;
