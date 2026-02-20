import { useState, useEffect } from 'react';
import { WorkerConfigService } from '../../../../services';
import logger from '../../../../utils/logger';

const useWorkerConfig = (showSnackbar) => {
  const [workerConfig, setWorkerConfig] = useState({ max_workers: 1 });
  const [workerSaving, setWorkerSaving] = useState(false);

  useEffect(() => {
    fetchWorkerConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWorkerConfig = async () => {
    try {
      const response = await WorkerConfigService.get();
      setWorkerConfig(response || { max_workers: 1 });
    } catch (error) {
      logger.error('Failed to load worker configuration', error);
    }
  };

  const handleWorkerSave = async () => {
    setWorkerSaving(true);
    try {
      await WorkerConfigService.update(workerConfig.max_workers);
      showSnackbar('Worker configuration updated', 'success');
      fetchWorkerConfig();
    } catch (error) {
      logger.error('Failed to update worker configuration', error);
      showSnackbar('Failed to update worker configuration', 'error');
    } finally {
      setWorkerSaving(false);
    }
  };

  return {
    workerConfig,
    setWorkerConfig,
    workerSaving,
    handleWorkerSave,
  };
};

export default useWorkerConfig;
