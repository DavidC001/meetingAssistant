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
      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h4" component="h2" fontWeight="600">
                📚 All Meetings
              </Typography>
              <Chip 
                label={`${meetings.length} total`} 
                color="primary" 
                variant="outlined" 
                size="medium"
              />
            </Box>
          </Box>

          {/* Search Bar */}
          <TextField
            fullWidth
            placeholder="🔍 Search meetings, folders, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                backgroundColor: '#f8f9fa',
                '&:hover': {
                  backgroundColor: '#e9ecef'
                }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
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
                  elevation={2}
                  sx={{ 
                    mb: 2,
                    borderRadius: 2,
                    '&:before': { display: 'none' },
                    overflow: 'hidden'
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor: 'primary.light',
                      color: 'primary.contrastText',
                      minHeight: 64,
                      '&:hover': {
                        backgroundColor: 'primary.main',
                      },
                      '& .MuiAccordionSummary-content': {
                        my: 2
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      {expandedFolders[folder] !== false ? 
                        <FolderOpenIcon sx={{ fontSize: 28, color: 'inherit' }} /> : 
                        <FolderIcon sx={{ fontSize: 28, color: 'inherit' }} />
                      }
                      <Typography variant="h6" fontWeight="600">
                        {folder}
                      </Typography>
                      <Chip 
                        label={`${groupedMeetings[folder].length} meeting${groupedMeetings[folder].length !== 1 ? 's' : ''}`}
                        size="medium" 
                        sx={{ 
                          ml: 'auto',
                          bgcolor: 'white',
                          color: 'primary.main',
                          fontWeight: 600
                        }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                    <List disablePadding>
                      {groupedMeetings[folder].map((meeting, index) => (
                        <React.Fragment key={meeting.id}>
                          <Paper
                            elevation={1}
                            sx={{
                              mb: 2,
                              borderRadius: 2,
                              overflow: 'hidden',
                              transition: 'all 0.3s',
                              '&:hover': {
                                elevation: 3,
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }
                            }}
                          >
                            <ListItem
                              sx={{
                                py: 3,
                                px: 3,
                                position: 'relative',
                                bgcolor: 'white'
                              }}
                              secondaryAction={
                                <Tooltip title="More options">
                                  <IconButton
                                    edge="end"
                                    onClick={(e) => handleMenuOpen(e, meeting)}
                                    size="medium"
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
                                  gap: 2
                                }}
                              >
                                <Box sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  width: 48,
                                  height: 48,
                                  borderRadius: 2,
                                  bgcolor: `${getStatusColor(meeting.status)}.lighter`
                                }}>
                                  {getStatusIcon(meeting.status)}
                                </Box>
                                
                                <ListItemText
                                  primary={
                                    <Typography variant="h6" fontWeight="600" sx={{ mb: 0.5 }}>
                                      {meeting.filename}
                                    </Typography>
                                  }
                                  secondary={
                                    <Box>
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        📅 {formatDate(meeting.created_at)}
                                      </Typography>
                                      {meeting.tags && (
                                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                          {meeting.tags.split(',').map((tag, i) => (
                                            <Chip
                                              key={i}
                                              icon={<LabelIcon />}
                                              label={tag.trim()}
                                              size="small"
                                              variant="filled"
                                              color="primary"
                                              sx={{ bgcolor: 'primary.lighter' }}
                                            />
                                          ))}
                                        </Stack>
                                      )}
                                      {meeting.status === 'processing' && (
                                        <Box sx={{ mt: 2, width: '250px' }}>
                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="caption" fontWeight="600" color="primary">
                                              Processing...
                                            </Typography>
                                            <Typography variant="caption" fontWeight="600" color="primary">
                                              {Math.round(meeting.overall_progress || 0)}%
                                            </Typography>
                                          </Box>
                                          <LinearProgress
                                            variant="determinate"
                                            value={meeting.overall_progress || 0}
                                            sx={{ height: 8, borderRadius: 2 }}
                                          />
                                        </Box>
                                      )}
                                    </Box>
                                  }
                                />
                                
                                <Chip
                                  label={meeting.status.toUpperCase()}
                                  color={getStatusColor(meeting.status)}
                                  size="medium"
                                  sx={{ 
                                    ml: 1,
                                    fontWeight: 600,
                                    minWidth: 100
                                  }}
                                />
                              </Box>
                            </ListItem>
                          </Paper>
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
