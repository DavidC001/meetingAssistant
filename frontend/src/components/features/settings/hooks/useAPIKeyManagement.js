import { useEffect, useState } from 'react';
import { APIKeyService } from '../../../../services';
import logger from '../../../../utils/logger';

const emptyFormData = {
  name: '',
  provider: 'openai',
  environment_variable: '',
  key_value: '',
  description: '',
  is_active: true,
};

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

const useAPIKeyManagement = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [formData, setFormData] = useState(emptyFormData);

  // ConfirmDialog state for delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

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
      setSnackbar({ open: true, message: 'Failed to load API keys', severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenDialog = (apiKey = null) => {
    if (apiKey) {
      setFormData(apiKey);
      setIsEditing(true);
    } else {
      setFormData(emptyFormData);
      setIsEditing(false);
    }
    setSelectedKey(apiKey);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedKey(null);
    setFormData(emptyFormData);
  };

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      if (isEditing) {
        await APIKeyService.update(selectedKey.id, formData);
        setSnackbar({ open: true, message: 'API key updated successfully', severity: 'success' });
      } else {
        await APIKeyService.create(formData);
        setSnackbar({ open: true, message: 'API key created successfully', severity: 'success' });
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

  const handleDeleteRequest = (keyId) => {
    logger.log('Attempting to delete API key with ID:', keyId);
    setPendingDeleteId(keyId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteConfirmOpen(false);
    try {
      logger.log('Sending DELETE request for API key:', pendingDeleteId);
      const response = await APIKeyService.delete(pendingDeleteId);
      logger.log('Delete response:', response);
      setSnackbar({ open: true, message: 'API key deleted successfully', severity: 'success' });
      fetchApiKeys();
    } catch (error) {
      logger.error('Failed to delete API key:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to delete API key',
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

  return {
    apiKeys,
    dialogOpen,
    isEditing,
    selectedKey,
    isLoading,
    isSaving,
    snackbar,
    setSnackbar,
    formData,
    providers,
    deleteConfirmOpen,
    handleFormChange,
    handleOpenDialog,
    handleCloseDialog,
    handleSaveApiKey,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
  };
};

export default useAPIKeyManagement;
