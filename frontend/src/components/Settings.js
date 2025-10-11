import React, { useState, useEffect } from 'react';
import api from '../api';
import ModelConfigurations from './ModelConfigurations';
import APIKeyManagement from './APIKeyManagement';
import OllamaManager from './OllamaManager';
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
  Tab,
  Slider
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

  const [embeddingConfigs, setEmbeddingConfigs] = useState([]);
  const [activeEmbeddingId, setActiveEmbeddingId] = useState(null);
  const [embeddingForm, setEmbeddingForm] = useState({
    provider: 'sentence-transformers',
    model_name: 'sentence-transformers/all-MiniLM-L6-v2',
    dimension: 384,
    base_url: '',
    settings: '',
    is_active: false
  });
  const [modelValidation, setModelValidation] = useState({ status: 'idle', message: '' });
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [workerConfig, setWorkerConfig] = useState({ max_workers: 1 });
  const [workerSaving, setWorkerSaving] = useState(false);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  
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
    fetchEmbeddingConfig();
    fetchWorkerConfig();
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

  const fetchEmbeddingConfig = async () => {
    setEmbeddingLoading(true);
    try {
      const response = await api.embeddingSettings.getConfig();
      setEmbeddingConfigs(response.data.configurations || []);
      setActiveEmbeddingId(response.data.activeConfigurationId || null);
    } catch (error) {
      console.error('Failed to load embedding configuration', error);
      setSnackbar({
        open: true,
        message: 'Failed to load embedding configuration',
        severity: 'warning'
      });
    } finally {
      setEmbeddingLoading(false);
    }
  };

  const fetchWorkerConfig = async () => {
    try {
      const response = await api.workerSettings.get();
      setWorkerConfig(response.data || { max_workers: 1 });
    } catch (error) {
      console.error('Failed to load worker configuration', error);
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

  const handleEmbeddingFormChange = (key, value) => {
    setModelValidation({ status: 'idle', message: '' });
    setEmbeddingForm(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'provider') {
        if (value === 'sentence-transformers') {
          updated.dimension = 384;
          updated.base_url = '';
          updated.model_name = 'sentence-transformers/all-MiniLM-L6-v2';
        } else if (value === 'openai') {
          updated.dimension = 1536;
          updated.base_url = '';
          updated.model_name = 'text-embedding-3-small';
        } else if (value === 'ollama') {
          updated.dimension = 768;
          updated.model_name = 'nomic-embed-text';
        }
      }
      return updated;
    });
  };

  const handleCreateEmbeddingConfig = async () => {
    try {
      const payload = {
        provider: embeddingForm.provider,
        model_name: embeddingForm.model_name,
        dimension: Number(embeddingForm.dimension),
        base_url: embeddingForm.base_url || undefined,
        is_active: embeddingForm.is_active,
      };
      if (embeddingForm.settings) {
        try {
          payload.settings = JSON.parse(embeddingForm.settings);
        } catch (error) {
          setSnackbar({
            open: true,
            message: 'Settings must be valid JSON',
            severity: 'error'
          });
          return;
        }
      }
      await api.embeddingSettings.createConfig(payload);
      setSnackbar({ open: true, message: 'Embedding configuration saved', severity: 'success' });
      setEmbeddingForm(prev => ({ ...prev, is_active: false }));
      fetchEmbeddingConfig();
    } catch (error) {
      console.error('Failed to create embedding configuration', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to create embedding configuration',
        severity: 'error'
      });
    }
  };

  const handleValidateModel = async () => {
    if (!embeddingForm.model_name) {
      setModelValidation({ status: 'invalid', message: 'Model name is required.' });
      return;
    }

    setModelValidation({ status: 'checking', message: 'Validating model...' });
    try {
      const response = await api.embeddingSettings.validateModel(embeddingForm.provider, embeddingForm.model_name);
      const { valid, message } = response.data || {};
      if (valid) {
        setModelValidation({ status: 'valid', message: message || 'Model is available.' });
      } else {
        setModelValidation({ status: 'invalid', message: message || 'Model could not be validated.' });
      }
    } catch (error) {
      console.error('Failed to validate model', error);
      setModelValidation({
        status: 'invalid',
        message: error.response?.data?.detail || 'Failed to validate model',
      });
    }
  };

  const handleActivateEmbeddingConfig = async (configId) => {
    try {
      await api.embeddingSettings.activateConfig(configId);
      setSnackbar({ open: true, message: 'Embedding configuration activated', severity: 'success' });
      fetchEmbeddingConfig();
    } catch (error) {
      console.error('Failed to activate configuration', error);
      setSnackbar({ open: true, message: 'Failed to activate configuration', severity: 'error' });
    }
  };

  const handleDeleteEmbeddingConfig = async (configId) => {
    try {
      await api.embeddingSettings.deleteConfig(configId);
      setSnackbar({ open: true, message: 'Embedding configuration removed', severity: 'success' });
      fetchEmbeddingConfig();
    } catch (error) {
      console.error('Failed to delete configuration', error);
      setSnackbar({ open: true, message: 'Failed to delete configuration', severity: 'error' });
    }
  };

  const handleRecomputeEmbeddings = async () => {
    setRecomputeLoading(true);
    try {
      await api.embeddingSettings.recomputeAll();
      setSnackbar({ open: true, message: 'Embedding recomputation triggered', severity: 'info' });
    } catch (error) {
      console.error('Failed to trigger recompute', error);
      setSnackbar({ open: true, message: 'Failed to trigger recompute', severity: 'error' });
    } finally {
      setRecomputeLoading(false);
    }
  };

  const handleWorkerSave = async () => {
    setWorkerSaving(true);
    try {
      await api.workerSettings.update(workerConfig.max_workers);
      setSnackbar({ open: true, message: 'Worker configuration updated', severity: 'success' });
      fetchWorkerConfig();
    } catch (error) {
      console.error('Failed to update worker configuration', error);
      setSnackbar({ open: true, message: 'Failed to update worker configuration', severity: 'error' });
    } finally {
      setWorkerSaving(false);
    }
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" fontWeight="700" gutterBottom>
          ⚙️ Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your Meeting Assistant preferences and integrations
        </Typography>
      </Box>

      <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 2, borderColor: 'divider' }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, newValue) => setCurrentTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                py: 2,
                fontSize: '1rem',
                fontWeight: 600
              }
            }}
          >
            <Tab label="System Settings" icon={<SettingsIcon />} iconPosition="start" />
            <Tab label="AI Models" icon={<TuneIcon />} iconPosition="start" />
            <Tab label="API Keys" icon={<KeyIcon />} iconPosition="start" />
            <Tab label="Ollama" icon={<StorageIcon />} iconPosition="start" />
          </Tabs>
        </Box>

      {/* System Settings Tab */}
      <TabPanel value={currentTab} index={0}>
        <Box sx={{ p: 4 }}>
          <Grid container spacing={4}>
            {/* System Status */}
            <Grid item xs={12}>
              <Card elevation={2} sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <SettingsIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                    <Typography variant="h5" fontWeight="600">System Health Status</Typography>
                    <Button
                      startIcon={<RefreshIcon />}
                      onClick={fetchSystemStatus}
                      sx={{ ml: 'auto', borderRadius: 2 }}
                      size="medium"
                      variant="outlined"
                    >
                      Refresh Status
                    </Button>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Monitor the status of all system services and components
                  </Typography>
              
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={2} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          borderRadius: 3,
                          border: '2px solid',
                          borderColor: `${getStatusColor(systemStatus.transcriptionService)}.light`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 4
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                          <MicIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                        </Box>
                        <Typography variant="h6" fontWeight="600" gutterBottom>
                          Transcription
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          {getStatusIcon(systemStatus.transcriptionService)}
                        </Box>
                        <Chip
                          label={systemStatus.transcriptionService}
                          color={getStatusColor(systemStatus.transcriptionService)}
                          size="medium"
                          sx={{ mt: 2, fontWeight: 600 }}
                        />
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={2} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          borderRadius: 3,
                          border: '2px solid',
                          borderColor: `${getStatusColor(systemStatus.aiService)}.light`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 4
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                          <PsychologyIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                        </Box>
                        <Typography variant="h6" fontWeight="600" gutterBottom>
                          AI Analysis
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          {getStatusIcon(systemStatus.aiService)}
                        </Box>
                        <Chip
                          label={systemStatus.aiService}
                          color={getStatusColor(systemStatus.aiService)}
                          size="medium"
                          sx={{ mt: 2, fontWeight: 600 }}
                        />
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={2} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          borderRadius: 3,
                          border: '2px solid',
                          borderColor: `${getStatusColor(systemStatus.storageService)}.light`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 4
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                          <StorageIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                        </Box>
                        <Typography variant="h6" fontWeight="600" gutterBottom>
                          Storage
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          {getStatusIcon(systemStatus.storageService)}
                        </Box>
                        <Chip
                          label={systemStatus.storageService}
                          color={getStatusColor(systemStatus.storageService)}
                          size="medium"
                          sx={{ mt: 2, fontWeight: 600 }}
                        />
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={2} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          borderRadius: 3,
                          border: '2px solid',
                          borderColor: `${getStatusColor(systemStatus.queueStatus)}.light`,
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 4
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                          <SettingsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                        </Box>
                        <Typography variant="h6" fontWeight="600" gutterBottom>
                          Queue
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                          {getStatusIcon(systemStatus.queueStatus)}
                        </Box>
                        <Chip
                          label={systemStatus.queueStatus}
                          color={getStatusColor(systemStatus.queueStatus)}
                          size="medium"
                          sx={{ mt: 2, fontWeight: 600 }}
                        />
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Processing Settings */}
            <Grid item xs={12} md={6}>
              <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <MicIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                    <Box>
                      <Typography variant="h5" fontWeight="600" gutterBottom>
                        Processing Settings
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Configure audio transcription and analysis
                      </Typography>
                    </Box>
                  </Box>
                  
                  <List sx={{ bgcolor: '#f8f9fa', borderRadius: 2, p: 2 }}>
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

      {/* Embedding Configuration */}
      <Grid item xs={12}>
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <PsychologyIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="600" gutterBottom>
                  Embedding Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage embedding models used for retrieval augmented generation
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                <Button
                  variant="outlined"
                  startIcon={recomputeLoading ? <CircularProgress size={18} /> : <RefreshIcon />}
                  onClick={handleRecomputeEmbeddings}
                  disabled={recomputeLoading}
                  sx={{ borderRadius: 2 }}
                >
                  {recomputeLoading ? 'Recomputing...' : 'Recompute All Embeddings'}
                </Button>
              </Box>
            </Box>

            {embeddingLoading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Existing configurations
                  </Typography>
                  <List sx={{ bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    {embeddingConfigs.length === 0 && (
                      <ListItem>
                        <ListItemText primary="No embedding configurations yet" secondary="Create a configuration to get started" />
                      </ListItem>
                    )}
                    {embeddingConfigs.map((config) => (
                      <ListItem key={config.id} alignItems="flex-start" divider>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {config.model_name}
                              </Typography>
                              {config.id === activeEmbeddingId && <Chip label="Active" color="success" size="small" />}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" color="text.secondary">
                                Provider: {config.provider} • Dimension: {config.dimension}
                              </Typography>
                              {config.base_url && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Base URL: {config.base_url}
                                </Typography>
                              )}
                            </>
                          }
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={config.id === activeEmbeddingId}
                            onClick={() => handleActivateEmbeddingConfig(config.id)}
                          >
                            Activate
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            color="error"
                            onClick={() => handleDeleteEmbeddingConfig(config.id)}
                          >
                            Delete
                          </Button>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Create configuration
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="embedding-provider-label">Provider</InputLabel>
                        <Select
                          labelId="embedding-provider-label"
                          label="Provider"
                          value={embeddingForm.provider}
                          onChange={(e) => handleEmbeddingFormChange('provider', e.target.value)}
                        >
                          <MenuItem value="sentence-transformers">Sentence Transformers</MenuItem>
                          <MenuItem value="openai">OpenAI</MenuItem>
                          <MenuItem value="ollama">Ollama</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Vector dimension"
                        type="number"
                        fullWidth
                        size="small"
                        value={embeddingForm.dimension}
                        onChange={(e) => handleEmbeddingFormChange('dimension', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          label="Model name"
                          fullWidth
                          size="small"
                          value={embeddingForm.model_name}
                          onChange={(e) => handleEmbeddingFormChange('model_name', e.target.value)}
                        />
                        {embeddingForm.provider === 'sentence-transformers' && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleValidateModel}
                            disabled={modelValidation.status === 'checking'}
                          >
                            {modelValidation.status === 'checking' ? 'Validating…' : 'Validate model'}
                          </Button>
                        )}
                      </Box>
                      {embeddingForm.provider === 'sentence-transformers' && modelValidation.status !== 'idle' && (
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', mt: 0.5 }}
                          color={
                            modelValidation.status === 'valid'
                              ? 'success.main'
                              : modelValidation.status === 'checking'
                              ? 'text.secondary'
                              : 'error.main'
                          }
                        >
                          {modelValidation.message}
                        </Typography>
                      )}
                    </Grid>
                    {embeddingForm.provider === 'ollama' && (
                      <Grid item xs={12}>
                        <TextField
                          label="Base URL"
                          fullWidth
                          size="small"
                          value={embeddingForm.base_url}
                          onChange={(e) => handleEmbeddingFormChange('base_url', e.target.value)}
                          placeholder="http://worker:11434"
                        />
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <TextField
                        label="Extra settings (JSON)"
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                        value={embeddingForm.settings}
                        onChange={(e) => handleEmbeddingFormChange('settings', e.target.value)}
                        placeholder='{ "device": "cpu" }'
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={embeddingForm.is_active}
                            onChange={(e) => handleEmbeddingFormChange('is_active', e.target.checked)}
                          />
                        }
                        label="Activate immediately"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button variant="contained" onClick={handleCreateEmbeddingConfig} sx={{ borderRadius: 2 }}>
                        Save configuration
                      </Button>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Worker scaling */}
      <Grid item xs={12}>
        <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <StorageIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="600" gutterBottom>
                  Worker Scaling
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Control how many embedding workers run in parallel
                </Typography>
              </Box>
            </Box>
            <Box sx={{ px: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Current workers: {workerConfig.max_workers}
              </Typography>
              <Slider
                value={workerConfig.max_workers}
                min={1}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                onChange={(_, value) => setWorkerConfig({ max_workers: Array.isArray(value) ? value[0] : value })}
              />
              <Button
                variant="contained"
                sx={{ mt: 2, borderRadius: 2 }}
                onClick={handleWorkerSave}
                disabled={workerSaving}
                startIcon={workerSaving ? <CircularProgress size={18} /> : <SaveIcon />}
              >
                {workerSaving ? 'Updating...' : 'Apply worker limit'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

            {/* System Settings */}
            <Grid item xs={12} md={6}>
              <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <SecurityIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                    <Box>
                      <Typography variant="h5" fontWeight="600" gutterBottom>
                        System Settings
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Manage storage and system preferences
                      </Typography>
                    </Box>
                  </Box>
                  
                  <List sx={{ bgcolor: '#f8f9fa', borderRadius: 2, p: 2 }}>
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  sx={{ 
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem'
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </TabPanel>

      {/* Model Configurations Tab */}
      <TabPanel value={currentTab} index={1}>
        <ModelConfigurations />
      </TabPanel>

      {/* API Keys Tab */}
      <TabPanel value={currentTab} index={2}>
        <APIKeyManagement />
      </TabPanel>

      {/* Ollama Tab */}
      <TabPanel value={currentTab} index={3}>
        <OllamaManager />
      </TabPanel>

      </Paper>

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
