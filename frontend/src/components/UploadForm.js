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
  AccordionDetails
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  AudioFile as AudioFileIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Language as LanguageIcon,
  People as PeopleIcon
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Meeting configuration parameters
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

  const handleFileSelect = (file) => {
    const maxSizeBytes = maxFileSize * 1024 * 1024; // Convert MB to bytes
    
    if (!file) return;
    
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      setMessage('Please select a valid audio or video file.');
      setMessageType('error');
      setSnackbarOpen(true);
      return;
    }
    
    if (file.size > maxSizeBytes) {
      setMessage(`File size exceeds the maximum limit of ${maxFileSize}MB. Please select a smaller file.`);
      setMessageType('error');
      setSnackbarOpen(true);
      return;
    }
    
    setSelectedFile(file);
    setMessage('');
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    handleFileSelect(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setMessage('Please select a file first.');
      setMessageType('error');
      setSnackbarOpen(true);
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('transcription_language', transcriptionLanguage);
    formData.append('number_of_speakers', numberOfSpeakers);

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setMessage('Uploading and processing...');
      setMessageType('info');

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await api.post('/api/v1/meetings/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setMessage('File uploaded successfully! Processing will begin shortly.');
      setMessageType('success');
      setSnackbarOpen(true);
      setSelectedFile(null);
      
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
              Drop your audio/video file here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              or click to browse files (up to {maxFileSize}MB)
            </Typography>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              size="large"
            >
              Select File
              <VisuallyHiddenInput
                id="file-input"
                type="file"
                accept="audio/*,video/*"
                onChange={handleFileChange}
              />
            </Button>
          </DropZone>

          {selectedFile && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AudioFileIcon color="primary" />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setSelectedFile(null)}
                  disabled={isUploading}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
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
                <Typography variant="h6">Processing Configuration</Typography>
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
                  <strong>Language:</strong> Choose the primary language spoken in your meeting. 
                  This helps improve transcription accuracy.<br />
                  <strong>Speakers:</strong> Specify the number of speakers or use auto-detect 
                  for speaker identification and diarization.
                </Typography>
              </Alert>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Maximum file size: {maxFileSize}MB | 
                Supported formats: MP3, WAV, MP4, MOV, AVI, and more
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />

          <Button
            type="submit"
            variant="contained"
            disabled={!selectedFile || isUploading}
            fullWidth
            size="large"
            startIcon={<CloudUploadIcon />}
          >
            {isUploading ? 'Uploading...' : 'Upload and Process'}
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
