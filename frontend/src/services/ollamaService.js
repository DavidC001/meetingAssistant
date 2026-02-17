/**
 * Ollama Service - Manages Ollama container lifecycle.
 */

import apiClient from './apiClient';

const BASE_URL = '/api/v1/ollama';

const OllamaService = {
  /**
   * Get current Ollama status.
   * @returns {Promise<Object>} Status response
   */
  async getStatus() {
    const response = await apiClient.get(`${BASE_URL}/status`);
    return response.data;
  },

  /**
   * Start Ollama container with config.
   * @param {Object} config - Ollama configuration
   * @returns {Promise<Object>} Start response
   */
  async start(config) {
    const response = await apiClient.post(`${BASE_URL}/start`, config);
    return response.data;
  },

  /**
   * Stop Ollama container.
   * @returns {Promise<Object>} Stop response
   */
  async stop() {
    const response = await apiClient.post(`${BASE_URL}/stop`);
    return response.data;
  },
};

export default OllamaService;
