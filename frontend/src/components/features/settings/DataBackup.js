import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  AlertTitle,
  CircularProgress,
  FormControlLabel,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  CloudDownload as CloudDownloadIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const DataBackup = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/v1/backup/export');

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename =
        filenameMatch?.[1] || `backup_${new Date().toISOString().split('T')[0]}.json`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setResult({
        type: 'success',
        message: 'Data exported successfully!',
        filename: filename,
      });
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setImportFile(file);
    setError(null);
    setResult(null);
  };

  const handleImport = async () => {
    if (!importFile) {
      setError('Please select a backup file to import');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('merge_mode', mergeMode);

      const response = await fetch(`/api/v1/backup/import?merge_mode=${mergeMode}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Import failed');
      }

      const data = await response.json();

      setResult({
        type: 'success',
        message: 'Data imported successfully!',
        statistics: data.statistics,
      });

      setImportFile(null);
      // Reset file input
      document.getElementById('backup-file-input').value = '';
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import data');
    } finally {
      setImporting(false);
    }
  };

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
          <AlertTitle>What's included in the export?</AlertTitle>
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
              <ListItemText primary="Note: Audio files and OAuth credentials are NOT included" />
            </ListItem>
          </List>
        </Alert>

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
            accept=".json"
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

      {/* Progress indicator */}
      {(exporting || importing) && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Results */}
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

      {/* Errors */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default DataBackup;
