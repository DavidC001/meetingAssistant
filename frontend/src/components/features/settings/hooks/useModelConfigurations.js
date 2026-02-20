import { useCallback, useEffect, useState } from 'react';
import { APIKeyService, ModelConfigService } from '../../../../services';
import logger from '../../../../utils/logger';

const emptyFormData = {
  name: '',
  whisper_model: 'base',
  whisper_provider: 'faster-whisper',
  chat_provider: 'openai',
  chat_model: 'gpt-4o-mini',
  chat_base_url: '',
  chat_api_key_id: null,
  analysis_provider: 'openai',
  analysis_model: 'gpt-4o-mini',
  analysis_base_url: '',
  analysis_api_key_id: null,
  max_tokens: 4000,
  max_reasoning_depth: 3,
  is_default: false,
};

const useModelConfigurations = () => {
  const [configurations, setConfigurations] = useState([]);
  const [providers, setProviders] = useState({});
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState(emptyFormData);

  // ConfirmDialog state for delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    fetchConfigurations();
    fetchProviders();
    fetchApiKeys();
  }, []);

  const fetchConfigurations = async () => {
    setIsLoading(true);
    try {
      const response = await ModelConfigService.getAll();
      setConfigurations(response);
    } catch (error) {
      logger.error('Failed to fetch configurations:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load model configurations',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await ModelConfigService.getProviders();
      setProviders(response);
    } catch (error) {
      logger.error('Failed to fetch providers:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await APIKeyService.getAll();
      setApiKeys(response);
    } catch (error) {
      logger.error('Failed to fetch API keys:', error);
    }
  };

  const handleOpenDialog = (config = null) => {
    if (config) {
      setFormData(config);
      setIsEditing(true);
    } else {
      setFormData(emptyFormData);
      setIsEditing(false);
    }
    setSelectedConfig(config);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedConfig(null);
    setFormData(emptyFormData);
  };

  const handleSaveConfiguration = async () => {
    setIsSaving(true);
    try {
      if (isEditing) {
        await ModelConfigService.update(selectedConfig.id, formData);
        setSnackbar({
          open: true,
          message: 'Configuration updated successfully',
          severity: 'success',
        });
      } else {
        await ModelConfigService.create(formData);
        setSnackbar({
          open: true,
          message: 'Configuration created successfully',
          severity: 'success',
        });
      }
      fetchConfigurations();
      handleCloseDialog();
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to save configuration',
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = (configId) => {
    setPendingDeleteId(configId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteConfirmOpen(false);
    try {
      await ModelConfigService.delete(pendingDeleteId);
      setSnackbar({
        open: true,
        message: 'Configuration deleted successfully',
        severity: 'success',
      });
      fetchConfigurations();
    } catch (error) {
      logger.error('Failed to delete configuration:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to delete configuration',
        severity: 'error',
      });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const handleSetDefault = async (configId) => {
    try {
      await ModelConfigService.setDefault(configId);
      setSnackbar({
        open: true,
        message: 'Default configuration updated',
        severity: 'success',
      });
      fetchConfigurations();
    } catch (error) {
      logger.error('Failed to set default:', error);
      setSnackbar({
        open: true,
        message: 'Failed to set default configuration',
        severity: 'error',
      });
    }
  };

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleNameChange = useCallback(
    (e) => handleFormChange('name', e.target.value),
    [handleFormChange]
  );
  const handleMaxTokensChange = useCallback(
    (e) => handleFormChange('max_tokens', parseInt(e.target.value)),
    [handleFormChange]
  );
  const handleChatModelChange = useCallback(
    (e) => handleFormChange('chat_model', e.target.value),
    [handleFormChange]
  );
  const handleAnalysisModelChange = useCallback(
    (e) => handleFormChange('analysis_model', e.target.value),
    [handleFormChange]
  );
  const handleChatBaseUrlChange = useCallback(
    (e) => handleFormChange('chat_base_url', e.target.value),
    [handleFormChange]
  );
  const handleAnalysisBaseUrlChange = useCallback(
    (e) => handleFormChange('analysis_base_url', e.target.value),
    [handleFormChange]
  );

  return {
    configurations,
    providers,
    apiKeys,
    selectedConfig,
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
  };
};

export default useModelConfigurations;
