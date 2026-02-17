import React, { useState, useEffect } from 'react';
import { APIKeyService } from '../../../services';
import logger from '../../../utils/logger';
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
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
} from '@mui/icons-material';

const APIKeyManagement = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai',
    environment_variable: '',
    key_value: '',
    description: '',
    is_active: true,
  });

  const providers = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'cohere', name: 'Cohere' },
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'grok', name: 'Grok (xAI)' },
    { id: 'groq', name: 'Groq' },
    { id: 'huggingface', name: 'Hugging Face' },
    { id: 'other', name: 'Other/Custom' },
  ];

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    setIsLoading(true);
    try {
      logger.log('Fetching API keys...');
      const response = await APIKeyService.getAll();
      logger.log('API keys response:', response);
      setApiKeys(response);
    } catch (error) {
      logger.error('Failed to fetch API keys:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load API keys',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOpenDialog = (apiKey = null) => {
    if (apiKey) {
      setFormData(apiKey);
      setIsEditing(true);
    } else {
      setFormData({
        name: '',
        provider: 'openai',
        environment_variable: '',
        key_value: '',
        description: '',
        is_active: true,
      });
      setIsEditing(false);
    }
    setSelectedKey(apiKey);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedKey(null);
    setFormData({
      name: '',
      provider: 'openai',
      environment_variable: '',
      key_value: '',
      description: '',
      is_active: true,
    });
  };

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      if (isEditing) {
        await APIKeyService.update(selectedKey.id, formData);
        setSnackbar({
          open: true,
          message: 'API key updated successfully',
          severity: 'success',
        });
      } else {
        await APIKeyService.create(formData);
        setSnackbar({
          open: true,
          message: 'API key created successfully',
          severity: 'success',
        });
      }
      fetchApiKeys();
      handleCloseDialog();
    } catch (error) {
      logger.error('Failed to save API key:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to save API key',
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async (keyId) => {
    logger.log('Attempting to delete API key with ID:', keyId);
    if (window.confirm('Are you sure you want to delete this API key?')) {
      try {
        logger.log('Sending DELETE request to:', `/api/v1/settings/api-keys/${keyId}`);
        const response = await APIKeyService.delete(keyId);
        logger.log('Delete response:', response);
        setSnackbar({
          open: true,
          message: 'API key deleted successfully',
          severity: 'success',
        });
        fetchApiKeys();
      } catch (error) {
        logger.error('Failed to delete API key:', error);
        logger.error('Error response:', error.response);
        setSnackbar({
          open: true,
          message: error.response?.data?.detail || 'Failed to delete API key',
          severity: 'error',
        });
      }
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
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          API Key Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add API Key
        </Button>
      </Box>

      {/* API Keys List */}
      <Card>
        <CardContent>
          {apiKeys.length === 0 ? (
            <Alert severity="info">
              No API keys configured. Click "Add API Key" to create your first API key
              configuration.
            </Alert>
          ) : (
            <List>
              {apiKeys.map((apiKey) => {
                const isEnvironmentKey = apiKey.id < 0; // Environment keys have negative IDs

                return (
                  <ListItem key={apiKey.id} divider>
                    <Box display="flex" alignItems="center" mr={2}>
                      <KeyIcon color="primary" />
                    </Box>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1">{apiKey.name}</Typography>
                          <Chip
                            label={apiKey.provider}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {isEnvironmentKey && (
                            <Chip
                              label="Environment"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                          {!apiKey.is_active && (
                            <Chip label="Inactive" size="small" color="error" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Environment Variable: {apiKey.environment_variable}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Key Value: {apiKey.masked_value || '****'}
                          </Typography>
                          {apiKey.description && (
                            <Typography variant="body2" color="textSecondary">
                              {apiKey.description}
                            </Typography>
                          )}
                          {isEnvironmentKey && (
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              style={{ fontStyle: 'italic' }}
                            >
                              This API key is loaded from environment variables and cannot be edited
                              here.
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {!isEnvironmentKey && (
                        <>
                          <IconButton
                            edge="end"
                            aria-label="edit"
                            onClick={() => handleOpenDialog(apiKey)}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => handleDeleteApiKey(apiKey.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* API Key Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? 'Edit API Key' : 'Add API Key'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                required
                placeholder="e.g., OpenAI Production"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={formData.provider}
                  onChange={(e) => handleFormChange('provider', e.target.value)}
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Environment Variable"
                value={formData.environment_variable}
                onChange={(e) => handleFormChange('environment_variable', e.target.value)}
                required
                placeholder="e.g., OPENAI_API_KEY"
                helperText="The environment variable name that contains the actual API key"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="API Key Value"
                value={formData.key_value}
                onChange={(e) => handleFormChange('key_value', e.target.value)}
                placeholder="Enter your API key"
                helperText={
                  isEditing
                    ? 'Leave blank to keep the existing key value'
                    : 'The actual API key that will be saved to the environment'
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                multiline
                rows={2}
                placeholder="Optional description for this API key"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveApiKey}
            disabled={isSaving || !formData.name || !formData.environment_variable}
          >
            {isSaving ? <CircularProgress size={20} /> : isEditing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default APIKeyManagement;
