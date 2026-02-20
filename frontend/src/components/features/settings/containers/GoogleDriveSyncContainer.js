import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  CloudQueue as CloudIcon,
  Error as ErrorIcon,
  Folder as FolderIcon,
  Info as InfoIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import ConfirmDialog from '../../../common/ConfirmDialog';
import useGoogleDriveSync from '../hooks/useGoogleDriveSync';

const GoogleDriveSyncContainer = () => {
  const {
    status,
    config,
    setConfig,
    processedFiles,
    loading,
    saving,
    syncing,
    error,
    setError,
    success,
    setSuccess,
    disconnectConfirmOpen,
    fetchStatus,
    handleConnect,
    handleDisconnectRequest,
    handleDisconnectConfirm,
    handleDisconnectCancel,
    handleSaveConfig,
    handleTriggerSync,
  } = useGoogleDriveSync();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
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

      {/* Connection Status */}
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
                  onClick={handleDisconnectRequest}
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
                helperText="The Google Drive folder ID to monitor for new files."
                placeholder="1AbCdEfGhIjKlMnOpQrStUvWxYz"
              />

              <TextField
                label="Processed Folder ID (Optional)"
                value={config.processed_folder_id}
                onChange={(e) => setConfig({ ...config, processed_folder_id: e.target.value })}
                fullWidth
                helperText="Files will be moved here after processing. Leave empty to auto-create a 'processed' folder."
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
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
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
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={disconnectConfirmOpen}
        title="Disconnect from Google Drive"
        message="Are you sure you want to disconnect from Google Drive?"
        confirmLabel="Disconnect"
        confirmColor="error"
        onConfirm={handleDisconnectConfirm}
        onCancel={handleDisconnectCancel}
      />
    </Box>
  );
};

export default GoogleDriveSyncContainer;
