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
  CircularProgress
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
  RestartAlt as RestartAltIcon
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

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
        setError(null);
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
              <Chip
                label={meeting.status}
                color={getStatusColor(meeting.status)}
                variant="filled"
                size="large"
              />
            </Box>
          </Box>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            <CalendarIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Uploaded on: {new Date(meeting.created_at).toLocaleString()}
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">File Size</Typography>
                <Typography variant="h6" color="text.primary">
                  {meeting.file_size ? `${(meeting.file_size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown'}
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">Language</Typography>
                <Typography variant="h6" color="text.primary">
                  {meeting.transcription_language || 'Auto-detect'}
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">Speakers</Typography>
                <Typography variant="h6" color="text.primary">
                  {meeting.number_of_speakers || 'Auto-detect'}
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">Duration</Typography>
                <Typography variant="h6" color="text.primary">
                  {meeting.estimated_duration ? `${meeting.estimated_duration} min` : 'Processing...'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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
                Overall Progress: {meeting.overall_progress || 0}%
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
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h5">Action Items</Typography>
                </Box>
                {meeting.transcription.action_items.length > 0 ? (
                  <List>
                    {meeting.transcription.action_items.map((item) => (
                      <ListItem key={item.id} sx={{ bgcolor: 'success.lighter', mb: 1, borderRadius: 1 }}>
                        <ListItemIcon>
                          <CheckCircleIcon color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" fontWeight="medium">
                              {item.task}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                <PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                Owner: {item.owner || 'Unassigned'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                <CalendarIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                Due: {item.due_date || 'No deadline'}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Alert severity="info">No action items identified in this meeting.</Alert>
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
    </Box>
  );
};

export default MeetingDetails;
