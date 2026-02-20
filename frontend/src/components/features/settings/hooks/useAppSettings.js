import { useState, useEffect } from 'react';
import { AppSettingsService } from '../../../../services';
import logger from '../../../../utils/logger';

const useAppSettings = () => {
  const [settings, setSettings] = useState({
    transcriptionLanguage: 'en-US',
    enableSpeakerDiarization: true,
    aiAnalysisEnabled: true,
    notificationsEnabled: true,
    autoDeleteAfterDays: 30,
    maxFileSize: 3000,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await AppSettingsService.get();
      setSettings((prev) => ({
        ...prev,
        maxFileSize: response.maxFileSize || response.defaultMaxFileSize || 3000,
      }));
    } catch (error) {
      logger.error('Failed to fetch settings:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load settings. Using defaults.',
        severity: 'warning',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await AppSettingsService.update({ maxFileSize: settings.maxFileSize });
      setSnackbar({ open: true, message: 'Settings saved successfully!', severity: 'success' });
    } catch (error) {
      logger.error('Failed to save settings:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to save settings',
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return {
    settings,
    isLoading,
    isSaving,
    snackbar,
    handleSettingChange,
    handleSaveSettings,
    showSnackbar,
    closeSnackbar,
  };
};

export default useAppSettings;
