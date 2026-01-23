import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Divider,
  CircularProgress,
  LinearProgress,
  Alert,
  AlertTitle,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Popper,
  ClickAwayListener,
  Stack,
  useTheme
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayCircle as PlayCircleIcon,
  PauseCircle as PauseCircleIcon,
  Summarize as SummarizeIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  Chat as ChatIcon,
  AttachFile as AttachFileIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  RestartAlt as RestartAltIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Folder as FolderIcon,
  Label as LabelIcon,
  ExpandMore as ExpandMoreIcon,
  CloudUpload as CloudUploadIcon,
  Visibility as VisibilityIcon,
  AccessTime as AccessTimeIcon,
  Info as InfoIcon,
  Note as NoteIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../api';
import Chat from './Chat';
import AudioPlayer from './AudioPlayer';
import FloatingChat from './meeting/FloatingChat';

// Styled components
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

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`meeting-tabpanel-${index}`}
      aria-labelledby={`meeting-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const MeetingDetails = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  
  // State
  const [meeting, setMeeting] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  
  // Speakers
  const [speakers, setSpeakers] = useState([]);
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [allSpeakers, setAllSpeakers] = useState([]);

  // Action Items
  const [newActionItem, setNewActionItem] = useState({ task: '', owner: '', due_date: '', isAdding: false });
  const [editingActionItem, setEditingActionItem] = useState(null);
  
  // Meta
  const [tags, setTags] = useState([]);
  const [folder, setFolder] = useState('');
  const [availableFolders, setAvailableFolders] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  
  // Notes
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showMeetingSuggestions, setShowMeetingSuggestions] = useState(false);
  const [meetingSuggestions, setMeetingSuggestions] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const notesRef = useRef(null);
  const [meetingPreviews, setMeetingPreviews] = useState({});
  const [hoveredMeetingId, setHoveredMeetingId] = useState(null);

  // Attachments
  const [attachments, setAttachments] = useState([]);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState(null);

  // Dialogs
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);

  // --- Fetching Logic ---

  const fetchMeetingDetails = async (isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      else setIsUpdating(true);

      const response = await api.get(`/api/v1/meetings/${meetingId}`);
      setMeeting(response.data);
      setTags(response.data.tags ? response.data.tags.split(',').map(t => t.trim()).filter(t => t) : []);
      setFolder(response.data.folder || '');
      setNotes(response.data.notes || '');
      setError(null);
      
      return response.data;
    } catch (err) {
      setError('Failed to fetch meeting details.');
      console.error(err);
      return null;
    } finally {
      if (isInitial) setIsLoading(false);
      else setIsUpdating(false);
    }
  };

  const fetchSpeakers = async () => {
    try {
      const res = await api.getSpeakers(meetingId);
      setSpeakers(res.data);
    } catch (err) {
      console.error('Failed to fetch speakers', err);
    }
  };

  const fetchAllSpeakers = async () => {
    try {
      const res = await api.getAllSpeakers();
      setAllSpeakers(res.data);
    } catch (err) {
      console.error('Failed to fetch all speakers', err);
    }
  };

  const fetchAttachments = async () => {
    try {
      const response = await api.getMeetingAttachments(meetingId);
      setAttachments(response.data);
    } catch (err) {
      console.error('Error fetching attachments:', err);
    }
  };

  const fetchAvailableFolders = async () => {
    try {
      const response = await api.get('/api/v1/meetings/');
      const folders = [...new Set(response.data.map(m => m.folder).filter(f => f && f !== 'Uncategorized'))];
      setAvailableFolders(folders.sort());
      setAllMeetings(response.data.filter(m => m.id !== parseInt(meetingId)));
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await api.getAllTags();
      setAvailableTags(response.data);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  useEffect(() => {
    fetchMeetingDetails(true).then((initialMeeting) => {
      if (initialMeeting) {
        fetchSpeakers();
        fetchAllSpeakers();
        fetchAttachments();
        fetchAvailableFolders();
        fetchAvailableTags();
        
        // Smart polling if processing
        if (initialMeeting.status === 'pending' || initialMeeting.status === 'processing') {
          startSmartPolling(initialMeeting);
        }
      }
    });
  }, [meetingId]);

  let pollTimeout = null;
  const startSmartPolling = (currentMeeting) => {
    let pollInterval = 5000;
    if (currentMeeting.status === 'pending') pollInterval = 10000;
    else if (currentMeeting.overall_progress > 80) pollInterval = 3000;

    const doPoll = async () => {
      const updated = await fetchMeetingDetails(false);
      if (updated && (updated.status === 'pending' || updated.status === 'processing')) {
        pollTimeout = setTimeout(doPoll, pollInterval);
      }
    };
    pollTimeout = setTimeout(doPoll, pollInterval);
  };

  useEffect(() => {
    return () => {
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, []);

  // --- Handlers ---

  const handleTabChange = (event, newValue) => setActiveTab(newValue);

  const handleManualRefresh = () => fetchMeetingDetails(false);

  const handleRestartProcessing = async () => {
    if (!window.confirm('Restart processing? This will cancel current progress.')) return;
    try {
      setIsUpdating(true);
      const response = await api.post(`/api/v1/meetings/${meetingId}/restart-processing`);
      setMeeting(response.data);
      startSmartPolling(response.data);
    } catch (err) {
      setError('Failed to restart processing.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRenameMeeting = async () => {
    if (!newName.trim()) return;
    try {
      setIsUpdating(true);
      await api.renameMeeting(meetingId, newName.trim());
      setMeeting(prev => ({ ...prev, filename: newName.trim() }));
      setRenameDialogOpen(false);
    } catch (err) {
      setError('Failed to rename meeting.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteMeeting = async () => {
    try {
      setIsUpdating(true);
      await api.deleteMeeting(meetingId);
      navigate('/');
    } catch (err) {
      setError('Failed to delete meeting.');
      setIsUpdating(false);
    }
  };

  const handleUpdateTagsFolder = async () => {
    try {
      const res = await api.updateMeetingTagsFolder(meetingId, tags.join(','), folder);
      setMeeting(res.data);
    } catch (err) {
      setError('Failed to update tags/folder');
    }
  };

  // Speaker Handlers
  const handleUpdateSpeaker = async () => {
    if (!editingSpeaker) return;
    try {
      const res = await api.updateSpeaker(editingSpeaker.id, editingSpeaker);
      setSpeakers(speakers.map(s => s.id === res.data.id ? res.data : s));
      setEditingSpeaker(null);
      fetchMeetingDetails(false); // Refresh transcript
    } catch (err) {
      setError('Failed to update speaker');
    }
  };

  // Action Item Handlers
  const handleAddActionItem = async () => {
    if (!newActionItem.task.trim()) return;
    try {
      const res = await api.addActionItem(meeting.transcription.id, newActionItem);
      setMeeting(prev => ({
        ...prev,
        transcription: {
          ...prev.transcription,
          action_items: [...prev.transcription.action_items, res.data]
        }
      }));
      setNewActionItem({ task: '', owner: '', due_date: '', isAdding: false });
    } catch (err) {
      setError('Failed to add action item');
    }
  };

  const handleUpdateActionItem = async () => {
    if (!editingActionItem) return;
    try {
      const res = await api.updateActionItem(editingActionItem.id, editingActionItem);
      setMeeting(prev => ({
        ...prev,
        transcription: {
          ...prev.transcription,
          action_items: prev.transcription.action_items.map(a => a.id === res.data.id ? res.data : a)
        }
      }));
      setEditingActionItem(null);
    } catch (err) {
      setError('Failed to update action item');
    }
  };

  const handleDeleteActionItem = async (id) => {
    try {
      await api.deleteActionItem(id);
      setMeeting(prev => ({
        ...prev,
        transcription: {
          ...prev.transcription,
          action_items: prev.transcription.action_items.filter(a => a.id !== id)
        }
      }));
    } catch (err) {
      setError('Failed to delete action item');
    }
  };

  // Notes Handlers
  const handleUpdateNotes = async () => {
    try {
      const res = await api.updateMeetingNotes(meetingId, notes);
      setMeeting(res.data);
      setIsEditingNotes(false);
    } catch (err) {
      setError('Failed to update notes');
    }
  };

  const handleNotesChange = (e) => {
    const value = e.target.value;
    setNotes(value);
    setCursorPosition(e.target.selectionStart);
    
    // Simple suggestion logic
    const textBefore = value.substring(0, e.target.selectionStart);
    const lastHash = textBefore.lastIndexOf('#');
    if (lastHash !== -1) {
      const query = textBefore.substring(lastHash + 1);
      if (/^[a-zA-Z0-9\s-]*$/.test(query)) {
        const term = query.replace('meeting-', '').toLowerCase().trim();
        const matches = allMeetings.filter(m => 
          m.id.toString().includes(term) || m.filename.toLowerCase().includes(term)
        ).slice(0, 10);
        setMeetingSuggestions(matches);
        setShowMeetingSuggestions(matches.length > 0);
        return;
      }
    }
    setShowMeetingSuggestions(false);
  };

  const insertMeetingReference = (m) => {
    const textBefore = notes.substring(0, cursorPosition);
    const lastHash = textBefore.lastIndexOf('#');
    if (lastHash !== -1) {
      const newNotes = notes.substring(0, lastHash) + `#meeting-${m.id} ` + notes.substring(cursorPosition);
      setNotes(newNotes);
      setShowMeetingSuggestions(false);
    }
  };

  // Attachment Handlers
  const handleUploadAttachment = async () => {
    if (!selectedFile) return;
    try {
      setUploadingAttachment(true);
      await api.uploadAttachment(meetingId, selectedFile, attachmentDescription);
      await fetchAttachments();
      setAttachmentDialogOpen(false);
      setSelectedFile(null);
      setAttachmentDescription('');
    } catch (err) {
      setError('Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (id) => {
    if (!window.confirm('Delete attachment?')) return;
    try {
      await api.deleteAttachment(id);
      fetchAttachments();
    } catch (err) {
      setError('Failed to delete attachment');
    }
  };

  const handleDownloadMeeting = async (format) => {
    setDownloadMenuAnchor(null);
    try {
      const response = await api.downloadMeeting(meetingId, format);
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${meeting.filename.replace(/\.[^/.]+$/, "")}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to download meeting');
    }
  };

  // --- Render Helpers ---

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'primary';
      case 'failed': return 'error';
      default: return 'warning';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!meeting) return <Alert severity="error">Meeting not found</Alert>;

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/meetings/browse')}
          sx={{ mb: 2 }}
        >
          Back to Meetings
        </Button>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 'auto' } }}>
            <Typography variant="h4" fontWeight="700" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {meeting.filename}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Chip 
                label={meeting.status.toUpperCase()} 
                color={getStatusColor(meeting.status)} 
                size="small" 
                icon={meeting.status === 'completed' ? <CheckCircleIcon /> : <ScheduleIcon />}
              />
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ fontSize: 16, mr: 0.5 }} />
                {new Date(meeting.created_at).toLocaleString()}
              </Typography>
              {meeting.folder && (
                <Chip icon={<FolderIcon />} label={meeting.folder} size="small" variant="outlined" />
              )}
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {meeting.status === 'completed' && (
              <>
                <Button 
                  variant="outlined" 
                  startIcon={<DownloadIcon />}
                  onClick={(e) => setDownloadMenuAnchor(e.currentTarget)}
                >
                  Export
                </Button>
                <Menu
                  anchorEl={downloadMenuAnchor}
                  open={Boolean(downloadMenuAnchor)}
                  onClose={() => setDownloadMenuAnchor(null)}
                >
                  <MenuItem onClick={() => handleDownloadMeeting('txt')}>Text (.txt)</MenuItem>
                  <MenuItem onClick={() => handleDownloadMeeting('json')}>JSON (.json)</MenuItem>
                  <MenuItem onClick={() => handleDownloadMeeting('docx')}>Word (.docx)</MenuItem>
                  <MenuItem onClick={() => handleDownloadMeeting('pdf')}>PDF (.pdf)</MenuItem>
                </Menu>
              </>
            )}
            <Button 
              variant="outlined" 
              startIcon={<EditIcon />}
              onClick={() => { setNewName(meeting.filename); setRenameDialogOpen(true); }}
            >
              Rename
            </Button>
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Failed Status Card */}
      {meeting.status === 'failed' && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              startIcon={<RestartAltIcon />}
              onClick={handleRestartProcessing}
              disabled={isUpdating}
            >
              Restart Processing
            </Button>
          }
        >
          Processing failed. {meeting.error_message || 'An error occurred during processing.'}
        </Alert>
      )}

      {/* Processing Status Card */}
      {(meeting.status === 'processing' || meeting.status === 'pending') && (
        <ProcessingCard elevation={3} sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CircularProgress size={24} sx={{ color: 'white', mr: 2 }} />
              <Typography variant="h6">Processing in Progress...</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button 
                startIcon={<RefreshIcon />} 
                onClick={handleManualRefresh} 
                sx={{ color: 'white', borderColor: 'white' }} 
                variant="outlined" 
                size="small"
              >
                Refresh
              </Button>
            </Box>
            <LinearProgress variant="determinate" value={meeting.overall_progress || 0} sx={{ height: 10, borderRadius: 5, mb: 1 }} />
            <Typography variant="body2" align="right">{Math.round(meeting.overall_progress || 0)}% Complete</Typography>
            
            <Stepper activeStep={['conversion', 'diarization', 'transcription', 'analysis'].indexOf(meeting.current_stage)} alternativeLabel sx={{ mt: 2 }}>
              {['File Conversion', 'Speaker ID', 'Transcription', 'AI Analysis'].map((label) => (
                <Step key={label}>
                  <StepLabel sx={{ '& .MuiStepLabel-label': { color: 'white !important' }, '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiStepIcon-root.Mui-active': { color: 'white' }, '& .MuiStepIcon-root.Mui-completed': { color: 'white' } }}>
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </ProcessingCard>
      )}

      {/* Main Content Tabs */}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="scrollable" 
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Tab icon={<SummarizeIcon />} label="Overview" iconPosition="start" />
          <Tab icon={<DescriptionIcon />} label="Transcript" iconPosition="start" disabled={!meeting.transcription} />
          <Tab icon={<AssignmentIcon />} label="Action Items" iconPosition="start" disabled={!meeting.transcription} />
          <Tab icon={<NoteIcon />} label="Notes" iconPosition="start" />
          <Tab icon={<AttachFileIcon />} label={`Attachments (${attachments.length})`} iconPosition="start" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3} sx={{ px: 3 }}>
            <Grid item xs={12} md={8}>
              {/* Audio Player */}
              {meeting.audio_filepath && (
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">Audio Recording</Typography>
                    <AudioPlayer 
                      src={`/api/v1/meetings/${meeting.id}/audio`}
                      title={meeting.filename}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Summary */}
              {meeting.transcription?.summary ? (
                <Box>
                  <Typography variant="h6" gutterBottom fontWeight="bold">Executive Summary</Typography>
                  <Paper elevation={0} sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
                      {meeting.transcription.summary}
                    </Typography>
                  </Paper>
                </Box>
              ) : (
                <Alert severity="info">Summary will be available once processing is complete.</Alert>
              )}
            </Grid>

            <Grid item xs={12} md={4}>
              {/* Metadata Card */}
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Meeting Details</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><AccessTimeIcon /></ListItemIcon>
                      <ListItemText primary="Duration" secondary={meeting.estimated_duration ? `~${meeting.estimated_duration} minutes` : 'Unknown'} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><InfoIcon /></ListItemIcon>
                      <ListItemText primary="File Size" secondary={meeting.file_size ? `${(meeting.file_size / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'} />
                    </ListItem>
                  </List>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>Organization</Typography>
                  <Stack spacing={2}>
                    <Autocomplete
                      freeSolo
                      options={availableFolders}
                      value={folder}
                      onChange={(e, v) => setFolder(v || '')}
                      onInputChange={(e, v) => setFolder(v)}
                      renderInput={(params) => <TextField {...params} label="Folder" size="small" />}
                    />
                    <Autocomplete
                      multiple
                      freeSolo
                      options={availableTags}
                      value={tags}
                      onChange={(event, newValue) => {
                        setTags(newValue);
                      }}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip variant="outlined" label={option} {...getTagProps({ index })} size="small" />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          variant="outlined"
                          label="Tags"
                          placeholder="Add tags"
                          size="small"
                        />
                      )}
                    />
                    <Button variant="contained" onClick={handleUpdateTagsFolder} size="small">Save Changes</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Transcript Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ px: 3 }}>
            {/* Speakers Management */}
            <Accordion sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight="bold">Manage Speakers ({speakers.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {speakers.map(speaker => (
                    <Grid item xs={12} sm={6} md={4} key={speaker.id}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        {editingSpeaker?.id === speaker.id ? (
                          <Stack spacing={1}>
                            <Autocomplete
                              freeSolo
                              options={allSpeakers}
                              value={editingSpeaker.name}
                              onChange={(event, newValue) => {
                                setEditingSpeaker({ ...editingSpeaker, name: newValue || '' });
                              }}
                              onInputChange={(event, newInputValue) => {
                                setEditingSpeaker({ ...editingSpeaker, name: newInputValue });
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Name"
                                  size="small"
                                  autoFocus
                                />
                              )}
                            />
                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="contained" onClick={handleUpdateSpeaker}>Save</Button>
                              <Button size="small" onClick={() => setEditingSpeaker(null)}>Cancel</Button>
                            </Stack>
                          </Stack>
                        ) : (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle2">{speaker.name}</Typography>
                              <Typography variant="caption" color="text.secondary">Label: {speaker.label}</Typography>
                            </Box>
                            <IconButton size="small" onClick={() => setEditingSpeaker(speaker)}><EditIcon fontSize="small" /></IconButton>
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Full Text with Speaker Highlighting */}
            <Paper variant="outlined" sx={{ p: 4, bgcolor: 'background.default', maxHeight: '70vh', overflow: 'auto' }}>
              {meeting.transcription?.full_text ? (
                <Box>
                  {meeting.transcription.full_text.split('\n').map((line, idx) => {
                    // Check if line starts with a speaker label (format: "Speaker Name:")
                    const speakerMatch = line.match(/^([^:]+):\s*(.*)/);
                    if (speakerMatch && speakerMatch[1].length < 50) {
                      const speakerName = speakerMatch[1].trim();
                      const speechText = speakerMatch[2];
                      // Find speaker info to get consistent colors
                      const speakerInfo = speakers.find(s => s.name === speakerName || s.label === speakerName);
                      const colorIndex = speakerInfo ? speakers.indexOf(speakerInfo) : speakerName.length;
                      const colors = ['primary', 'secondary', 'success', 'warning', 'info', 'error'];
                      const color = colors[colorIndex % colors.length];
                      
                      return (
                        <Box key={idx} sx={{ mb: 2 }}>
                          <Chip 
                            label={speakerName}
                            size="small"
                            color={color}
                            sx={{ mb: 0.5, fontWeight: 'bold' }}
                          />
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontFamily: 'Georgia, serif', 
                              lineHeight: 1.8,
                              pl: 1,
                              borderLeft: 3,
                              borderColor: `${color}.main`
                            }}
                          >
                            {speechText}
                          </Typography>
                        </Box>
                      );
                    } else if (line.trim()) {
                      // Regular line without speaker
                      return (
                        <Typography 
                          key={idx}
                          variant="body1" 
                          sx={{ fontFamily: 'Georgia, serif', lineHeight: 1.8, mb: 1 }}
                        >
                          {line}
                        </Typography>
                      );
                    }
                    return null;
                  })}
                </Box>
              ) : (
                <Typography color="text.secondary">No transcript available.</Typography>
              )}
            </Paper>
          </Box>
        </TabPanel>

        {/* Action Items Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ px: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
              <Button 
                variant="contained" 
                startIcon={<AssignmentIcon />}
                onClick={() => setNewActionItem({ ...newActionItem, isAdding: true })}
              >
                Add Action Item
              </Button>
            </Box>

            {newActionItem.isAdding && (
              <Paper variant="outlined" sx={{ p: 3, mb: 3, borderColor: 'primary.main', bgcolor: 'primary.lighter' }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">New Action Item</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField 
                      fullWidth label="Task" 
                      value={newActionItem.task} 
                      onChange={e => setNewActionItem({...newActionItem, task: e.target.value})} 
                      autoFocus
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField 
                      fullWidth label="Owner" 
                      value={newActionItem.owner} 
                      onChange={e => setNewActionItem({...newActionItem, owner: e.target.value})} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField 
                      fullWidth type="date" label="Due Date" 
                      InputLabelProps={{ shrink: true }}
                      value={newActionItem.due_date} 
                      onChange={e => setNewActionItem({...newActionItem, due_date: e.target.value})} 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button onClick={() => setNewActionItem({...newActionItem, isAdding: false})}>Cancel</Button>
                      <Button variant="contained" onClick={handleAddActionItem}>Add Item</Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            )}

            <Stack spacing={2}>
              {meeting.transcription?.action_items.map(item => (
                <Paper key={item.id} elevation={1} sx={{ p: 2, borderLeft: 6, borderColor: 'primary.main' }}>
                  {editingActionItem?.id === item.id ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField 
                          fullWidth label="Task" 
                          value={editingActionItem.task} 
                          onChange={e => setEditingActionItem({...editingActionItem, task: e.target.value})} 
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField 
                          fullWidth label="Owner" 
                          value={editingActionItem.owner} 
                          onChange={e => setEditingActionItem({...editingActionItem, owner: e.target.value})} 
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField 
                          fullWidth type="date" label="Due Date" 
                          InputLabelProps={{ shrink: true }}
                          value={editingActionItem.due_date} 
                          onChange={e => setEditingActionItem({...editingActionItem, due_date: e.target.value})} 
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button onClick={() => setEditingActionItem(null)}>Cancel</Button>
                          <Button variant="contained" onClick={handleUpdateActionItem}>Save</Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6" gutterBottom>{item.task}</Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip icon={<PersonIcon />} label={item.owner || 'Unassigned'} size="small" variant="outlined" />
                          <Chip icon={<CalendarIcon />} label={item.due_date || 'No Date'} size="small" variant="outlined" />
                        </Stack>
                      </Box>
                      <Box>
                        <IconButton size="small" onClick={() => setEditingActionItem(item)}><EditIcon /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteActionItem(item.id)}><DeleteIcon /></IconButton>
                      </Box>
                    </Box>
                  )}
                </Paper>
              ))}
              {meeting.transcription?.action_items.length === 0 && (
                <Alert severity="info">No action items found.</Alert>
              )}
            </Stack>
          </Box>
        </TabPanel>

        {/* Notes Tab */}
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ px: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Personal Notes</Typography>
              {!isEditingNotes ? (
                <Button startIcon={<EditIcon />} onClick={() => setIsEditingNotes(true)}>Edit Notes</Button>
              ) : (
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setIsEditingNotes(false)}>Cancel</Button>
                  <Button variant="contained" onClick={handleUpdateNotes}>Save Notes</Button>
                </Stack>
              )}
            </Box>
            
            {isEditingNotes ? (
              <Box>
                <TextField
                  fullWidth
                  multiline
                  minRows={10}
                  value={notes}
                  onChange={handleNotesChange}
                  inputRef={notesRef}
                  placeholder="Type # to reference other meetings..."
                />
                <Popper open={showMeetingSuggestions} anchorEl={notesRef.current}>
                  <Paper elevation={3} sx={{ width: 300, maxHeight: 200, overflow: 'auto' }}>
                    <List dense>
                      {meetingSuggestions.map(m => (
                        <ListItem button key={m.id} onClick={() => insertMeetingReference(m)}>
                          <ListItemText primary={m.filename} secondary={`#${m.id}`} />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Popper>
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 3, minHeight: 200, bgcolor: 'background.default' }}>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{notes || 'No notes yet.'}</Typography>
              </Paper>
            )}
          </Box>
        </TabPanel>

        {/* Attachments Tab */}
        <TabPanel value={activeTab} index={4}>
          <Box sx={{ px: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
              <Button 
                variant="contained" 
                startIcon={<CloudUploadIcon />}
                onClick={() => setAttachmentDialogOpen(true)}
              >
                Upload File
              </Button>
            </Box>
            
            <Grid container spacing={2}>
              {attachments.map(att => (
                <Grid item xs={12} sm={6} md={4} key={att.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <DescriptionIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1" noWrap>{att.filename}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {(att.file_size / 1024).toFixed(1)} KB • {new Date(att.uploaded_at).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2, minHeight: 40 }}>
                        {att.description || 'No description'}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => window.open(api.previewAttachment(att.id), '_blank')}>View</Button>
                        <IconButton size="small" color="error" onClick={() => handleDeleteAttachment(att.id)}><DeleteIcon /></IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {attachments.length === 0 && (
                <Grid item xs={12}>
                  <Alert severity="info">No attachments uploaded.</Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        </TabPanel>
      </Paper>

      {/* Dialogs */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename Meeting</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus margin="dense" label="Name" fullWidth 
            value={newName} onChange={e => setNewName(e.target.value)} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRenameMeeting} variant="contained">Rename</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Meeting?</DialogTitle>
        <DialogContent>
          <Typography>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteMeeting} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={attachmentDialogOpen} onClose={() => setAttachmentDialogOpen(false)}>
        <DialogTitle>Upload Attachment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Button variant="outlined" component="label">
              Select File
              <input type="file" hidden onChange={e => setSelectedFile(e.target.files[0])} />
            </Button>
            {selectedFile && <Typography variant="body2">{selectedFile.name}</Typography>}
            <TextField 
              label="Description" multiline rows={2} fullWidth 
              value={attachmentDescription} onChange={e => setAttachmentDescription(e.target.value)} 
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachmentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUploadAttachment} variant="contained" disabled={!selectedFile || uploadingAttachment}>
            {uploadingAttachment ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Chat */}
      {meeting && meeting.transcription && (
        <FloatingChat 
          meetingId={meetingId} 
          meetingTitle={meeting.filename || meeting.title || 'Meeting'}
        />
      )}

    </Box>
  );
};

export default MeetingDetails;
