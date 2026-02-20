import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Switch,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  Upload as UploadIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import useDataBackup from '../hooks/useDataBackup';

const DataBackupContainer = () => {
  const {
    exporting,
    importing,
    importFile,
    mergeMode,
    setMergeMode,
    includeAudio,
    setIncludeAudio,
    result,
    error,
    handleExport,
    handleFileSelect,
    handleImport,
  } = useDataBackup();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Data Backup & Restore
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Export all your data to a backup file or restore data from a previous backup.
      </Typography>

      {/* Export Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CloudDownloadIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Export Data</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          Download a complete backup of all meetings, transcripts, action items, settings, and
          configurations.
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>What&apos;s included in the export?</AlertTitle>
          <List dense>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="All meetings with transcripts and summaries" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Action items and their status" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Speaker information and user mappings" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Meeting relationships and connections" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <WarningIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText primary="Note: OAuth credentials are NOT included" />
            </ListItem>
          </List>
        </Alert>

        <FormControlLabel
          control={
            <Switch
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              disabled={exporting}
            />
          }
          label={
            includeAudio ? '📦 Include audio files (ZIP format)' : '📄 Export as JSON (no audio)'
          }
          sx={{ mb: 2 }}
        />
        {includeAudio && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Audio files will be included. This may create a large file size. Depending on the number
            and size of your audio files, the export may take a few minutes.
          </Alert>
        )}

        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
          onClick={handleExport}
          disabled={exporting}
          fullWidth
        >
          {exporting ? 'Exporting...' : 'Export All Data'}
        </Button>
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* Import Section */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CloudUploadIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Import Data</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          Restore data from a backup file. Choose your import strategy carefully.
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Import Strategy</AlertTitle>
          <FormControlLabel
            control={
              <Switch
                checked={mergeMode}
                onChange={(e) => setMergeMode(e.target.checked)}
                disabled={importing}
              />
            }
            label={
              mergeMode
                ? 'Merge Mode: Update existing records'
                : 'Skip Mode: Only import new records'
            }
          />
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            {mergeMode
              ? '⚠️ Merge mode will update existing records with imported data. Use with caution!'
              : "✓ Skip mode will only import records that don't already exist (safer option)."}
          </Typography>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <input
            id="backup-file-input"
            type="file"
            accept=".json,.zip"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={importing}
          />
          <label htmlFor="backup-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              disabled={importing}
              fullWidth
              sx={{ mb: 1 }}
            >
              Select Backup File
            </Button>
          </label>

          {importFile && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Selected: {importFile.name} ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          color="primary"
          startIcon={
            importing ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />
          }
          onClick={handleImport}
          disabled={!importFile || importing}
          fullWidth
        >
          {importing ? 'Importing...' : 'Import Data'}
        </Button>
      </Paper>

      {(exporting || importing) && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {result && (
        <Alert severity={result.type} sx={{ mt: 2 }}>
          <AlertTitle>{result.type === 'success' ? 'Success' : 'Information'}</AlertTitle>
          {result.message}
          {result.filename && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              File: {result.filename}
            </Typography>
          )}
          {result.statistics && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Import Statistics:</Typography>
              <List dense>
                <ListItem disableGutters>
                  <ListItemText
                    primary={`Meetings: ${result.statistics.meetings_imported} imported, ${result.statistics.meetings_skipped} skipped`}
                  />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText
                    primary={`User Mappings: ${result.statistics.user_mappings_imported} imported`}
                  />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText primary={`Links: ${result.statistics.links_imported} imported`} />
                </ListItem>
                {result.statistics.api_keys_imported > 0 && (
                  <ListItem disableGutters>
                    <ListItemText
                      primary={`API Keys: ${result.statistics.api_keys_imported} imported`}
                    />
                  </ListItem>
                )}
                {result.statistics.model_configs_imported > 0 && (
                  <ListItem disableGutters>
                    <ListItemText
                      primary={`Model Configs: ${result.statistics.model_configs_imported} imported`}
                    />
                  </ListItem>
                )}
                {result.statistics.embedding_configs_imported > 0 && (
                  <ListItem disableGutters>
                    <ListItemText
                      primary={`Embedding Configs: ${result.statistics.embedding_configs_imported} imported`}
                    />
                  </ListItem>
                )}
                {result.statistics.errors && result.statistics.errors.length > 0 && (
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 30 }}>
                      <ErrorIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${result.statistics.errors.length} errors occurred`}
                      secondary={result.statistics.errors.slice(0, 3).join('; ')}
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          )}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default DataBackupContainer;
