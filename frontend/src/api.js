import axios from 'axios';

// The Nginx reverse proxy is set up to forward requests starting with /api
// to the backend service. So we can use a relative URL here.
const client = axios.create({
  baseURL: '/',
});

const api = {
  get: (url, config) => client.get(url, config),
  post: (url, data, config) => client.post(url, data, config),
  put: (url, data, config) => client.put(url, data, config),
  delete: (url, config) => client.delete(url, config),

  // Embedding & worker settings
  embeddingSettings: {
    getConfig: () => client.get('/api/v1/settings/embedding-config'),
    validateModel: (provider, modelName) =>
      client.get('/api/v1/settings/embedding-config/validate-model', {
        params: { provider, model_name: modelName },
      }),
    createConfig: (payload) => client.post('/api/v1/settings/embedding-config', payload),
    updateConfig: (configId, payload) =>
      client.put(`/api/v1/settings/embedding-config/${configId}`, payload),
    activateConfig: (configId) =>
      client.post(`/api/v1/settings/embedding-config/${configId}/activate`),
    deleteConfig: (configId) => client.delete(`/api/v1/settings/embedding-config/${configId}`),
    recomputeAll: () => client.post('/api/v1/settings/embedding-config/recompute'),
    recomputeMeeting: (meetingId) =>
      client.post(`/api/v1/settings/embedding-config/${meetingId}/recompute`),
  },
  workerSettings: {
    get: () => client.get('/api/v1/settings/worker-scaling'),
    update: (maxWorkers) =>
      client.put('/api/v1/settings/worker-scaling', { max_workers: maxWorkers }),
  },
};

export default api;
