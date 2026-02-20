import { useState } from 'react';
import logger from '../../../../utils/logger';

const useDataBackup = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/v1/backup/export?include_audio=${includeAudio}`);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename =
        filenameMatch?.[1] ||
        `backup_${new Date().toISOString().split('T')[0]}.${includeAudio ? 'zip' : 'json'}`;

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
        message: `Data exported successfully${includeAudio ? ' (with audio files)' : ''}!`,
        filename,
      });
    } catch (err) {
      logger.error('Export error:', err);
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
      document.getElementById('backup-file-input').value = '';
    } catch (err) {
      logger.error('Import error:', err);
      setError(err.message || 'Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  return {
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
  };
};

export default useDataBackup;
