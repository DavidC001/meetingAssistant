import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  CloudQueue as CloudIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Sync as SyncIcon,
  Folder as FolderIcon,
  Info as InfoIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../../../api';

const GoogleDriveSync = () => {
  const [status, setStatus] = useState({
    authenticated: false,
    configured: false,
    sync_enabled: false,
    sync_folder_id: '',
    processed_folder_id: '',
    last_sync_at: null,
    sync_mode: 'manual',
    sync_time: '04:00',
  });

  const [config, setConfig] = useState({
    sync_folder_id: '',
    processed_folder_id: '',
    enabled: false,
    auto_process: true,
    sync_mode: 'manual',
    sync_time: '04:00',
  });

  const [processedFiles, setProcessedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showFilesDialog, setShowFilesDialog] = useState(false);
  const [authWindow, setAuthWindow] = useState(null);

  useEffect(() => {
    fetchStatus();
    fetchProcessedFiles();
    // Listen for OAuth code from oauth-callback.html
    const onMessage = async (event) => {
      if (!event?.data || typeof event.data !== 'object') return;
      if (event.data.type === 'google-oauth-success' && event.data.code) {
        try {
          setError(null);
          setSuccess('Completing Google authorization...');
          const params = { code: event.data.code };
          if (event.data.state) params.state = event.data.state;
          await api.get('/api/v1/google-drive/callback', { params });
          setSuccess('Google Drive connected successfully.');
          fetchStatus();
          if (authWindow && !authWindow.closed) authWindow.close();
        } catch (err) {
          console.error('OAuth callback failed', err);
          setError(err.response?.data?.detail || 'Failed to complete Google Drive authorization');
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/google-drive/status');
      setStatus(response.data);
      setConfig({
        sync_folder_id: response.data.sync_folder_id || '',
        processed_folder_id: response.data.processed_folder_id || '',
        enabled: response.data.sync_enabled || false,
        auto_process: true,
        sync_mode: response.data.sync_mode || 'manual',
        sync_time: response.data.sync_time || '04:00',
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Google Drive status:', err);
      setError('Failed to load Google Drive status');
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessedFiles = async () => {
    try {
      const response = await api.get('/api/v1/google-drive/processed-files?limit=10');
      setProcessedFiles(response.data);
    } catch (err) {
      console.error('Failed to fetch processed files:', err);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await api.get('/api/v1/google-drive/auth');
      // Open Google OAuth in a new window
      const w = window.open(response.data.auth_url, 'google-oauth', 'width=600,height=700');
      setAuthWindow(w);
      setSuccess('Please complete authentication in the pop-up window.');
    } catch (err) {
      console.error('Failed to get auth URL:', err);
      setError('Failed to initiate Google Drive authentication');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect from Google Drive?')) {
      return;
    }

    try {
      await api.post('/api/v1/google-drive/disconnect');
      setSuccess('Successfully disconnected from Google Drive');
      fetchStatus();
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect from Google Drive');
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/api/v1/google-drive/config', config);
      setSuccess('Google Drive configuration saved successfully');
      fetchStatus();
    } catch (err) {
      console.error('Failed to save config:', err);
      setError(err.response?.data?.detail || 'Failed to save Google Drive configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/api/v1/google-drive/sync');
      setSuccess('Google Drive sync started. Files will be processed in the background.');

      // Refresh processed files after a delay
      setTimeout(() => {
        fetchProcessedFiles();
        fetchStatus();
      }, 5000);
    } catch (err) {
      console.error('Failed to trigger sync:', err);
      setError(err.response?.data?.detail || 'Failed to trigger Google Drive sync');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Error/Success Messages */}
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

      {/* Connection Status Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CloudIcon
              sx={{
                fontSize: 40,
                mr: 2,
                color: status.authenticated ? 'success.main' : 'text.secondary',
              }}
            />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>
                Google Drive Connection
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={status.authenticated ? 'Connected' : 'Not Connected'}
                  color={status.authenticated ? 'success' : 'default'}
                  size="small"
                  icon={status.authenticated ? <CheckIcon /> : <ErrorIcon />}
                />
                {status.authenticated && status.configured && (
                  <Chip label="Configured" color="primary" size="small" />
                )}
              </Box>
            </Box>
            <Box>
              {status.authenticated ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<LinkOffIcon />}
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<LinkIcon />}
                  onClick={handleConnect}
                >
                  Connect to Google Drive
                </Button>
              )}
            </Box>
          </Box>

          {!status.authenticated && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Connect your Google Drive account to enable automatic file synchronization. The
                system will monitor a folder and automatically download and process new meeting
                files.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      {status.authenticated && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <FolderIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Sync Configuration
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Sync Folder ID"
                value={config.sync_folder_id}
                onChange={(e) => setConfig({ ...config, sync_folder_id: e.target.value })}
                fullWidth
                helperText="The Google Drive folder ID to monitor for new files. Find this in the folder URL."
                placeholder="1AbCdEfGhIjKlMnOpQrStUvWxYz"
              />

              <TextField
                label="Processed Folder ID (Optional)"
                value={config.processed_folder_id}
                onChange={(e) => setConfig({ ...config, processed_folder_id: e.target.value })}
                fullWidth
                helperText="Files will be moved to this folder after processing. If empty, a 'processed' folder will be created automatically."
                placeholder="2BcDeFgHiJkLmNoPqRsTuVwXyZ"
              />

              <Divider sx={{ my: 2 }} />

              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <FormLabel component="legend">Sync Mode</FormLabel>
                <RadioGroup
                  value={config.sync_mode}
                  onChange={(e) => setConfig({ ...config, sync_mode: e.target.value })}
                >
                  <FormControlLabel
                    value="manual"
                    control={<Radio />}
                    label="Manual Only - Sync only when triggered manually"
                  />
                  <FormControlLabel
                    value="scheduled"
                    control={<Radio />}
                    label="Scheduled - Sync automatically once per day"
                  />
                </RadioGroup>
              </FormControl>

              {config.sync_mode === 'scheduled' && (
                <TextField
                  label="Scheduled Sync Time"
                  type="time"
                  value={config.sync_time}
                  onChange={(e) => setConfig({ ...config, sync_time: e.target.value })}
                  fullWidth
                  helperText="Time to run daily sync (24-hour format). Default: 04:00 (4 AM)"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  inputProps={{
                    step: 300, // 5 min
                  }}
                />
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={config.auto_process}
                    onChange={(e) => setConfig({ ...config, auto_process: e.target.checked })}
                  />
                }
                label="Automatically process downloaded files"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  />
                }
                label="Enable automatic synchronization"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleSaveConfig}
                  disabled={saving || !config.sync_folder_id}
                  startIcon={saving ? <CircularProgress size={20} /> : null}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button variant="outlined" onClick={fetchStatus} startIcon={<RefreshIcon />}>
                  Refresh
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Sync Controls */}
      {status.authenticated && status.configured && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <SyncIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Synchronization
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {status.last_sync_at && (
                <Typography variant="body2" color="text.secondary">
                  Last sync: {new Date(status.last_sync_at).toLocaleString()}
                </Typography>
              )}

              {status.sync_mode === 'scheduled' && (
                <Alert severity="info">
                  <Typography variant="body2">
                    Scheduled sync is configured to run daily at {status.sync_time}.
                    {status.sync_enabled
                      ? ' Automatic sync is enabled.'
                      : ' Enable sync in configuration to activate.'}
                  </Typography>
                </Alert>
              )}

              {status.sync_mode === 'manual' && (
                <Alert severity="info">
                  <Typography variant="body2">
                    Sync mode is set to manual. Click the button below to trigger sync.
                  </Typography>
                </Alert>
              )}

              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={
                    syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />
                  }
                  onClick={handleTriggerSync}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Trigger Sync Now'}
                </Button>
              </Box>

              {!status.sync_enabled && status.sync_mode === 'scheduled' && (
                <Alert severity="warning">
                  Automatic sync is disabled. Enable it in the configuration above.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Recently Processed Files */}
      {status.authenticated && processedFiles.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <InfoIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Recently Processed Files
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <List>
              {processedFiles.slice(0, 5).map((file, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={file.drive_file_name}
                    secondary={`Processed: ${new Date(file.processed_at).toLocaleString()}`}
                  />
                  <ListItemSecondaryAction>
                    {file.meeting_id && (
                      <Chip label={`Meeting #${file.meeting_id}`} size="small" color="primary" />
                    )}
                    {file.moved_to_processed && (
                      <Chip label="Moved" size="small" color="success" sx={{ ml: 1 }} />
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {processedFiles.length > 5 && (
              <Button size="small" onClick={() => setShowFilesDialog(true)}>
                View All ({processedFiles.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default GoogleDriveSync;
