import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepIcon,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Skeleton,
  Alert,
  AlertTitle,
  Button,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Menu,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  PlayArrow as PlayArrowIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  Summarize as SummarizeIcon,
  Transcribe as TranscribeIcon,
  AccessTime as AccessTimeIcon,
  PlayCircle as PlayCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  RestartAlt as RestartAltIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../api';
import Chat from './Chat';

const ProcessingCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  color: 'white',
  '& .MuiLinearProgress-root': {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: 'white',
    },
  },
}));

const MeetingDetails = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [newSpeaker, setNewSpeaker] = useState({ name: '', label: '' });
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [tags, setTags] = useState('');
  const [folder, setFolder] = useState('');
  const [notes, setNotes] = useState('');
  const [newActionItem, setNewActionItem] = useState({ task: '', owner: '', due_date: '', isAdding: false });
  const [editingActionItem, setEditingActionItem] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [availableFolders, setAvailableFolders] = useState([]);
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [editingAttachment, setEditingAttachment] = useState(null);

  // Add manual refresh function
  const handleManualRefresh = async () => {
    try {
      setIsUpdating(true);
      const response = await api.get(`/api/v1/meetings/${meetingId}`);
      setMeeting(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to refresh meeting details.');
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Add restart processing function
  const handleRestartProcessing = async () => {
    console.log('handleRestartProcessing called'); // Debug log
    if (!window.confirm('Are you sure you want to restart processing? This will cancel any current processing and start over.')) {
      console.log('User cancelled restart'); // Debug log
      return;
    }
    
    try {
      console.log('Starting restart processing request...'); // Debug log
      setIsUpdating(true);
      const response = await api.post(`/api/v1/meetings/${meetingId}/restart-processing`);
      console.log('Restart processing response:', response.data); // Debug log
      setMeeting(response.data);
      setError(null);
    } catch (err) {
      console.error('Restart processing error:', err); // Enhanced debug log
      setError('Failed to restart processing.');
    } finally {
      setIsUpdating(false);
    }
  };

  const stageDisplayNames = {
    'conversion': 'Converting Audio',
    'diarization': 'Speaker Identification', 
    'transcription': 'Speech Recognition',
    'analysis': 'AI Analysis'
  };

  const stageOrder = ['conversion', 'diarization', 'transcription', 'analysis'];

  const getStageStatus = (stageName, currentStage, overallProgress) => {
    const currentIndex = stageOrder.indexOf(currentStage);
    const targetIndex = stageOrder.indexOf(stageName);
    
    if (overallProgress >= 100) return 'completed';
    if (currentIndex > targetIndex) return 'completed';
    if (currentIndex === targetIndex) return 'active';
    return 'pending';
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

  const getActiveStep = (currentStage) => {
    const stages = ['conversion', 'diarization', 'transcription', 'analysis'];
    const index = stages.indexOf(currentStage);
    return index >= 0 ? index : 0;
  };

  // Speaker handlers
  const handleAddSpeaker = async () => {
    if (!newSpeaker.name) return;
    try {
      const res = await api.addSpeaker(meetingId, newSpeaker);
      setSpeakers([...speakers, res.data]);
      setNewSpeaker({ name: '', label: '' });
    } catch (err) { setError('Failed to add speaker'); }
  };

  const handleUpdateSpeaker = async () => {
    if (!editingSpeaker) return;
    try {
      const res = await api.updateSpeaker(editingSpeaker.id, editingSpeaker);
      setSpeakers(speakers.map(s => s.id === res.data.id ? res.data : s));
      setEditingSpeaker(null);
      // Refresh meeting data to show updated transcript and action items
      await handleManualRefresh();
    } catch (err) { 
      setError('Failed to update speaker');
      console.error('Update speaker error:', err);
    }
  };

  const handleDeleteSpeaker = async (id) => {
    try {
      await api.deleteSpeaker(id);
      setSpeakers(speakers.filter(s => s.id !== id));
    } catch (err) { setError('Failed to delete speaker'); }
  };

  // Action Item handlers
  const handleAddActionItem = async () => {
    if (!newActionItem.task || !newActionItem.task.trim()) return;
    try {
      const itemData = {
        task: newActionItem.task,
        owner: newActionItem.owner,
        due_date: newActionItem.due_date
      };
      const res = await api.addActionItem(meeting.transcription.id, itemData);
      setMeeting({ ...meeting, transcription: { ...meeting.transcription, action_items: [...meeting.transcription.action_items, res.data] } });
      setNewActionItem({ task: '', owner: '', due_date: '', isAdding: false });
    } catch (err) { 
      setError('Failed to add action item'); 
      console.error('Add action item error:', err);
    }
  };

  const handleUpdateActionItem = async () => {
    if (!editingActionItem || !editingActionItem.task || !editingActionItem.task.trim()) return;
    try {
      const itemData = {
        task: editingActionItem.task,
        owner: editingActionItem.owner,
        due_date: editingActionItem.due_date
      };
      const res = await api.updateActionItem(editingActionItem.id, itemData);
      setMeeting({ ...meeting, transcription: { ...meeting.transcription, action_items: meeting.transcription.action_items.map(a => a.id === res.data.id ? res.data : a) } });
      setEditingActionItem(null);
    } catch (err) { 
      setError('Failed to update action item'); 
      console.error('Update action item error:', err);
    }
  };

  const handleDeleteActionItem = async (id) => {
    try {
      await api.deleteActionItem(id);
      setMeeting({ ...meeting, transcription: { ...meeting.transcription, action_items: meeting.transcription.action_items.filter(a => a.id !== id) } });
    } catch (err) { setError('Failed to delete action item'); }
  };

  // Tags/Folder handlers
  const handleUpdateTagsFolder = async () => {
    try {
      const res = await api.updateMeetingTagsFolder(meetingId, tags, folder);
      setMeeting(res.data);
    } catch (err) { setError('Failed to update tags/folder'); }
  };

  // Notes handler
  const handleUpdateNotes = async () => {
    try {
      const res = await api.updateMeetingNotes(meetingId, notes);
      setMeeting(res.data);
    } catch (err) { setError('Failed to update notes'); }
  };

  // Delete meeting handlers
  const handleDeleteMeeting = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteMeetingConfirm = async () => {
    try {
      setIsUpdating(true);
      await api.deleteMeeting(meetingId);
      setDeleteDialogOpen(false);
      navigate('/'); // Navigate back to the main page
    } catch (err) {
      console.error('Delete meeting error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to delete meeting. Please try again.';
      setError(errorMessage);
      setDeleteDialogOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  // Rename meeting handlers
  const handleRenameMeeting = () => {
    setNewName(meeting.filename);
    setRenameDialogOpen(true);
  };

  const handleRenameMeetingConfirm = async () => {
    if (!newName || !newName.trim()) {
      setError('Please enter a valid name.');
      return;
    }
    
    const trimmedName = newName.trim();
    if (trimmedName === meeting.filename) {
      setRenameDialogOpen(false);
      setNewName('');
      return; // No change needed
    }

    try {
      setIsUpdating(true);
      const response = await api.renameMeeting(meetingId, trimmedName);
      console.log('Rename response:', response);
      setMeeting({ ...meeting, filename: trimmedName });
      setError(null);
      setRenameDialogOpen(false);
      setNewName('');
    } catch (err) {
      console.error('Rename meeting error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to rename meeting. Please try again.';
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // Download meeting handlers
  const handleDownloadMenuOpen = (event) => {
    setDownloadMenuAnchor(event.currentTarget);
  };

  const handleDownloadMenuClose = () => {
    setDownloadMenuAnchor(null);
  };

  const handleDownloadMeeting = async (format) => {
    handleDownloadMenuClose();
    
    try {
      setIsUpdating(true);
      const response = await api.downloadMeeting(meetingId, format);
      
      // Create a blob from the response data
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      
      // Create a link element and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from meeting name
      const baseName = meeting.filename.replace(/\.[^/.]+$/, ""); // Remove extension
      link.download = `${baseName}.${format}`;
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setError(null);
    } catch (err) {
      console.error('Download meeting error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to download meeting. Please try again.';
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // Attachment handlers
  const fetchAttachments = async () => {
    try {
      const response = await api.getMeetingAttachments(meetingId);
      setAttachments(response.data);
    } catch (err) {
      console.error('Error fetching attachments:', err);
    }
  };

  const handleAttachmentDialogOpen = () => {
    setAttachmentDialogOpen(true);
    setSelectedFile(null);
    setAttachmentDescription('');
  };

  const handleAttachmentDialogClose = () => {
    setAttachmentDialogOpen(false);
    setSelectedFile(null);
    setAttachmentDescription('');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadAttachment = async () => {
    if (!selectedFile) return;
    
    try {
      setUploadingAttachment(true);
      await api.uploadAttachment(meetingId, selectedFile, attachmentDescription);
      await fetchAttachments();
      handleAttachmentDialogClose();
      setError(null);
    } catch (err) {
      console.error('Upload attachment error:', err);
      setError('Failed to upload attachment. Please try again.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId, filename) => {
    try {
      const response = await api.downloadAttachment(attachmentId);
      
      // Create a blob and download
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download attachment error:', err);
      setError('Failed to download attachment.');
    }
  };

  const handlePreviewAttachment = (attachmentId) => {
    // Open preview in new tab
    const previewUrl = api.previewAttachment(attachmentId);
    window.open(previewUrl, '_blank');
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) {
      return;
    }
    
    try {
      await api.deleteAttachment(attachmentId);
      await fetchAttachments();
      setError(null);
    } catch (err) {
      console.error('Delete attachment error:', err);
      setError('Failed to delete attachment.');
    }
  };

  const handleEditAttachmentDescription = (attachment) => {
    setEditingAttachment(attachment);
  };

  const handleUpdateAttachmentDescription = async () => {
    if (!editingAttachment) return;
    
    try {
      await api.updateAttachment(editingAttachment.id, editingAttachment.description);
      await fetchAttachments();
      setEditingAttachment(null);
      setError(null);
    } catch (err) {
      console.error('Update attachment error:', err);
      setError('Failed to update attachment description.');
    }
  };

  const fetchAvailableFolders = async () => {
    try {
      const response = await api.get('/api/v1/meetings/');
      const folders = [...new Set(response.data.map(m => m.folder).filter(f => f && f !== 'Uncategorized'))];
      setAvailableFolders(folders.sort());
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  useEffect(() => {
  const fetchMeetingDetails = async (isInitial = false) => {
      try {
        if (isInitial) {
          setIsInitialLoading(true);
        } else {
          setIsUpdating(true);
        }
        const response = await api.get(`/api/v1/meetings/${meetingId}`);
  setMeeting(response.data);
  setTags(response.data.tags || '');
  setFolder(response.data.folder || '');
  setNotes(response.data.notes || '');
        setError(null);
        
        // Fetch available folders for autocomplete
        await fetchAvailableFolders();
        
        // Fetch attachments
        await fetchAttachments();
        
        return response.data;
      } catch (err) {
        setError('Failed to fetch meeting details.');
        console.error(err);
        return null;
      } finally {
        if (isInitial) {
          setIsInitialLoading(false);
        } else {
          setIsUpdating(false);
        }
      }
    };

    let pollTimeout = null;
    let isPolling = false;

    const startSmartPolling = (currentMeeting) => {
      if (isPolling || !currentMeeting || (currentMeeting.status !== 'pending' && currentMeeting.status !== 'processing')) {
        return;
      }

      isPolling = true;
      
      // Smart polling intervals based on status and progress
      let pollInterval;
      if (currentMeeting.status === 'pending') {
        pollInterval = 10000; // 10 seconds for pending
      } else if (currentMeeting.overall_progress && currentMeeting.overall_progress > 80) {
        pollInterval = 3000; // 3 seconds when close to completion
      } else if (currentMeeting.overall_progress && currentMeeting.overall_progress > 50) {
        pollInterval = 5000; // 5 seconds in middle stages
      } else {
        pollInterval = 8000; // 8 seconds for early stages
      }

      const doPoll = async () => {
        try {
          const updatedMeeting = await fetchMeetingDetails(false);
          if (updatedMeeting && (updatedMeeting.status === 'pending' || updatedMeeting.status === 'processing')) {
            // Continue polling with updated intervals
            pollTimeout = setTimeout(doPoll, pollInterval);
          } else {
            // Processing completed or failed, stop polling
            isPolling = false;
          }
        } catch (err) {
          console.error('Error during polling:', err);
          // On error, stop polling and let user manually refresh
          isPolling = false;
        }
      };

      pollTimeout = setTimeout(doPoll, pollInterval);
    };

    // Initial fetch
    fetchMeetingDetails(true).then((initialMeeting) => {
      if (initialMeeting) {
        // Fetch speakers
        api.getSpeakers(meetingId).then(res => setSpeakers(res.data)).catch(() => setSpeakers([]));
        // Start polling only if meeting is processing
        setTimeout(() => startSmartPolling(initialMeeting), 2000);
      }
    });

    return () => {
      isPolling = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };

  }, [meetingId]);

  if (isInitialLoading) {
    return (
      <Box>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        <Card elevation={3}>
          <CardContent>
            <Skeleton variant="text" height={40} width="60%" />
            <Skeleton variant="text" height={20} width="40%" sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={200} />
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!meeting) {
    return (
      <Box>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        <Alert severity="info">No meeting data found.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
        variant="outlined"
      >
        Back to Dashboard
      </Button>

      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">
              {meeting.filename}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isUpdating && (
                <CircularProgress size={16} sx={{ mr: 1 }} />
              )}
              {meeting.transcription && (
                <>
                  <Button 
                    variant="contained" 
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadMenuOpen}
                    sx={{ mr: 1 }}
                  >
                    Download
                  </Button>
                  <Menu
                    anchorEl={downloadMenuAnchor}
                    open={Boolean(downloadMenuAnchor)}
                    onClose={handleDownloadMenuClose}
                  >
                    <MenuItem onClick={() => handleDownloadMeeting('txt')}>
                      Text (.txt)
                    </MenuItem>
                    <MenuItem onClick={() => handleDownloadMeeting('json')}>
                      JSON (.json)
                    </MenuItem>
                    <MenuItem onClick={() => handleDownloadMeeting('docx')}>
                      Word Document (.docx)
                    </MenuItem>
                    <MenuItem onClick={() => handleDownloadMeeting('pdf')}>
                      PDF (.pdf)
                    </MenuItem>
                  </Menu>
                </>
              )}
              <Button 
                variant="outlined" 
                size="small"
                startIcon={<EditIcon />}
                onClick={handleRenameMeeting}
                sx={{ mr: 1 }}
              >
                Rename
              </Button>
              <Button 
                variant="outlined" 
                color="error" 
                size="small"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteMeeting}
                sx={{ mr: 1 }}
              >
                Delete Meeting
              </Button>
              <Chip
                label={meeting.status}
                color={getStatusColor(meeting.status)}
                variant="filled"
                size="large"
              />
            </Box>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            <CalendarIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Uploaded on: {new Date(meeting.created_at).toLocaleString()}
          </Typography>
          
          {/* Tags and Folder Edit - Improved UI */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="medium">
              Organization
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
              <Autocomplete
                freeSolo
                options={availableFolders}
                value={folder}
                onChange={(event, newValue) => {
                  setFolder(newValue || '');
                }}
                onInputChange={(event, newInputValue) => {
                  setFolder(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Folder"
                    placeholder="e.g., Team Meetings, Q1 2024"
                    size="small"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <Box component="span" sx={{ mr: 1 }}>
                            📁
                          </Box>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                fullWidth
              />
              <TextField
                label="Tags"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="e.g., urgent, planning, review"
                helperText="Comma separated"
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <Box component="span" sx={{ mr: 1 }}>
                      🏷️
                    </Box>
                  ),
                }}
              />
              <Button 
                onClick={handleUpdateTagsFolder} 
                size="medium" 
                variant="contained"
                sx={{ minWidth: 100, height: 40 }}
              >
                Save
              </Button>
            </Box>
          </Paper>

          {/* Notes Section */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'info.lighter', borderRadius: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="medium">
              Meeting Notes
            </Typography>
            <Box>
              <TextField
                label="Notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes about this meeting..."
                multiline
                rows={4}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <Box component="span" sx={{ mr: 1, alignSelf: 'flex-start', mt: 1 }}>
                      📝
                    </Box>
                  ),
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button 
                  onClick={handleUpdateNotes} 
                  size="medium" 
                  variant="contained"
                >
                  Save Notes
                </Button>
              </Box>
            </Box>
          </Paper>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {/* ...existing file info boxes... */}
          </Grid>
        </CardContent>
      </Card>

      {/* Audio Player Section */}
      {meeting.audio_filepath && (
        <Card elevation={3} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PlayCircleIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h5">Audio Playback</Typography>
            </Box>
            <Box sx={{ 
              bgcolor: 'grey.100', 
              p: 2, 
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Listen to the meeting audio
              </Typography>
              <audio 
                controls 
                style={{ width: '100%' }}
                preload="metadata"
              >
                <source 
                  src={`/api/v1/meetings/${meeting.id}/audio`} 
                  type="audio/mpeg" 
                />
                Your browser does not support the audio element.
              </audio>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Processing Information Section */}
      {(meeting.status === 'processing' || meeting.status === 'pending') && (
        <Card elevation={3} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <CircularProgress size={24} sx={{ mr: 2 }} />
              <Typography variant="h5" sx={{ flexGrow: 1 }}>Processing Status</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {(meeting.status === 'processing' || meeting.status === 'failed') && (
                  <Button
                    startIcon={<RestartAltIcon />}
                    onClick={handleRestartProcessing}
                    disabled={isUpdating}
                    size="small"
                    variant="outlined"
                    color="warning"
                  >
                    Restart
                  </Button>
                )}
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={handleManualRefresh}
                  disabled={isUpdating}
                  size="small"
                  variant="outlined"
                >
                  {isUpdating ? 'Refreshing...' : 'Refresh'}
                </Button>
              </Box>
            </Box>
            
            <Stepper activeStep={getActiveStep(meeting.current_stage)} alternativeLabel sx={{ mb: 3 }}>
              <Step>
                <StepLabel>File Conversion</StepLabel>
              </Step>
              <Step>
                <StepLabel>Speaker Diarization</StepLabel>
              </Step>
              <Step>
                <StepLabel>Transcription</StepLabel>
              </Step>
              <Step>
                <StepLabel>Analysis</StepLabel>
              </Step>
            </Stepper>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Overall Progress: {Math.round(meeting.overall_progress || 0)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={meeting.overall_progress || 0} 
                sx={{ height: 8, borderRadius: 4, mb: 2 }}
              />
              
              {meeting.current_stage && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Current Stage: {stageDisplayNames[meeting.current_stage] || meeting.current_stage.replace('_', ' ').toUpperCase()} 
                    {meeting.stage_progress ? ` (${meeting.stage_progress.toFixed(0)}%)` : ''}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={meeting.stage_progress || 0} 
                    sx={{ height: 6, borderRadius: 3 }}
                    color="secondary"
                  />
                </Box>
              )}
            </Box>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {meeting.processing_start_time && (
                <Grid item xs={12} sm={6}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <AccessTimeIcon sx={{ fontSize: 18, mr: 1, color: 'primary.main' }} />
                      <Typography variant="subtitle2">Processing Started</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(meeting.processing_start_time).toLocaleString()}
                    </Typography>
                    {meeting.processing_start_time && (
                      <Typography variant="caption" color="text.secondary">
                        {Math.floor((new Date() - new Date(meeting.processing_start_time)) / (1000 * 60))} minutes ago
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              )}
              
              {meeting.stage_start_time && meeting.current_stage && (
                <Grid item xs={12} sm={6}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PlayCircleIcon sx={{ fontSize: 18, mr: 1, color: 'secondary.main' }} />
                      <Typography variant="subtitle2">Current Stage</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {stageDisplayNames[meeting.current_stage] || meeting.current_stage}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Started {Math.floor((new Date() - new Date(meeting.stage_start_time)) / (1000 * 60))} min ago
                    </Typography>
                  </Paper>
                </Grid>
              )}
              
              {meeting.estimated_duration && (
                <Grid item xs={12} sm={6}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 18, mr: 1, color: 'info.main' }} />
                      <Typography variant="subtitle2">Estimated Duration</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      ~{meeting.estimated_duration} minutes
                    </Typography>
                    {meeting.processing_start_time && meeting.overall_progress > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {(() => {
                          const elapsed = (new Date() - new Date(meeting.processing_start_time)) / (1000 * 60);
                          const totalEstimated = elapsed / (meeting.overall_progress / 100);
                          const remaining = Math.max(0, totalEstimated - elapsed);
                          return `~${Math.ceil(remaining)} min remaining`;
                        })()}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              )}
              
              {meeting.file_size && (
                <Grid item xs={12} sm={6}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <InfoIcon sx={{ fontSize: 18, mr: 1, color: 'success.main' }} />
                      <Typography variant="subtitle2">File Details</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {(meeting.file_size / (1024 * 1024)).toFixed(1)} MB
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Processing rate: {meeting.processing_start_time && meeting.overall_progress > 0 ? 
                        `${((meeting.file_size / (1024 * 1024)) / ((new Date() - new Date(meeting.processing_start_time)) / (1000 * 60)) * (meeting.overall_progress / 100)).toFixed(1)} MB/min` : 
                        'Calculating...'}
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
            
            {meeting.processing_logs && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      Processing Logs & Details
                    </Typography>
                    <Chip 
                      label={`${(Array.isArray(meeting.processing_logs) ? meeting.processing_logs : meeting.processing_logs.split('\n')).length} entries`} 
                      size="small" 
                      variant="outlined" 
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Paper elevation={0} sx={{ bgcolor: 'grey.900', color: 'white', p: 2, borderRadius: 1 }}>
                    <Typography variant="body2" component="pre" sx={{ 
                      fontFamily: 'monospace', 
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.75rem',
                      lineHeight: 1.4,
                      margin: 0
                    }}>
                      {Array.isArray(meeting.processing_logs) ? 
                        meeting.processing_logs.join('\n') : 
                        meeting.processing_logs}
                    </Typography>
                  </Paper>
                  {meeting.current_stage && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Current Stage Details:</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        • Stage: {stageDisplayNames[meeting.current_stage] || meeting.current_stage}
                      </Typography>
                      {meeting.stage_progress && (
                        <Typography variant="body2">
                          • Stage Progress: {meeting.stage_progress.toFixed(1)}%
                        </Typography>
                      )}
                      {meeting.stage_start_time && (
                        <Typography variant="body2">
                          • Stage Duration: {Math.floor((new Date() - new Date(meeting.stage_start_time)) / (1000 * 60))} minutes
                        </Typography>
                      )}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )}
            
            {meeting.error_message && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Processing Error</AlertTitle>
                {meeting.error_message}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {meeting.status === 'completed' && meeting.transcription ? (
        <Grid container spacing={3}>
          {/* Speaker Management Section - Prominent at top */}
          {speakers && speakers.length > 0 && (
            <Grid item xs={12}>
              <Card elevation={3}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h5">Speakers</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                      Rename speakers to update them throughout the transcript and action items
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {speakers.map(speaker => (
                      <Grid item xs={12} sm={6} md={4} key={speaker.id}>
                        <Paper 
                          elevation={editingSpeaker?.id === speaker.id ? 3 : 1} 
                          sx={{ 
                            p: 2, 
                            border: editingSpeaker?.id === speaker.id ? '2px solid' : '1px solid',
                            borderColor: editingSpeaker?.id === speaker.id ? 'primary.main' : 'grey.300',
                            transition: 'all 0.2s'
                          }}
                        >
                          {editingSpeaker?.id === speaker.id ? (
                            <Box>
                              <Box sx={{ 
                                mb: 2, 
                                p: 1.5, 
                                bgcolor: 'primary.light', 
                                borderRadius: 1,
                                textAlign: 'center'
                              }}>
                                <Typography variant="caption" sx={{ color: 'primary.contrastText', fontWeight: 'bold' }}>
                                  DETECTED AS
                                </Typography>
                                <Typography variant="h6" sx={{ color: 'primary.contrastText', mt: 0.5 }}>
                                  {editingSpeaker.label || 'Unknown'}
                                </Typography>
                              </Box>
                              <TextField
                                fullWidth
                                label="Rename to"
                                value={editingSpeaker.name}
                                onChange={e => setEditingSpeaker({ ...editingSpeaker, name: e.target.value })}
                                size="small"
                                placeholder="Enter speaker's real name"
                                autoFocus
                                sx={{ mb: 2 }}
                                helperText="This name will replace the speaker label throughout the transcript"
                              />
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button 
                                  onClick={handleUpdateSpeaker} 
                                  size="small" 
                                  variant="contained"
                                  fullWidth
                                  disabled={!editingSpeaker.name || !editingSpeaker.name.trim()}
                                >
                                  Save
                                </Button>
                                <Button 
                                  onClick={() => setEditingSpeaker(null)} 
                                  size="small" 
                                  variant="outlined"
                                  color="error"
                                  fullWidth
                                >
                                  Cancel
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Box>
                              <Box sx={{ 
                                mb: 2, 
                                p: 1.5, 
                                bgcolor: speaker.name === speaker.label ? 'warning.light' : 'success.light',
                                borderRadius: 1,
                                textAlign: 'center'
                              }}>
                                <Typography variant="caption" sx={{ 
                                  color: speaker.name === speaker.label ? 'warning.contrastText' : 'success.contrastText',
                                  fontWeight: 'bold' 
                                }}>
                                  {speaker.name === speaker.label ? 'NOT RENAMED YET' : 'RENAMED'}
                                </Typography>
                                <Typography variant="h6" sx={{ 
                                  color: speaker.name === speaker.label ? 'warning.contrastText' : 'success.contrastText',
                                  mt: 0.5 
                                }}>
                                  {speaker.label || 'Unknown'}
                                </Typography>
                              </Box>
                              {speaker.name !== speaker.label && (
                                <Box sx={{ mb: 2, textAlign: 'center' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Currently showing as
                                  </Typography>
                                  <Typography variant="h6" color="primary">
                                    {speaker.name}
                                  </Typography>
                                </Box>
                              )}
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button 
                                  size="small" 
                                  onClick={() => setEditingSpeaker({ ...speaker })}
                                  startIcon={<EditIcon />}
                                  variant="contained"
                                  color={speaker.name === speaker.label ? 'warning' : 'primary'}
                                  fullWidth
                                >
                                  {speaker.name === speaker.label ? 'Set Name' : 'Rename'}
                                </Button>
                              </Box>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          <Grid item xs={12} lg={6}>
            <Card elevation={3} sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SummarizeIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h5">Meeting Summary</Typography>
                </Box>
                <Paper elevation={1} sx={{ p: 3, bgcolor: 'grey.50', maxHeight: '400px', overflow: 'auto' }}>
                  <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                    {meeting.transcription.summary.split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {line}
                        {index < meeting.transcription.summary.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Chat meetingId={meetingId} />
          </Grid>

          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h5">Action Items</Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    size="small" 
                    startIcon={<AssignmentIcon />}
                    onClick={() => setNewActionItem({ task: '', owner: '', due_date: '', isAdding: true })}
                    disabled={newActionItem.isAdding}
                  >
                    Add New
                  </Button>
                </Box>

                {/* Add new action item form */}
                {newActionItem.isAdding && (
                  <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: 'primary.light', border: '2px solid', borderColor: 'primary.main' }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'primary.contrastText' }}>
                      Add New Action Item
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Task Description"
                          value={newActionItem.task}
                          onChange={e => setNewActionItem({ ...newActionItem, task: e.target.value })}
                          placeholder="Enter the task to be completed..."
                          multiline
                          rows={2}
                          required
                          autoFocus
                          variant="outlined"
                          sx={{ bgcolor: 'white' }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Owner"
                          value={newActionItem.owner}
                          onChange={e => setNewActionItem({ ...newActionItem, owner: e.target.value })}
                          placeholder="Who is responsible?"
                          variant="outlined"
                          sx={{ bgcolor: 'white' }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Due Date"
                          type="date"
                          value={newActionItem.due_date}
                          onChange={e => setNewActionItem({ ...newActionItem, due_date: e.target.value })}
                          InputLabelProps={{ shrink: true }}
                          variant="outlined"
                          sx={{ bgcolor: 'white' }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button 
                            onClick={handleAddActionItem} 
                            variant="contained"
                            disabled={!newActionItem.task || !newActionItem.task.trim()}
                            startIcon={<CheckCircleIcon />}
                          >
                            Add Action Item
                          </Button>
                          <Button 
                            onClick={() => setNewActionItem({ task: '', owner: '', due_date: '', isAdding: false })} 
                            variant="outlined"
                            color="error"
                          >
                            Cancel
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                )}

                {/* Action items list */}
                {meeting.transcription.action_items.length > 0 ? (
                  <List sx={{ p: 0 }}>
                    {meeting.transcription.action_items.map((item) => (
                      <React.Fragment key={item.id}>
                        {editingActionItem?.id === item.id ? (
                          // Edit mode
                          <Paper elevation={2} sx={{ p: 2, mb: 2, bgcolor: 'warning.light', border: '2px solid', borderColor: 'warning.main' }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'warning.contrastText' }}>
                              Edit Action Item
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Task Description"
                                  value={editingActionItem.task}
                                  onChange={e => setEditingActionItem({ ...editingActionItem, task: e.target.value })}
                                  multiline
                                  rows={2}
                                  required
                                  autoFocus
                                  variant="outlined"
                                  sx={{ bgcolor: 'white' }}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  fullWidth
                                  label="Owner"
                                  value={editingActionItem.owner}
                                  onChange={e => setEditingActionItem({ ...editingActionItem, owner: e.target.value })}
                                  variant="outlined"
                                  sx={{ bgcolor: 'white' }}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  fullWidth
                                  label="Due Date"
                                  type="date"
                                  value={editingActionItem.due_date}
                                  onChange={e => setEditingActionItem({ ...editingActionItem, due_date: e.target.value })}
                                  InputLabelProps={{ shrink: true }}
                                  variant="outlined"
                                  sx={{ bgcolor: 'white' }}
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                  <Button 
                                    onClick={handleUpdateActionItem} 
                                    variant="contained"
                                    disabled={!editingActionItem.task || !editingActionItem.task.trim()}
                                    startIcon={<CheckCircleIcon />}
                                  >
                                    Save Changes
                                  </Button>
                                  <Button 
                                    onClick={() => setEditingActionItem(null)} 
                                    variant="outlined"
                                    color="error"
                                  >
                                    Cancel
                                  </Button>
                                </Box>
                              </Grid>
                            </Grid>
                          </Paper>
                        ) : (
                          // Display mode
                          <Paper 
                            elevation={1} 
                            sx={{ 
                              p: 2, 
                              mb: 2, 
                              bgcolor: 'success.lighter',
                              border: '1px solid',
                              borderColor: 'success.light',
                              transition: 'all 0.2s',
                              '&:hover': {
                                elevation: 3,
                                borderColor: 'success.main'
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              <Box sx={{ display: 'flex', flex: 1, alignItems: 'flex-start' }}>
                                <CheckCircleIcon color="success" sx={{ mt: 0.5, mr: 2 }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 1 }}>
                                    {item.task}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <Chip
                                      icon={<PersonIcon />}
                                      label={item.owner || 'Unassigned'}
                                      size="small"
                                      variant="outlined"
                                      color={item.owner ? "default" : "warning"}
                                    />
                                    <Chip
                                      icon={<CalendarIcon />}
                                      label={item.due_date || 'No deadline'}
                                      size="small"
                                      variant="outlined"
                                      color={item.due_date ? "default" : "warning"}
                                    />
                                  </Box>
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                                <Button 
                                  size="small" 
                                  variant="outlined"
                                  startIcon={<EditIcon />}
                                  onClick={() => setEditingActionItem({ ...item })}
                                >
                                  Edit
                                </Button>
                                <Button 
                                  size="small" 
                                  variant="outlined"
                                  color="error" 
                                  startIcon={<DeleteIcon />}
                                  onClick={() => handleDeleteActionItem(item.id)}
                                >
                                  Delete
                                </Button>
                              </Box>
                            </Box>
                          </Paper>
                        )}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No action items identified in this meeting. Click "Add New" to create one.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Attachments Section */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AttachFileIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h5">Attachments</Typography>
                    {attachments.length > 0 && (
                      <Chip label={attachments.length} size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                  <Button 
                    variant="contained" 
                    size="small" 
                    startIcon={<CloudUploadIcon />}
                    onClick={handleAttachmentDialogOpen}
                  >
                    Upload File
                  </Button>
                </Box>

                {attachments.length > 0 ? (
                  <List>
                    {attachments.map((attachment) => (
                      <Paper key={attachment.id} elevation={1} sx={{ mb: 2, p: 2 }}>
                        {editingAttachment?.id === attachment.id ? (
                          <Box>
                            <TextField
                              fullWidth
                              label="Description"
                              value={editingAttachment.description || ''}
                              onChange={(e) => setEditingAttachment({ ...editingAttachment, description: e.target.value })}
                              sx={{ mb: 2 }}
                              multiline
                              rows={2}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={handleUpdateAttachmentDescription}
                              >
                                Save
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setEditingAttachment(null)}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <DescriptionIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {attachment.filename}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                {attachment.mime_type === 'application/pdf' && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<VisibilityIcon />}
                                    onClick={() => handlePreviewAttachment(attachment.id)}
                                  >
                                    Preview
                                  </Button>
                                )}
                                <Button
                                  size="small"
                                  startIcon={<DownloadIcon />}
                                  onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                                >
                                  Download
                                </Button>
                                <Button
                                  size="small"
                                  startIcon={<EditIcon />}
                                  onClick={() => handleEditAttachmentDescription(attachment)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  startIcon={<DeleteIcon />}
                                  onClick={() => handleDeleteAttachment(attachment.id)}
                                >
                                  Delete
                                </Button>
                              </Box>
                            </Box>
                            {attachment.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 1 }}>
                                {attachment.description}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 2, ml: 4 }}>
                              <Typography variant="caption" color="text.secondary">
                                Size: {(attachment.file_size / 1024).toFixed(2)} KB
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Type: {attachment.mime_type}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Uploaded: {new Date(attachment.uploaded_at).toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </List>
                ) : (
                  <Alert severity="info" icon={<AttachFileIcon />}>
                    No attachments yet. Upload supporting documents, images, or other files related to this meeting.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TranscribeIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h5">Full Transcript</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper elevation={1} sx={{ p: 3, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                      <Typography variant="body1" sx={{ lineHeight: 1.7, fontFamily: 'monospace' }}>
                        {meeting.transcription.full_text.split('\n').map((line, index) => (
                          <React.Fragment key={index}>
                            {line}
                            {index < meeting.transcription.full_text.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </Typography>
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : meeting.status === 'processing' ? (
        <ProcessingCard elevation={3}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ color: 'white' }}>
              Processing Meeting...
            </Typography>
            
            <Typography variant="h6" sx={{ mb: 3, color: 'rgba(255,255,255,0.9)' }}>
              Current Stage: {meeting.current_stage ? stageDisplayNames[meeting.current_stage] || meeting.current_stage : 'Initializing...'}
            </Typography>

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body1" sx={{ color: 'white' }}>Current Stage Progress</Typography>
                <Typography variant="body1" sx={{ color: 'white' }}>
                  {Math.round(meeting.stage_progress || 0)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={meeting.stage_progress || 0}
                sx={{ height: 8, borderRadius: 4, mb: 2 }}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body1" sx={{ color: 'white' }}>Overall Progress</Typography>
                <Typography variant="body1" sx={{ color: 'white' }}>
                  {Math.round(meeting.overall_progress || 0)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={meeting.overall_progress || 0}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Stepper activeStep={stageOrder.indexOf(meeting.current_stage)} alternativeLabel>
              {stageOrder.map((stage, index) => {
                const status = getStageStatus(stage, meeting.current_stage, meeting.overall_progress);
                return (
                  <Step key={stage} completed={status === 'completed'}>
                    <StepLabel
                      StepIconComponent={({ active, completed }) => (
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: completed ? 'white' : active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                            color: completed || active ? 'primary.main' : 'white',
                            fontWeight: 'bold',
                            fontSize: '0.875rem'
                          }}
                        >
                          {completed ? <CheckCircleIcon /> : index + 1}
                        </Box>
                      )}
                    >
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {stageDisplayNames[stage]}
                      </Typography>
                    </StepLabel>
                  </Step>
                );
              })}
            </Stepper>
          </CardContent>
        </ProcessingCard>
      ) : meeting.status === 'failed' ? (
        <Card elevation={3} sx={{ mb: 2 }}>
          <CardContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>Processing Failed</Typography>
              <Typography>
                There was an error processing this meeting. You can try restarting the processing or upload the file again.
              </Typography>
              {meeting.error_message && (
                <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                  Error: {meeting.error_message}
                </Typography>
              )}
            </Alert>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                startIcon={<RestartAltIcon />}
                onClick={handleRestartProcessing}
                disabled={isUpdating}
                variant="contained"
                color="warning"
              >
                Restart Processing
              </Button>
              <Button
                startIcon={<RefreshIcon />}
                onClick={handleManualRefresh}
                disabled={isUpdating}
                variant="outlined"
              >
                Refresh Status
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>Meeting Queued</Typography>
          <Typography>
            This meeting is queued for processing. The results will appear here once processing begins.
          </Typography>
        </Alert>
      )}

      {/* Rename Meeting Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="sm" fullWidth>
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
                handleRenameMeetingConfirm();
              }
            }}
            disabled={isUpdating}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button 
            onClick={handleRenameMeetingConfirm} 
            variant="contained"
            disabled={isUpdating || !newName || !newName.trim() || newName.trim() === meeting?.filename}
          >
            {isUpdating ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Meeting Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Meeting</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{meeting?.filename}"? 
            This action cannot be undone and will permanently remove the meeting, 
            its transcription, analysis, and all associated data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteMeetingConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Attachment Dialog */}
      <Dialog open={attachmentDialogOpen} onClose={handleAttachmentDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Attachment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <input
              accept="*/*"
              style={{ display: 'none' }}
              id="attachment-file-input"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="attachment-file-input">
              <Button
                variant="outlined"
                component="span"
                fullWidth
                startIcon={<CloudUploadIcon />}
                sx={{ mb: 2 }}
              >
                {selectedFile ? selectedFile.name : 'Choose File'}
              </Button>
            </label>
            
            {selectedFile && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </Alert>
            )}
            
            <TextField
              fullWidth
              label="Description (optional)"
              value={attachmentDescription}
              onChange={(e) => setAttachmentDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="Add a description for this attachment..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAttachmentDialogClose} disabled={uploadingAttachment}>
            Cancel
          </Button>
          <Button
            onClick={handleUploadAttachment}
            variant="contained"
            disabled={!selectedFile || uploadingAttachment}
            startIcon={uploadingAttachment ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            {uploadingAttachment ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingDetails;
