import React, { useState, useEffect } from 'react';
import api from '../api';
import ModelConfigurations from './ModelConfigurations';
import APIKeyManagement from './APIKeyManagement';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Switch,
  TextField,
  Button,
  Chip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  CircularProgress,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Mic as MicIcon,
  Psychology as PsychologyIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Tune as TuneIcon,
  Key as KeyIcon
} from '@mui/icons-material';

const Settings = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [settings, setSettings] = useState({
    transcriptionLanguage: 'en-US',
    enableSpeakerDiarization: true,
    aiAnalysisEnabled: true,
    notificationsEnabled: true,
    autoDeleteAfterDays: 30,
    maxFileSize: 3000, // MB (3GB default)
  });
  
  const [systemStatus, setSystemStatus] = useState({
    transcriptionService: 'operational',
    aiService: 'operational',
    storageService: 'operational',
    queueStatus: 'healthy'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  ];

  useEffect(() => {
    fetchSettings();
    fetchSystemStatus();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/v1/settings/app-settings');
      setSettings(prevSettings => ({
        ...prevSettings,
        maxFileSize: response.data.maxFileSize || response.data.defaultMaxFileSize || 3000
      }));
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load settings. Using defaults.',
        severity: 'warning'
      });
      // Keep the default values if the API fails
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    // Simulate API call to check system status
    try {
      // In a real app, this would check your backend services
      setSystemStatus({
        transcriptionService: 'operational',
        aiService: 'operational',
        storageService: 'operational',
        queueStatus: 'healthy'
      });
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Save max file size setting
      await api.post('/api/v1/settings/app-settings', {
        maxFileSize: settings.maxFileSize
      });
      
      setSnackbar({
        open: true,
        message: 'Settings saved successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to save settings',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'offline':
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return <CheckCircleIcon color="success" />;
      case 'degraded':
        return <ErrorIcon color="warning" />;
      case 'offline':
      case 'unhealthy':
        return <ErrorIcon color="error" />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          <Tab label="System" icon={<SettingsIcon />} />
          <Tab label="Model Configurations" icon={<TuneIcon />} />
          <Tab label="API Keys" icon={<KeyIcon />} />
        </Tabs>
      </Box>

      {/* System Settings Tab */}
      <TabPanel value={currentTab} index={0}>
        <Grid container spacing={3}>
          {/* System Status */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h5">System Status</Typography>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={fetchSystemStatus}
                  sx={{ ml: 'auto' }}
                  size="small"
                >
                  Refresh
                </Button>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                      <MicIcon sx={{ mr: 1 }} />
                      {getStatusIcon(systemStatus.transcriptionService)}
                    </Box>
                    <Typography variant="body2" gutterBottom>
                      Transcription Service
                    </Typography>
                    <Chip
                      label={systemStatus.transcriptionService}
                      color={getStatusColor(systemStatus.transcriptionService)}
                      size="small"
                    />
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                      <PsychologyIcon sx={{ mr: 1 }} />
                      {getStatusIcon(systemStatus.aiService)}
                    </Box>
                    <Typography variant="body2" gutterBottom>
                      AI Analysis Service
                    </Typography>
                    <Chip
                      label={systemStatus.aiService}
                      color={getStatusColor(systemStatus.aiService)}
                      size="small"
                    />
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                      <StorageIcon sx={{ mr: 1 }} />
                      {getStatusIcon(systemStatus.storageService)}
                    </Box>
                    <Typography variant="body2" gutterBottom>
                      Storage Service
                    </Typography>
                    <Chip
                      label={systemStatus.storageService}
                      color={getStatusColor(systemStatus.storageService)}
                      size="small"
                    />
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                      <SettingsIcon sx={{ mr: 1 }} />
                      {getStatusIcon(systemStatus.queueStatus)}
                    </Box>
                    <Typography variant="body2" gutterBottom>
                      Processing Queue
                    </Typography>
                    <Chip
                      label={systemStatus.queueStatus}
                      color={getStatusColor(systemStatus.queueStatus)}
                      size="small"
                    />
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Processing Settings */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Processing Settings
              </Typography>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <LanguageIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Transcription Language"
                    secondary="Default language for speech recognition"
                  />
                  <ListItemSecondaryAction>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={settings.transcriptionLanguage}
                        onChange={(e) => handleSettingChange('transcriptionLanguage', e.target.value)}
                      >
                        {languages.map((lang) => (
                          <MenuItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </ListItemSecondaryAction>
                </ListItem>
                
                <Divider />
                
                <ListItem>
                  <ListItemIcon>
                    <MicIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Speaker Diarization"
                    secondary="Identify different speakers in recordings"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.enableSpeakerDiarization}
                      onChange={(e) => handleSettingChange('enableSpeakerDiarization', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <Divider />
                
                <ListItem>
                  <ListItemIcon>
                    <PsychologyIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="AI Analysis"
                    secondary="Generate summaries and action items"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.aiAnalysisEnabled}
                      onChange={(e) => handleSettingChange('aiAnalysisEnabled', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* System Settings */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                System Settings
              </Typography>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <NotificationsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Notifications"
                    secondary="Receive email notifications when processing completes"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notificationsEnabled}
                      onChange={(e) => handleSettingChange('notificationsEnabled', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                
                <Divider />
                
                <ListItem>
                  <ListItemText
                    primary="Auto-delete recordings"
                    secondary="Automatically delete recordings after specified days"
                  />
                </ListItem>
                <ListItem>
                  <TextField
                    type="number"
                    label="Days"
                    value={settings.autoDeleteAfterDays}
                    onChange={(e) => handleSettingChange('autoDeleteAfterDays', parseInt(e.target.value))}
                    size="small"
                    sx={{ width: 100 }}
                    inputProps={{ min: 1, max: 365 }}
                  />
                </ListItem>
                
                <Divider />
                
                <ListItem>
                  <ListItemText
                    primary="Maximum file size"
                    secondary={`Maximum allowed file size for uploads. Current: ${settings.maxFileSize}MB (${(settings.maxFileSize / 1000).toFixed(1)}GB)`}
                  />
                </ListItem>
                <ListItem>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                      type="number"
                      label="MB"
                      value={settings.maxFileSize}
                      onChange={(e) => handleSettingChange('maxFileSize', parseInt(e.target.value))}
                      size="small"
                      sx={{ width: 120 }}
                      inputProps={{ min: 100, max: 5000 }}
                      helperText="100MB - 5GB"
                    />
                    <Typography variant="body2" color="text.secondary">
                      = {(settings.maxFileSize / 1000).toFixed(1)} GB
                    </Typography>
                  </Box>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSaveSettings}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </Grid>
        </Grid>
      </TabPanel>

      {/* Model Configurations Tab */}
      <TabPanel value={currentTab} index={1}>
        <ModelConfigurations />
      </TabPanel>

      {/* API Keys Tab */}
      <TabPanel value={currentTab} index={2}>
        <APIKeyManagement />
      </TabPanel>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
