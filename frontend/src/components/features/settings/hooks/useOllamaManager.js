import { useEffect, useState } from 'react';
import { OllamaService } from '../../../../services';
import logger from '../../../../utils/logger';

const useOllamaManager = () => {
  const [status, setStatus] = useState('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [ollamaConfig, setOllamaConfig] = useState({
    model: 'llama3.2',
    port: 11434,
  });

  const checkOllamaStatus = async () => {
    try {
      setIsLoading(true);
      const response = await OllamaService.getStatus();
      setStatus(response.status);
      setError(null);
    } catch (err) {
      logger.error('Failed to check Ollama status:', err);
      setStatus('error');
      setError('Failed to check Ollama status');
    } finally {
      setIsLoading(false);
    }
  };

  const startOllama = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      const response = await OllamaService.start(ollamaConfig);
      setSuccess(response.message || 'Ollama container started successfully!');
      setTimeout(checkOllamaStatus, 3000);
    } catch (err) {
      logger.error('Failed to start Ollama:', err);
      setError(err.response?.data?.detail || 'Failed to start Ollama container');
    } finally {
      setIsLoading(false);
    }
  };

  const stopOllama = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      const response = await OllamaService.stop();
      setSuccess(response.message || 'Ollama container stopped successfully!');
      setTimeout(checkOllamaStatus, 2000);
    } catch (err) {
      logger.error('Failed to stop Ollama:', err);
      setError(err.response?.data?.detail || 'Failed to stop Ollama container');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'warning';
    }
  };

  return {
    status,
    isLoading,
    error,
    setError,
    success,
    setSuccess,
    configDialogOpen,
    setConfigDialogOpen,
    ollamaConfig,
    setOllamaConfig,
    checkOllamaStatus,
    startOllama,
    stopOllama,
    getStatusColor,
  };
};

export default useOllamaManager;
