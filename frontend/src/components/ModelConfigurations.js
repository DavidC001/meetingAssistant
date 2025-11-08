import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  TextField,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Psychology as PsychologyIcon,
  Mic as MicIcon,
  Chat as ChatIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const ModelConfigurations = () => {
  const [configurations, setConfigurations] = useState([]);
  const [providers, setProviders] = useState({});
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [activeTab, setActiveTab] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    whisper_model: 'base',
    whisper_provider: 'faster-whisper',
    chat_provider: 'openai',
    chat_model: 'gpt-4o-mini',
    chat_base_url: '',
    chat_api_key_id: null,
    analysis_provider: 'openai',
    analysis_model: 'gpt-4o-mini',
    analysis_base_url: '',
    analysis_api_key_id: null,
    max_tokens: 4000,
    max_reasoning_depth: 3,
    is_default: false
  });

  useEffect(() => {
    fetchConfigurations();
    fetchProviders();
    fetchApiKeys();
  }, []);

  const fetchConfigurations = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/v1/settings/model-configurations');
      setConfigurations(response.data);
    } catch (error) {
      console.error('Failed to fetch configurations:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load model configurations',
        severity: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await api.get('/api/v1/settings/model-providers');
      setProviders(response.data);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await api.get('/api/v1/settings/api-keys');
      setApiKeys(response.data);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const handleOpenDialog = (config = null) => {
    if (config) {
      setFormData(config);
      setIsEditing(true);
    } else {
      setFormData({
        name: '',
        whisper_model: 'base',
        whisper_provider: 'faster-whisper',
        chat_provider: 'openai',
        chat_model: 'gpt-4o-mini',
        chat_base_url: '',
        chat_api_key_id: null,
        analysis_provider: 'openai',
        analysis_model: 'gpt-4o-mini',
        analysis_base_url: '',
        analysis_api_key_id: null,
        max_tokens: 4000,
        max_reasoning_depth: 3,
        is_default: false
      });
      setIsEditing(false);
    }
    setSelectedConfig(config);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedConfig(null);
    setFormData({
      name: '',
      whisper_model: 'base',
      whisper_provider: 'faster-whisper',
      chat_provider: 'openai',
      chat_model: 'gpt-4o-mini',
      chat_base_url: '',
      chat_api_key_id: null,
      analysis_provider: 'openai',
      analysis_model: 'gpt-4o-mini',
      analysis_base_url: '',
      analysis_api_key_id: null,
      max_tokens: 4000,
      max_reasoning_depth: 3,
      is_default: false
    });
  };

  const handleSaveConfiguration = async () => {
    setIsSaving(true);
    try {
      if (isEditing) {
        await api.put(`/api/v1/settings/model-configurations/${selectedConfig.id}`, formData);
        setSnackbar({
          open: true,
          message: 'Configuration updated successfully',
          severity: 'success'
        });
      } else {
        await api.post('/api/v1/settings/model-configurations', formData);
        setSnackbar({
          open: true,
          message: 'Configuration created successfully',
          severity: 'success'
        });
      }
      fetchConfigurations();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to save configuration',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfiguration = async (configId) => {
    if (!window.confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      await api.delete(`/api/v1/settings/model-configurations/${configId}`);
      setSnackbar({
        open: true,
        message: 'Configuration deleted successfully',
        severity: 'success'
      });
      fetchConfigurations();
    } catch (error) {
      console.error('Failed to delete configuration:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to delete configuration',
        severity: 'error'
      });
    }
  };

  const handleSetDefault = async (configId) => {
    try {
      await api.post(`/api/v1/settings/model-configurations/${configId}/set-default`);
      setSnackbar({
        open: true,
        message: 'Default configuration updated',
        severity: 'success'
      });
      fetchConfigurations();
    } catch (error) {
      console.error('Failed to set default:', error);
      setSnackbar({
        open: true,
        message: 'Failed to set default configuration',
        severity: 'error'
      });
    }
  };

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Optimized change handlers to prevent focus loss
  const handleNameChange = useCallback((e) => {
    handleFormChange('name', e.target.value);
  }, [handleFormChange]);

  const handleMaxTokensChange = useCallback((e) => {
    handleFormChange('max_tokens', parseInt(e.target.value));
  }, [handleFormChange]);

  const handleChatModelChange = useCallback((e) => {
    handleFormChange('chat_model', e.target.value);
  }, [handleFormChange]);

  const handleAnalysisModelChange = useCallback((e) => {
    handleFormChange('analysis_model', e.target.value);
  }, [handleFormChange]);

  const handleChatBaseUrlChange = useCallback((e) => {
    handleFormChange('chat_base_url', e.target.value);
  }, [handleFormChange]);

  const handleAnalysisBaseUrlChange = useCallback((e) => {
    handleFormChange('analysis_base_url', e.target.value);
  }, [handleFormChange]);

  const getModelsForProvider = (provider) => {
    if (!providers || !provider) return [];
    
    switch (provider) {
      case 'openai':
        return providers.openai_models || [];
      case 'anthropic':
        return providers.anthropic_models || [];
      case 'cohere':
        return providers.cohere_models || [];
      case 'gemini':
        return providers.gemini_models || [];
      case 'grok':
        return providers.grok_models || [];
      case 'groq':
        return providers.groq_models || [];
      case 'ollama':
        return providers.ollama_models || [];
      case 'other':
        return providers.other_models || [];
      default:
        return [];
    }
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'openai':
        return <PsychologyIcon />;
      case 'ollama':
        return <ChatIcon />;
      default:
        return <PsychologyIcon />;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Model Configurations</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Configuration
        </Button>
      </Box>

      <Grid container spacing={3}>
        {configurations.map((config) => (
          <Grid item xs={12} md={6} lg={4} key={config.id}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {config.name}
                    {config.is_default && (
                      <Chip
                        icon={<StarIcon />}
                        label="Default"
                        color="primary"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(config)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteConfiguration(config.id)}
                      color="error"
                      disabled={config.is_default}
                    >
                      <DeleteIcon />
                    </IconButton>
                    {!config.is_default && (
                      <IconButton
                        size="small"
                        onClick={() => handleSetDefault(config.id)}
                        color="warning"
                      >
                        <StarBorderIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Whisper Model"
                      secondary={`${config.whisper_model} (${config.whisper_provider})`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Chat Provider"
                      secondary={`${config.chat_provider} - ${config.chat_model}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Analysis Provider"
                      secondary={`${config.analysis_provider} - ${config.analysis_model}`}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Configuration Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEditing ? 'Edit Configuration' : 'Create Configuration'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
              <Tab label="General" icon={<SettingsIcon />} />
              <Tab label="Transcription" icon={<MicIcon />} />
              <Tab label="Chat" icon={<ChatIcon />} />
              <Tab label="Analysis" icon={<AnalyticsIcon />} />
            </Tabs>
          </Box>

          {/* General Tab */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Configuration Name"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Tokens"
                  value={formData.max_tokens}
                  onChange={handleMaxTokensChange}
                  inputProps={{ min: 100, max: 32000 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Reasoning Depth"
                  value={formData.max_reasoning_depth}
                  onChange={(e) => handleFormChange('max_reasoning_depth', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 10 }}
                  helperText="Maximum steps for iterative research tool (1-10)"
                />
              </Grid>
            </Grid>
          </TabPanel>

          {/* Transcription Tab */}
          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Whisper Provider</InputLabel>
                  <Select
                    value={formData.whisper_provider}
                    onChange={(e) => handleFormChange('whisper_provider', e.target.value)}
                  >
                    {providers.whisper_providers?.map((provider) => (
                      <MenuItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Whisper Model</InputLabel>
                  <Select
                    value={formData.whisper_model}
                    onChange={(e) => handleFormChange('whisper_model', e.target.value)}
                  >
                    {providers.whisper_models?.map((model) => (
                      <MenuItem key={model} value={model}>
                        {model}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Chat Tab */}
          <TabPanel value={activeTab} index={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Chat Provider</InputLabel>
                  <Select
                    value={formData.chat_provider}
                    onChange={(e) => handleFormChange('chat_provider', e.target.value)}
                  >
                    {providers.llm_providers?.map((provider) => (
                      <MenuItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Chat Model"
                  value={formData.chat_model}
                  onChange={handleChatModelChange}
                  placeholder="Enter model name (e.g., gpt-4o-mini, claude-3-sonnet, llama3-8b, etc.)"
                  helperText="Enter the exact model name to use for chat"
                />
              </Grid>
              {(formData.chat_provider === 'ollama' || formData.chat_provider === 'other') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={formData.chat_provider === 'ollama' ? "Ollama Base URL" : "Custom API Endpoint"}
                    value={formData.chat_base_url}
                    onChange={handleChatBaseUrlChange}
                    placeholder={formData.chat_provider === 'ollama' ? "http://localhost:11434" : "https://api.example.com/v1"}
                    helperText={formData.chat_provider === 'ollama' ? "URL of your Ollama instance" : "Base URL for your custom API endpoint"}
                  />
                </Grid>
              )}
              {formData.chat_provider !== 'ollama' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Chat API Key</InputLabel>
                    <Select
                      value={formData.chat_api_key_id !== null ? formData.chat_api_key_id : ''}
                      onChange={(e) => handleFormChange('chat_api_key_id', e.target.value === '' ? null : e.target.value)}
                    >
                      <MenuItem value="">
                        <em>No API Key</em>
                      </MenuItem>
                      {apiKeys
                        .filter(key => key.provider === formData.chat_provider)
                        .map((apiKey) => (
                        <MenuItem key={apiKey.id} value={apiKey.id}>
                          {apiKey.name} ({apiKey.description || apiKey.environment_variable})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </TabPanel>

          {/* Analysis Tab */}
          <TabPanel value={activeTab} index={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Analysis Provider</InputLabel>
                  <Select
                    value={formData.analysis_provider}
                    onChange={(e) => handleFormChange('analysis_provider', e.target.value)}
                  >
                    {providers.llm_providers?.map((provider) => (
                      <MenuItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Analysis Model"
                  value={formData.analysis_model}
                  onChange={handleAnalysisModelChange}
                  placeholder="Enter model name (e.g., gpt-4o-mini, claude-3-sonnet, llama3-8b, etc.)"
                  helperText="Enter the exact model name to use for analysis"
                />
              </Grid>
              {(formData.analysis_provider === 'ollama' || formData.analysis_provider === 'other') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={formData.analysis_provider === 'ollama' ? "Ollama Base URL" : "Custom API Endpoint"}
                    value={formData.analysis_base_url}
                    onChange={handleAnalysisBaseUrlChange}
                    placeholder={formData.analysis_provider === 'ollama' ? "http://localhost:11434" : "https://api.example.com/v1"}
                    helperText={formData.analysis_provider === 'ollama' ? "URL of your Ollama instance" : "Base URL for your custom API endpoint"}
                  />
                </Grid>
              )}
              {formData.analysis_provider !== 'ollama' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Analysis API Key</InputLabel>
                    <Select
                      value={formData.analysis_api_key_id !== null ? formData.analysis_api_key_id : ''}
                      onChange={(e) => handleFormChange('analysis_api_key_id', e.target.value === '' ? null : e.target.value)}
                    >
                      <MenuItem value="">
                        <em>No API Key</em>
                      </MenuItem>
                      {apiKeys
                        .filter(key => key.provider === formData.analysis_provider)
                        .map((apiKey) => (
                        <MenuItem key={apiKey.id} value={apiKey.id}>
                          {apiKey.name} ({apiKey.description || apiKey.environment_variable})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveConfiguration} 
            variant="contained"
            disabled={isSaving || !formData.name}
            startIcon={isSaving ? <CircularProgress size={20} /> : null}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default ModelConfigurations;
