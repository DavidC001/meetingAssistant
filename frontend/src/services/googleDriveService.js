/**
 * Google Drive Service - Manages Google Drive integration.
 */

import apiClient from './apiClient';

const BASE_URL = '/api/v1/google-drive';

const GoogleDriveService = {
  /**
   * Get current Google Drive sync status.
   * @returns {Promise<Object>} Status response
   */
  async getStatus() {
    const response = await apiClient.get(`${BASE_URL}/status`);
    return response.data;
  },

  /**
   * Start OAuth authorization flow.
   * @returns {Promise<Object>} Authorization response
   */
  async authorize() {
    const response = await apiClient.get(`${BASE_URL}/auth`);
    return response.data;
  },

  /**
   * Complete OAuth authorization callback.
   * @param {Object} params - Callback query params
   * @returns {Promise<Object>} Callback response
   */
  async completeAuthorization(params) {
    const response = await apiClient.get(`${BASE_URL}/callback`, { params });
    return response.data;
  },

  /**
   * Disconnect Google Drive integration.
   * @returns {Promise<Object>} Disconnect response
   */
  async disconnect() {
    const response = await apiClient.post(`${BASE_URL}/disconnect`);
    return response.data;
  },

  /**
   * Trigger a manual sync.
   * @returns {Promise<Object>} Sync response
   */
  async syncNow() {
    const response = await apiClient.post(`${BASE_URL}/sync`);
    return response.data;
  },

  /**
   * Fetch recently processed files.
   * @param {number} limit - Max results
   * @returns {Promise<Object>} Processed files response
   */
  async getProcessedFiles(limit = 10) {
    const response = await apiClient.get(`${BASE_URL}/processed-files`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Update Google Drive configuration.
   * @param {Object} config - Configuration payload
   * @returns {Promise<Object>} Updated config
   */
  async updateConfig(config) {
    const response = await apiClient.post(`${BASE_URL}/config`, config);
    return response.data;
  },
};

export default GoogleDriveService;
