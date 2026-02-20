import { useState, useEffect } from 'react';
import { EmbeddingConfigService } from '../../../../services';
import logger from '../../../../utils/logger';

const useEmbeddingConfig = (showSnackbar) => {
  const [embeddingConfigs, setEmbeddingConfigs] = useState([]);
  const [activeEmbeddingId, setActiveEmbeddingId] = useState(null);
  const [embeddingForm, setEmbeddingForm] = useState({
    provider: 'sentence-transformers',
    model_name: 'sentence-transformers/all-MiniLM-L6-v2',
    dimension: 384,
    base_url: '',
    settings: '',
    is_active: false,
  });
  const [modelValidation, setModelValidation] = useState({ status: 'idle', message: '' });
  const [embeddingLoading, setEmbeddingLoading] = useState(false);

  useEffect(() => {
    fetchEmbeddingConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEmbeddingConfig = async () => {
    setEmbeddingLoading(true);
    try {
      const response = await EmbeddingConfigService.getConfig();
      setEmbeddingConfigs(response.configurations || []);
      setActiveEmbeddingId(response.activeConfigurationId || null);
    } catch (error) {
      logger.error('Failed to load embedding configuration', error);
      showSnackbar('Failed to load embedding configuration', 'warning');
    } finally {
      setEmbeddingLoading(false);
    }
  };

  const handleEmbeddingFormChange = (key, value) => {
    setModelValidation({ status: 'idle', message: '' });
    setEmbeddingForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'provider') {
        if (value === 'sentence-transformers') {
          updated.dimension = 384;
          updated.base_url = '';
          updated.model_name = 'sentence-transformers/all-MiniLM-L6-v2';
        } else if (value === 'openai') {
          updated.dimension = 1536;
          updated.base_url = '';
          updated.model_name = 'text-embedding-3-small';
        } else if (value === 'ollama') {
          updated.dimension = 768;
          updated.model_name = 'nomic-embed-text';
        }
      }
      return updated;
    });
  };

  const handleCreateEmbeddingConfig = async () => {
    try {
      const payload = {
        provider: embeddingForm.provider,
        model_name: embeddingForm.model_name,
        dimension: Number(embeddingForm.dimension),
        base_url: embeddingForm.base_url || undefined,
        is_active: embeddingForm.is_active,
      };
      if (embeddingForm.settings) {
        try {
          payload.settings = JSON.parse(embeddingForm.settings);
        } catch {
          showSnackbar('Settings must be valid JSON', 'error');
          return;
        }
      }
      await EmbeddingConfigService.create(payload);
      showSnackbar('Embedding configuration saved', 'success');
      setEmbeddingForm((prev) => ({ ...prev, is_active: false }));
      fetchEmbeddingConfig();
    } catch (error) {
      logger.error('Failed to create embedding configuration', error);
      showSnackbar(
        error.response?.data?.detail || 'Failed to create embedding configuration',
        'error'
      );
    }
  };

  const handleValidateModel = async () => {
    if (!embeddingForm.model_name) {
      setModelValidation({ status: 'invalid', message: 'Model name is required.' });
      return;
    }
    setModelValidation({ status: 'checking', message: 'Validating model...' });
    try {
      const response = await EmbeddingConfigService.validateModel(
        embeddingForm.provider,
        embeddingForm.model_name
      );
      const { valid, message, dimension } = response || {};
      if (valid) {
        setModelValidation({ status: 'valid', message: message || 'Model is available.' });
        if (dimension && embeddingForm.provider === 'sentence-transformers') {
          setEmbeddingForm((prev) => ({ ...prev, dimension }));
          showSnackbar(`Model validated! Auto-detected dimension: ${dimension}`, 'success');
        }
      } else {
        setModelValidation({
          status: 'invalid',
          message: message || 'Model could not be validated.',
        });
      }
    } catch (error) {
      logger.error('Failed to validate model', error);
      setModelValidation({
        status: 'invalid',
        message: error.response?.data?.detail || 'Failed to validate model',
      });
    }
  };

  const handleActivateEmbeddingConfig = async (configId) => {
    try {
      await EmbeddingConfigService.activate(configId);
      showSnackbar('Embedding configuration activated', 'success');
      fetchEmbeddingConfig();
    } catch (error) {
      logger.error('Failed to activate configuration', error);
      showSnackbar('Failed to activate configuration', 'error');
    }
  };

  const handleDeleteEmbeddingConfig = async (configId) => {
    try {
      await EmbeddingConfigService.delete(configId);
      showSnackbar('Embedding configuration removed', 'success');
      fetchEmbeddingConfig();
    } catch (error) {
      logger.error('Failed to delete configuration', error);
      showSnackbar('Failed to delete configuration', 'error');
    }
  };

  const handleRecomputeEmbeddings = async (setRecomputeLoading) => {
    setRecomputeLoading(true);
    try {
      await EmbeddingConfigService.recomputeAll();
      showSnackbar('Embedding recomputation triggered', 'info');
    } catch (error) {
      logger.error('Failed to trigger recompute', error);
      showSnackbar('Failed to trigger recompute', 'error');
    } finally {
      setRecomputeLoading(false);
    }
  };

  return {
    embeddingConfigs,
    activeEmbeddingId,
    embeddingForm,
    modelValidation,
    embeddingLoading,
    handleEmbeddingFormChange,
    handleCreateEmbeddingConfig,
    handleValidateModel,
    handleActivateEmbeddingConfig,
    handleDeleteEmbeddingConfig,
    handleRecomputeEmbeddings,
  };
};

export default useEmbeddingConfig;
