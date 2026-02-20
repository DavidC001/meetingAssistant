import { useEffect, useState } from 'react';
import { GoogleDriveService } from '../../../../services';
import logger from '../../../../utils/logger';

const useGoogleDriveSync = () => {
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
  const [, setShowFilesDialog] = useState(false);
  const [authWindow, setAuthWindow] = useState(null);

  // ConfirmDialog state for disconnect
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchProcessedFiles();

    const onMessage = async (event) => {
      if (!event?.data || typeof event.data !== 'object') return;
      if (event.data.type === 'google-oauth-success' && event.data.code) {
        try {
          setError(null);
          setSuccess('Completing Google authorization...');
          const params = { code: event.data.code };
          if (event.data.state) params.state = event.data.state;
          await GoogleDriveService.completeAuthorization(params);
          setSuccess('Google Drive connected successfully.');
          fetchStatus();
          if (authWindow && !authWindow.closed) authWindow.close();
        } catch (err) {
          logger.error('OAuth callback failed', err);
          setError(err.response?.data?.detail || 'Failed to complete Google Drive authorization');
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await GoogleDriveService.getStatus();
      setStatus(response);
      setConfig({
        sync_folder_id: response.sync_folder_id || '',
        processed_folder_id: response.processed_folder_id || '',
        enabled: response.sync_enabled || false,
        auto_process: true,
        sync_mode: response.sync_mode || 'manual',
        sync_time: response.sync_time || '04:00',
      });
      setError(null);
    } catch (err) {
      logger.error('Failed to fetch Google Drive status:', err);
      setError('Failed to load Google Drive status');
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessedFiles = async () => {
    try {
      const response = await GoogleDriveService.getProcessedFiles(10);
      setProcessedFiles(response);
    } catch (err) {
      logger.error('Failed to fetch processed files:', err);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await GoogleDriveService.authorize();
      const w = window.open(response.auth_url, 'google-oauth', 'width=600,height=700');
      setAuthWindow(w);
      setSuccess('Please complete authentication in the pop-up window.');
    } catch (err) {
      logger.error('Failed to get auth URL:', err);
      setError('Failed to initiate Google Drive authentication');
    }
  };

  const handleDisconnectRequest = () => {
    setDisconnectConfirmOpen(true);
  };

  const handleDisconnectConfirm = async () => {
    setDisconnectConfirmOpen(false);
    try {
      await GoogleDriveService.disconnect();
      setSuccess('Successfully disconnected from Google Drive');
      fetchStatus();
    } catch (err) {
      logger.error('Failed to disconnect:', err);
      setError('Failed to disconnect from Google Drive');
    }
  };

  const handleDisconnectCancel = () => {
    setDisconnectConfirmOpen(false);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await GoogleDriveService.updateConfig(config);
      setSuccess('Google Drive configuration saved successfully');
      fetchStatus();
    } catch (err) {
      logger.error('Failed to save config:', err);
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
      await GoogleDriveService.syncNow();
      setSuccess('Google Drive sync started. Files will be processed in the background.');
      setTimeout(() => {
        fetchProcessedFiles();
        fetchStatus();
      }, 5000);
    } catch (err) {
      logger.error('Failed to trigger sync:', err);
      setError(err.response?.data?.detail || 'Failed to trigger Google Drive sync');
    } finally {
      setSyncing(false);
    }
  };

  return {
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
    setShowFilesDialog,
    fetchStatus,
    handleConnect,
    handleDisconnectRequest,
    handleDisconnectConfirm,
    handleDisconnectCancel,
    handleSaveConfig,
    handleTriggerSync,
  };
};

export default useGoogleDriveSync;
