import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Analytics as AnalyticsIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Mic as MicIcon,
  Settings as SettingsIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import ConfirmDialog from '../../../common/ConfirmDialog';
import useModelConfigurations from '../hooks/useModelConfigurations';

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index}>{value === index && <Box sx={{ p: 3 }}>{children}</Box>}</div>
);

const ModelConfigurationsContainer = () => {
  const {
    configurations,
    providers,
    apiKeys,
    dialogOpen,
    isEditing,
    isLoading,
    isSaving,
    snackbar,
    setSnackbar,
    activeTab,
    setActiveTab,
    formData,
    deleteConfirmOpen,
    handleOpenDialog,
    handleCloseDialog,
    handleSaveConfiguration,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleSetDefault,
    handleFormChange,
    handleNameChange,
    handleMaxTokensChange,
    handleChatModelChange,
    handleAnalysisModelChange,
    handleChatBaseUrlChange,
    handleAnalysisBaseUrlChange,
  } = useModelConfigurations();

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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Configuration
        </Button>
      </Box>

      <Grid container spacing={3}>
        {configurations.map((config) => (
          <Grid item xs={12} md={6} lg={4} key={config.id}>
            <Card elevation={3}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
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
                      onClick={() => handleDeleteRequest(config.id)}
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
        <DialogTitle>{isEditing ? 'Edit Configuration' : 'Create Configuration'}</DialogTitle>
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
                  onChange={(e) =>
                    handleFormChange('max_reasoning_depth', parseInt(e.target.value))
                  }
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
                  placeholder="e.g., gpt-4o-mini"
                  helperText="Enter the exact model name to use for chat"
                />
              </Grid>
              {(formData.chat_provider === 'ollama' || formData.chat_provider === 'other') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={
                      formData.chat_provider === 'ollama'
                        ? 'Ollama Base URL'
                        : 'Custom API Endpoint'
                    }
                    value={formData.chat_base_url}
                    onChange={handleChatBaseUrlChange}
                    placeholder={
                      formData.chat_provider === 'ollama'
                        ? 'http://localhost:11434'
                        : 'https://api.example.com/v1'
                    }
                    helperText={
                      formData.chat_provider === 'ollama'
                        ? 'URL of your Ollama instance'
                        : 'Base URL for your custom API endpoint'
                    }
                  />
                </Grid>
              )}
              {formData.chat_provider !== 'ollama' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Chat API Key</InputLabel>
                    <Select
                      value={formData.chat_api_key_id !== null ? formData.chat_api_key_id : ''}
                      onChange={(e) =>
                        handleFormChange(
                          'chat_api_key_id',
                          e.target.value === '' ? null : e.target.value
                        )
                      }
                    >
                      <MenuItem value="">
                        <em>No API Key</em>
                      </MenuItem>
                      {apiKeys
                        .filter((key) => key.provider === formData.chat_provider)
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
                  placeholder="e.g., gpt-4o-mini"
                  helperText="Enter the exact model name to use for analysis"
                />
              </Grid>
              {(formData.analysis_provider === 'ollama' ||
                formData.analysis_provider === 'other') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={
                      formData.analysis_provider === 'ollama'
                        ? 'Ollama Base URL'
                        : 'Custom API Endpoint'
                    }
                    value={formData.analysis_base_url}
                    onChange={handleAnalysisBaseUrlChange}
                    placeholder={
                      formData.analysis_provider === 'ollama'
                        ? 'http://localhost:11434'
                        : 'https://api.example.com/v1'
                    }
                    helperText={
                      formData.analysis_provider === 'ollama'
                        ? 'URL of your Ollama instance'
                        : 'Base URL for your custom API endpoint'
                    }
                  />
                </Grid>
              )}
              {formData.analysis_provider !== 'ollama' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Analysis API Key</InputLabel>
                    <Select
                      value={
                        formData.analysis_api_key_id !== null ? formData.analysis_api_key_id : ''
                      }
                      onChange={(e) =>
                        handleFormChange(
                          'analysis_api_key_id',
                          e.target.value === '' ? null : e.target.value
                        )
                      }
                    >
                      <MenuItem value="">
                        <em>No API Key</em>
                      </MenuItem>
                      {apiKeys
                        .filter((key) => key.provider === formData.analysis_provider)
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

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Configuration"
        message="Are you sure you want to delete this configuration?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

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

export default ModelConfigurationsContainer;
