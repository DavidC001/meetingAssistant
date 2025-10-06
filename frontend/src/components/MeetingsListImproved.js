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
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  InputAdornment,
  Divider,
  Stack,
  Autocomplete
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Search as SearchIcon,
  Label as LabelIcon,
  DriveFileMove as DrivFileMoveIcon
} from '@mui/icons-material';
import api from '../api';

const MeetingsListImproved = ({ refreshKey, onMeetingUpdate }) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
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
    
    // Smart polling: only poll if there are processing meetings
    let pollTimeout = null;
    let currentMeetings = meetings;
    
    const scheduleNextPoll = () => {
      const hasProcessingMeetings = currentMeetings.some(m => m.status === 'processing' || m.status === 'pending');
      if (hasProcessingMeetings) {
        pollTimeout = setTimeout(async () => {
          try {
            const response = await api.get('/api/v1/meetings/');
            const updatedMeetings = response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setMeetings(updatedMeetings);
            currentMeetings = updatedMeetings;
            scheduleNextPoll();
          } catch (error) {
            console.error('Error polling meetings:', error);
          }
        }, 15000);
      }
    };
    
    const initialPollTimer = setTimeout(scheduleNextPoll, 5000);
    
    return () => {
      if (pollTimeout) clearTimeout(pollTimeout);
      clearTimeout(initialPollTimer);
    };
  }, [refreshKey]);

  // Group meetings by folder
  const groupedMeetings = React.useMemo(() => {
    const filtered = meetings.filter(meeting => {
      const query = searchQuery.toLowerCase();
      return meeting.filename.toLowerCase().includes(query) ||
             meeting.folder?.toLowerCase().includes(query) ||
             meeting.tags?.toLowerCase().includes(query);
    });

    const groups = {};
    filtered.forEach(meeting => {
      const folder = meeting.folder || 'Uncategorized';
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(meeting);
    });
    return groups;
  }, [meetings, searchQuery]);

  const folders = Object.keys(groupedMeetings).sort();

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
    setAnchorEl(null); // Close menu but keep selectedMeeting
  };

  const handleRenameConfirm = async () => {
    if (!newName || !newName.trim()) {
      setError('Please enter a valid name.');
      return;
    }
    
    const trimmedName = newName.trim();
    if (trimmedName === selectedMeeting.filename) {
      setRenameDialogOpen(false);
      setNewName('');
      return;
    }

    try {
      await api.renameMeeting(selectedMeeting.id, trimmedName);
      setRenameDialogOpen(false);
      setNewName('');
      setSelectedMeeting(null); // Clear after successful operation
      setError(null);
      await fetchMeetings();
      if (onMeetingUpdate) onMeetingUpdate();
    } catch (err) {
      console.error('Rename meeting error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to rename meeting.';
      setError(errorMessage);
      // Don't close dialog on error so user can see the error and retry
    }
  };

  const handleMoveToFolder = () => {
    setNewFolderName(selectedMeeting.folder || '');
    setMoveFolderDialogOpen(true);
    setAnchorEl(null); // Close menu but keep selectedMeeting
  };

  const handleMoveFolderConfirm = async () => {
    try {
      await api.updateMeetingTagsFolder(selectedMeeting.id, selectedMeeting.tags || '', newFolderName.trim());
      setMoveFolderDialogOpen(false);
      setNewFolderName('');
      setSelectedMeeting(null); // Clear after successful operation
      setError(null);
      await fetchMeetings();
      if (onMeetingUpdate) onMeetingUpdate();
    } catch (err) {
      console.error('Move to folder error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to move meeting.';
      setError(errorMessage);
      // Don't close dialog on error so user can see the error and retry
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    setAnchorEl(null); // Close menu but keep selectedMeeting
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteMeeting(selectedMeeting.id);
      setDeleteDialogOpen(false);
      setSelectedMeeting(null); // Clear after successful operation
      setError(null);
      await fetchMeetings();
      if (onMeetingUpdate) onMeetingUpdate();
    } catch (err) {
      console.error('Delete meeting error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to delete meeting.';
      setError(errorMessage);
      // Keep dialog open on error
    }
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

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }));
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

  return (
    <>
      <Card elevation={3}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="h2">
              All Meetings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Search Bar */}
          <TextField
            fullWidth
            placeholder="Search meetings, folders, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {meetings.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No meetings found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload your first meeting recording to get started!
              </Typography>
            </Box>
          ) : folders.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No meetings match your search
              </Typography>
            </Box>
          ) : (
            <Box>
              {folders.map((folder) => (
                <Accordion 
                  key={folder}
                  expanded={expandedFolders[folder] !== false}
                  onChange={() => toggleFolder(folder)}
                  elevation={1}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor: 'action.hover',
                      '&:hover': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      {expandedFolders[folder] !== false ? <FolderOpenIcon color="primary" /> : <FolderIcon color="primary" />}
                      <Typography variant="subtitle1" fontWeight="medium">
                        {folder}
                      </Typography>
                      <Chip 
                        label={groupedMeetings[folder].length} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <List disablePadding>
                      {groupedMeetings[folder].map((meeting, index) => (
                        <React.Fragment key={meeting.id}>
                          {index > 0 && <Divider />}
                          <ListItem
                            sx={{
                              py: 2,
                              position: 'relative',
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                            }}
                            secondaryAction={
                              <Tooltip title="More options">
                                <IconButton
                                  edge="end"
                                  onClick={(e) => handleMenuOpen(e, meeting)}
                                  size="small"
                                >
                                  <MoreVertIcon />
                                </IconButton>
                              </Tooltip>
                            }
                          >
                            <Box 
                              component={Link}
                              to={`/meetings/${meeting.id}`}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
                                textDecoration: 'none',
                                color: 'inherit',
                                pr: 6,
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
                                    {meeting.tags && (
                                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                        {meeting.tags.split(',').map((tag, i) => (
                                          <Chip
                                            key={i}
                                            icon={<LabelIcon />}
                                            label={tag.trim()}
                                            size="small"
                                            variant="outlined"
                                          />
                                        ))}
                                      </Stack>
                                    )}
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
                              
                              <Chip
                                label={meeting.status}
                                color={getStatusColor(meeting.status)}
                                size="small"
                                variant="outlined"
                                sx={{ ml: 1 }}
                              />
                            </Box>
                          </ListItem>
                        </React.Fragment>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
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
        <MenuItem onClick={handleMoveToFolder}>
          <DrivFileMoveIcon sx={{ mr: 1 }} fontSize="small" />
          Move to Folder
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => { setRenameDialogOpen(false); setSelectedMeeting(null); }} maxWidth="sm" fullWidth>
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
            helperText={newName !== null && newName.trim().length === 0 ? "Meeting name cannot be empty" : ""}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newName && newName.trim()) {
                handleRenameConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRenameDialogOpen(false); setSelectedMeeting(null); }}>
            Cancel
          </Button>
          <Button 
            onClick={handleRenameConfirm} 
            variant="contained"
            disabled={!newName || !newName.trim() || newName.trim() === selectedMeeting?.filename}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move to Folder Dialog */}
      <Dialog open={moveFolderDialogOpen} onClose={() => { setMoveFolderDialogOpen(false); setSelectedMeeting(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Move to Folder</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={folders.filter(f => f !== 'Uncategorized')}
            value={newFolderName}
            onChange={(event, newValue) => {
              setNewFolderName(newValue || '');
            }}
            onInputChange={(event, newInputValue) => {
              setNewFolderName(newInputValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                margin="dense"
                label="Folder Name"
                fullWidth
                variant="outlined"
                helperText="Select existing folder or type new name. Leave empty for 'Uncategorized'"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleMoveFolderConfirm();
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <CreateNewFolderIcon />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMoveFolderDialogOpen(false); setSelectedMeeting(null); }}>
            Cancel
          </Button>
          <Button 
            onClick={handleMoveFolderConfirm} 
            variant="contained"
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setSelectedMeeting(null); }}>
        <DialogTitle>Delete Meeting</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedMeeting?.filename}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setSelectedMeeting(null); }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MeetingsListImproved;
