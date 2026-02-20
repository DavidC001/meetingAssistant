/**
 * MeetingsListContainer
 * Orchestrates meeting list data (via useMeetingsList) with list UI and inline dialogs.
 */

import React, { useState } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  GraphicEq as AudioIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useMeetingsList } from '../hooks';
import { getStatusColor, getStatusIcon } from '../../../../utils';
import { formatDate } from '../../../../utils/dateHelpers';

const MeetingsListContainer = ({ refreshKey, onMeetingUpdate }) => {
  const { meetings, isLoading, error, actions } = useMeetingsList({ refreshKey, onMeetingUpdate });

  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

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

  const handleRenameOpen = () => {
    setNewName(selectedMeeting.filename);
    setRenameDialogOpen(true);
    handleMenuClose();
  };

  const handleRenameConfirm = async () => {
    if (!newName?.trim()) return;
    const success = await actions.rename(selectedMeeting, newName);
    if (success) {
      setRenameDialogOpen(false);
      setNewName('');
    }
  };

  const handleDeleteOpen = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    const success = await actions.deleteMeeting(selectedMeeting);
    if (success) setDeleteDialogOpen(false);
  };

  if (isLoading && meetings.length === 0) {
    return (
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            All Meetings
          </Typography>
          {[...Array(3)].map((_, i) => (
            <Box key={i} sx={{ mb: 2 }}>
              <Skeleton variant="text" height={40} />
              <Skeleton variant="text" height={20} width="60%" />
            </Box>
          ))}
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
                    '&:hover': { backgroundColor: 'action.hover' },
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
                          {formatDate(meeting.meeting_date || meeting.created_at)}
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
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            navigate(`/meetings/${selectedMeeting?.id}`);
          }}
        >
          <ViewIcon sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={handleRenameOpen}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            actions.regenerateAudio(selectedMeeting);
            handleMenuClose();
          }}
          disabled={selectedMeeting?.status !== 'completed'}
        >
          <AudioIcon sx={{ mr: 1 }} fontSize="small" />
          Regenerate Audio
        </MenuItem>
        <MenuItem
          onClick={() => {
            actions.restartProcessing(selectedMeeting);
            handleMenuClose();
          }}
          disabled={selectedMeeting?.status !== 'failed'}
        >
          <RefreshIcon sx={{ mr: 1 }} fontSize="small" />
          Restart Processing
        </MenuItem>
        <MenuItem
          onClick={() => {
            actions.downloadTranscript(selectedMeeting, 'txt');
            handleMenuClose();
          }}
        >
          <DownloadIcon sx={{ mr: 1 }} fontSize="small" /> Download (TXT)
        </MenuItem>
        <MenuItem
          onClick={() => {
            actions.downloadTranscript(selectedMeeting, 'json');
            handleMenuClose();
          }}
        >
          <DownloadIcon sx={{ mr: 1 }} fontSize="small" /> Download (JSON)
        </MenuItem>
        <MenuItem
          onClick={() => {
            actions.downloadTranscript(selectedMeeting, 'srt');
            handleMenuClose();
          }}
        >
          <DownloadIcon sx={{ mr: 1 }} fontSize="small" /> Download (SRT)
        </MenuItem>
        <MenuItem onClick={handleDeleteOpen} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
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
            error={newName !== null && newName.trim().length === 0}
            helperText={
              newName !== null && newName.trim().length === 0 ? 'Meeting name cannot be empty' : ''
            }
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newName?.trim()) handleRenameConfirm();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRenameConfirm}
            variant="contained"
            disabled={!newName?.trim() || newName.trim() === selectedMeeting?.filename}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Meeting</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedMeeting?.filename}"? This action cannot be
            undone.
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

export default MeetingsListContainer;
