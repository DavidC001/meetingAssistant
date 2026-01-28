import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  CloudQueue as CloudQueueIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import api from '../../../api';

const OllamaManager = () => {
  const [status, setStatus] = useState('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [ollamaConfig, setOllamaConfig] = useState({
    model: 'llama3.2',
    port: 11434,
  });

  const checkOllamaStatus = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/ollama/status');
      setStatus(response.data.status);
      setError(null);
    } catch (err) {
      console.error('Failed to check Ollama status:', err);
      setStatus('error');
      setError('Failed to check Ollama status');
    } finally {
      setIsLoading(false);
    }
  };

  const startOllama = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      const response = await api.post('/api/v1/ollama/start', ollamaConfig);
      setSuccess(response.data.message || 'Ollama container started successfully!');
      setTimeout(checkOllamaStatus, 3000); // Check status after 3 seconds
    } catch (err) {
      console.error('Failed to start Ollama:', err);
      setError(err.response?.data?.detail || 'Failed to start Ollama container');
    } finally {
      setIsLoading(false);
    }
  };

  const stopOllama = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      const response = await api.post('/api/v1/ollama/stop');
      setSuccess(response.data.message || 'Ollama container stopped successfully!');
      setTimeout(checkOllamaStatus, 2000);
    } catch (err) {
      console.error('Failed to stop Ollama:', err);
      setError(err.response?.data?.detail || 'Failed to stop Ollama container');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <CheckCircleIcon color="success" />;
      case 'stopped':
        return <StopIcon color="disabled" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="warning" />;
    }
  };

  return (
    <Card elevation={3}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CloudQueueIcon sx={{ mr: 1, color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h5">Ollama Docker Manager</Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={checkOllamaStatus}
            sx={{ ml: 'auto' }}
            size="small"
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Ollama allows you to run local LLM models for AI features without relying on external
          APIs. This is useful for privacy, cost savings, and offline operation.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Paper elevation={1} sx={{ p: 3, mb: 3, bgcolor: 'action.hover' }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getStatusIcon()}
              <Typography variant="h6">Status:</Typography>
              <Chip
                label={status === 'unknown' ? 'Checking...' : status}
                color={getStatusColor()}
                variant="outlined"
              />
            </Box>
            {isLoading && <CircularProgress size={24} />}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            {status !== 'running' ? (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  onClick={startOllama}
                  disabled={isLoading}
                  fullWidth
                >
                  Start Ollama Container
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setConfigDialogOpen(true)}
                  disabled={isLoading}
                >
                  Configure
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="error"
                startIcon={isLoading ? <CircularProgress size={20} /> : <StopIcon />}
                onClick={stopOllama}
                disabled={isLoading}
                fullWidth
              >
                Stop Ollama Container
              </Button>
            )}
          </Box>
        </Paper>

        <Typography variant="h6" gutterBottom>
          Features
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Local LLM Processing"
              secondary="Run AI models locally without external API calls"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Privacy Focused"
              secondary="Your meeting data never leaves your infrastructure"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Cost Effective"
              secondary="No per-token charges for AI analysis"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="GPU Acceleration"
              secondary="Leverages available GPU resources for faster processing"
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        <Alert severity="warning">
          <Typography variant="body2">
            <strong>Note:</strong> Running Ollama requires significant system resources (RAM and
            GPU). Make sure your system meets the requirements before starting the container.
          </Typography>
        </Alert>
      </CardContent>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Configure Ollama</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Model"
              value={ollamaConfig.model}
              onChange={(e) => setOllamaConfig({ ...ollamaConfig, model: e.target.value })}
              helperText="Default model to use (e.g., llama3.2, mistral, codellama)"
              fullWidth
            />
            <TextField
              label="Port"
              type="number"
              value={ollamaConfig.port}
              onChange={(e) => setOllamaConfig({ ...ollamaConfig, port: parseInt(e.target.value) })}
              helperText="Port to expose Ollama API (default: 11434)"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => setConfigDialogOpen(false)} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default OllamaManager;
