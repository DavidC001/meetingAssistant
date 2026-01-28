/**
 * Settings Service - Handles application settings and configurations.
 */

import apiClient from './apiClient';

const BASE_URL = '/api/v1/settings';

/**
 * API Keys management.
 */
export const APIKeyService = {
  /**
   * Get all API keys.
   * @returns {Promise<Array>} List of API keys
   */
  async getAll() {
    const response = await apiClient.get(`${BASE_URL}/api-keys`);
    return response.data;
  },

  /**
   * Create a new API key.
   * @param {Object} keyData - API key data
   * @returns {Promise<Object>} Created API key
   */
  async create(keyData) {
    const response = await apiClient.post(`${BASE_URL}/api-keys`, keyData);
    return response.data;
  },

  /**
   * Update an API key.
   * @param {number} keyId - API key ID
   * @param {Object} keyData - Updated data
   * @returns {Promise<Object>} Updated API key
   */
  async update(keyId, keyData) {
    const response = await apiClient.put(`${BASE_URL}/api-keys/${keyId}`, keyData);
    return response.data;
  },

  /**
   * Delete an API key.
   * @param {number} keyId - API key ID
   * @returns {Promise<void>}
   */
  async delete(keyId) {
    await apiClient.delete(`${BASE_URL}/api-keys/${keyId}`);
  },

  /**
   * Get token configuration status.
   * @returns {Promise<Object>} Token status
   */
  async getTokenStatus() {
    const response = await apiClient.get(`${BASE_URL}/api-tokens`);
    return response.data;
  },

  /**
   * Update API tokens.
   * @param {Object} tokens - Token values
   * @returns {Promise<Object>} Update result
   */
  async updateTokens(tokens) {
    const response = await apiClient.post(`${BASE_URL}/api-tokens`, tokens);
    return response.data;
  },
};

/**
 * Model Configuration management.
 */
export const ModelConfigService = {
  /**
   * Get all model configurations.
   * @returns {Promise<Array>} List of configurations
   */
  async getAll() {
    const response = await apiClient.get(`${BASE_URL}/model-configurations`);
    return response.data;
  },

  /**
   * Get a specific configuration.
   * @param {number} configId - Configuration ID
   * @returns {Promise<Object>} Configuration details
   */
  async getById(configId) {
    const response = await apiClient.get(`${BASE_URL}/model-configurations/${configId}`);
    return response.data;
  },

  /**
   * Create a new configuration.
   * @param {Object} config - Configuration data
   * @returns {Promise<Object>} Created configuration
   */
  async create(config) {
    const response = await apiClient.post(`${BASE_URL}/model-configurations`, config);
    return response.data;
  },

  /**
   * Update a configuration.
   * @param {number} configId - Configuration ID
   * @param {Object} config - Updated data
   * @returns {Promise<Object>} Updated configuration
   */
  async update(configId, config) {
    const response = await apiClient.put(`${BASE_URL}/model-configurations/${configId}`, config);
    return response.data;
  },

  /**
   * Delete a configuration.
   * @param {number} configId - Configuration ID
   * @returns {Promise<void>}
   */
  async delete(configId) {
    await apiClient.delete(`${BASE_URL}/model-configurations/${configId}`);
  },

  /**
   * Set a configuration as default.
   * @param {number} configId - Configuration ID
   * @returns {Promise<Object>} Updated configuration
   */
  async setDefault(configId) {
    const response = await apiClient.post(
      `${BASE_URL}/model-configurations/${configId}/set-default`
    );
    return response.data;
  },
};

/**
 * Embedding Configuration management.
 */
export const EmbeddingConfigService = {
  /**
   * Get active embedding configuration.
   * @returns {Promise<Object>} Active configuration
   */
  async getActive() {
    const response = await apiClient.get(`${BASE_URL}/embedding-config`);
    return response.data;
  },

  /**
   * Validate an embedding model.
   * @param {string} provider - Provider name
   * @param {string} modelName - Model name
   * @returns {Promise<Object>} Validation result
   */
  async validateModel(provider, modelName) {
    const response = await apiClient.get(`${BASE_URL}/embedding-config/validate-model`, {
      params: { provider, model_name: modelName },
    });
    return response.data;
  },

  /**
   * Create a new embedding configuration.
   * @param {Object} config - Configuration data
   * @returns {Promise<Object>} Created configuration
   */
  async create(config) {
    const response = await apiClient.post(`${BASE_URL}/embedding-config`, config);
    return response.data;
  },

  /**
   * Update an embedding configuration.
   * @param {number} configId - Configuration ID
   * @param {Object} config - Updated data
   * @returns {Promise<Object>} Updated configuration
   */
  async update(configId, config) {
    const response = await apiClient.put(`${BASE_URL}/embedding-config/${configId}`, config);
    return response.data;
  },

  /**
   * Delete an embedding configuration.
   * @param {number} configId - Configuration ID
   * @returns {Promise<void>}
   */
  async delete(configId) {
    await apiClient.delete(`${BASE_URL}/embedding-config/${configId}`);
  },

  /**
   * Activate an embedding configuration.
   * @param {number} configId - Configuration ID
   * @returns {Promise<Object>} Activation result
   */
  async activate(configId) {
    const response = await apiClient.post(`${BASE_URL}/embedding-config/${configId}/activate`);
    return response.data;
  },

  /**
   * Recompute embeddings for all meetings.
   * @returns {Promise<Object>} Task info
   */
  async recomputeAll() {
    const response = await apiClient.post(`${BASE_URL}/embedding-config/recompute`);
    return response.data;
  },

  /**
   * Recompute embeddings for a specific meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Object>} Task info
   */
  async recomputeMeeting(meetingId) {
    const response = await apiClient.post(`${BASE_URL}/embedding-config/${meetingId}/recompute`);
    return response.data;
  },
};

/**
 * Worker Configuration management.
 */
export const WorkerConfigService = {
  /**
   * Get current worker configuration.
   * @returns {Promise<Object>} Worker config
   */
  async get() {
    const response = await apiClient.get(`${BASE_URL}/worker-scaling`);
    return response.data;
  },

  /**
   * Update worker configuration.
   * @param {number} maxWorkers - Maximum workers
   * @returns {Promise<Object>} Updated config
   */
  async update(maxWorkers) {
    const response = await apiClient.put(`${BASE_URL}/worker-scaling`, { max_workers: maxWorkers });
    return response.data;
  },
};

/**
 * App Settings management.
 */
export const AppSettingsService = {
  /**
   * Get application settings.
   * @returns {Promise<Object>} App settings
   */
  async get() {
    const response = await apiClient.get(`${BASE_URL}/app-settings`);
    return response.data;
  },

  /**
   * Update application settings.
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Update result
   */
  async update(settings) {
    const response = await apiClient.post(`${BASE_URL}/app-settings`, settings);
    return response.data;
  },
};

// Export all services
export default {
  apiKeys: APIKeyService,
  modelConfig: ModelConfigService,
  embeddingConfig: EmbeddingConfigService,
  workerConfig: WorkerConfigService,
  appSettings: AppSettingsService,
};
