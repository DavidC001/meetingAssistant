import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  LinearProgress,
  Alert,
  Snackbar,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  AudioFile as AudioFileIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Language as LanguageIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../api';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const DropZone = styled(Box)(({ theme, isDragOver }) => ({
  border: `2px dashed ${isDragOver ? theme.palette.primary.main : theme.palette.grey[300]}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  textAlign: 'center',
  backgroundColor: isDragOver ? theme.palette.action.hover : 'transparent',
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

const UploadForm = ({ onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Meeting configuration parameters (defaults for all files)
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('en-US');
  const [numberOfSpeakers, setNumberOfSpeakers] = useState('auto');
  const [maxFileSize, setMaxFileSize] = useState(3000); // Default 3GB, will be updated from settings

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'zh-CN', name: 'Chinese (Mandarin)' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'ru-RU', name: 'Russian' },
    { code: 'ar-SA', name: 'Arabic' },
  ];

  const speakerOptions = [
    { value: 'auto', label: 'Auto-detect' },
    { value: '1', label: '1 Speaker' },
    { value: '2', label: '2 Speakers' },
    { value: '3', label: '3 Speakers' },
    { value: '4', label: '4 Speakers' },
    { value: '5', label: '5 Speakers' },
    { value: '6', label: '6 Speakers' },
    { value: '8', label: '8 Speakers' },
    { value: '10', label: '10+ Speakers' },
  ];

  // Fetch max file size from settings on component mount
  useEffect(() => {
    const fetchMaxFileSize = async () => {
      try {
        const response = await api.get('/api/v1/settings/app-settings');
        setMaxFileSize(response.data.maxFileSize);
      } catch (error) {
        console.error('Failed to fetch max file size setting:', error);
        // Keep default value of 3000MB if fetch fails
      }
    };

    fetchMaxFileSize();
  }, []);

  const handleFileSelect = (files) => {
    const maxSizeBytes = maxFileSize * 1024 * 1024; // Convert MB to bytes

    if (!files || files.length === 0) return;

    const validFiles = [];
    const errors = [];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        errors.push(`${file.name}: Invalid file type. Please select audio or video files.`);
        return;
      }

      if (file.size > maxSizeBytes) {
        errors.push(`${file.name}: File size exceeds ${maxFileSize}MB limit.`);
        return;
      }

      // Add file with individual settings
      validFiles.push({
        file: file,
        transcriptionLanguage: transcriptionLanguage,
        numberOfSpeakers: numberOfSpeakers,
        meetingDate: '',
      });
    });

    if (errors.length > 0) {
      setMessage(errors.join('\n'));
      setMessageType('error');
      setSnackbarOpen(true);
    }

    if (validFiles.length > 0) {
      setSelectedFiles([...selectedFiles, ...validFiles]);
      setMessage('');
    }
  };

  const handleFileChange = (event) => {
    const files = event.target.files;
    handleFileSelect(files);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = event.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const updateFileConfig = (index, field, value) => {
    const updatedFiles = [...selectedFiles];
    updatedFiles[index][field] = value;
    setSelectedFiles(updatedFiles);
  };

  const applyDefaultsToAll = () => {
    const updatedFiles = selectedFiles.map((fileConfig) => ({
      ...fileConfig,
      transcriptionLanguage: transcriptionLanguage,
      numberOfSpeakers: numberOfSpeakers,
    }));
    setSelectedFiles(updatedFiles);
    setMessage('Default settings applied to all files');
    setMessageType('success');
    setSnackbarOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setMessage('Please select at least one file first.');
      setMessageType('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setMessage('Uploading and processing...');
      setMessageType('info');

      // For single file, use the original endpoint
      if (selectedFiles.length === 1) {
        const formData = new FormData();
        formData.append('file', selectedFiles[0].file);
        formData.append('transcription_language', selectedFiles[0].transcriptionLanguage);
        formData.append('number_of_speakers', selectedFiles[0].numberOfSpeakers);
        if (selectedFiles[0].meetingDate) {
          formData.append('meeting_date', selectedFiles[0].meetingDate);
        }

        const response = await api.post('/api/v1/meetings/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          },
        });
      } else {
        // For multiple files, use the batch endpoint
        const formData = new FormData();

        // Append all files
        selectedFiles.forEach((fileConfig) => {
          formData.append('files', fileConfig.file);
        });

        // Prepare comma-separated parameters
        const languages = selectedFiles.map((f) => f.transcriptionLanguage).join(',');
        const speakers = selectedFiles.map((f) => f.numberOfSpeakers).join(',');
        const dates = selectedFiles.map((f) => f.meetingDate || '').join(',');

        formData.append('transcription_languages', languages);
        formData.append('number_of_speakers_list', speakers);
        formData.append('meeting_dates', dates);

        const response = await api.post('/api/v1/meetings/batch-upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          },
        });
      }

      setUploadProgress(100);
      setMessage(
        `Successfully uploaded ${selectedFiles.length} file(s)! Processing will begin shortly.`
      );
      setMessageType('success');
      setSnackbarOpen(true);

      setSelectedFiles([]);

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      setMessage('Upload failed. Please try again.');
      setMessageType('error');
      setSnackbarOpen(true);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card elevation={3} sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Upload Meeting Recording
        </Typography>

        <form onSubmit={handleSubmit}>
          <DropZone
            isDragOver={isDragOver}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('file-input').click()}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drop your audio/video file(s) here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              or click to browse files (up to {maxFileSize}MB per file)
            </Typography>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              size="large"
            >
              Select File(s)
              <VisuallyHiddenInput
                id="file-input"
                type="file"
                accept="audio/*,video/*"
                onChange={handleFileChange}
                multiple
              />
            </Button>
          </DropZone>

          {selectedFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Selected Files ({selectedFiles.length})</Typography>
                {selectedFiles.length > 1 && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={applyDefaultsToAll}
                    disabled={isUploading}
                  >
                    Apply Defaults to All
                  </Button>
                )}
              </Box>
              {selectedFiles.map((fileConfig, index) => (
                <Box
                  key={index}
                  sx={{
                    mb: 2,
                    p: 2,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AudioFileIcon color="primary" />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {fileConfig.file.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(fileConfig.file.size)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Language</InputLabel>
                        <Select
                          value={fileConfig.transcriptionLanguage}
                          onChange={(e) =>
                            updateFileConfig(index, 'transcriptionLanguage', e.target.value)
                          }
                          label="Language"
                          disabled={isUploading}
                        >
                          {languages.map((lang) => (
                            <MenuItem key={lang.code} value={lang.code}>
                              {lang.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Speakers</InputLabel>
                        <Select
                          value={fileConfig.numberOfSpeakers}
                          onChange={(e) =>
                            updateFileConfig(index, 'numberOfSpeakers', e.target.value)
                          }
                          label="Speakers"
                          disabled={isUploading}
                        >
                          {speakerOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={12} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Meeting Date (Optional)"
                        type="datetime-local"
                        value={
                          // Convert ISO string back to datetime-local format for display
                          fileConfig.meetingDate
                            ? (() => {
                                try {
                                  // If it's already an ISO string, convert to local datetime format
                                  const date = new Date(fileConfig.meetingDate);
                                  if (!isNaN(date.getTime())) {
                                    // Format: YYYY-MM-DDTHH:mm (local time)
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const hours = String(date.getHours()).padStart(2, '0');
                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                                  }
                                } catch (e) {
                                  console.error('Error formatting date:', e);
                                }
                                return fileConfig.meetingDate;
                              })()
                            : ''
                        }
                        onChange={(e) => {
                          // Convert local datetime to ISO string with timezone
                          const localDateTime = e.target.value;
                          if (localDateTime) {
                            // Create a date object from the local datetime string
                            const date = new Date(localDateTime);
                            // Convert to ISO string (which will be in UTC)
                            const isoString = date.toISOString();
                            updateFileConfig(index, 'meetingDate', isoString);
                          } else {
                            updateFileConfig(index, 'meetingDate', '');
                          }
                        }}
                        InputLabelProps={{
                          shrink: true,
                        }}
                        disabled={isUploading}
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Box>
          )}

          {uploadProgress > 0 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Uploading... {uploadProgress}%
              </Typography>
            </Box>
          )}

          {/* Processing Configuration */}
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="processing-config-content"
              id="processing-config-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Default Processing Configuration</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="language-select-label">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LanguageIcon sx={{ mr: 1, fontSize: 20 }} />
                        Transcription Language
                      </Box>
                    </InputLabel>
                    <Select
                      labelId="language-select-label"
                      value={transcriptionLanguage}
                      onChange={(e) => setTranscriptionLanguage(e.target.value)}
                      label="Transcription Language"
                    >
                      {languages.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="speakers-select-label">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PeopleIcon sx={{ mr: 1, fontSize: 20 }} />
                        Number of Speakers
                      </Box>
                    </InputLabel>
                    <Select
                      labelId="speakers-select-label"
                      value={numberOfSpeakers}
                      onChange={(e) => setNumberOfSpeakers(e.target.value)}
                      label="Number of Speakers"
                    >
                      {speakerOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Default Settings:</strong> These settings will be applied to newly added
                  files. You can customize settings for each file individually after selecting them.
                  <br />
                  <strong>Language:</strong> Choose the primary language spoken in your meeting.
                  This helps improve transcription accuracy.
                  <br />
                  <strong>Speakers:</strong> Specify the number of speakers or use auto-detect for
                  speaker identification and diarization.
                  <br />
                  <strong>Meeting Date:</strong> Optionally specify when each meeting took place. If
                  not set, the upload time will be used.
                </Typography>
              </Alert>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Maximum file size: {maxFileSize}MB | Supported formats: MP3, WAV, MP4, MKV, MOV,
                AVI, FLAC, M4A, and more
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Button
            type="submit"
            variant="contained"
            disabled={selectedFiles.length === 0 || isUploading}
            fullWidth
            size="large"
            startIcon={<CloudUploadIcon />}
          >
            {isUploading
              ? 'Uploading...'
              : `Upload and Process ${
                  selectedFiles.length > 0
                    ? `(${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''})`
                    : ''
                }`}
          </Button>
        </form>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={messageType}
            sx={{ width: '100%' }}
          >
            {message}
          </Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
};

export default UploadForm;
