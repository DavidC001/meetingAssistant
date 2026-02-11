/**
 * Action Item Service - Handles action item API operations.
 */

import apiClient from './apiClient';

const BASE_URL = '/api/v1/meetings';

const ActionItemService = {
  /**
   * Get all action items with optional filters.
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status
   * @param {number} options.skip - Pagination offset
   * @param {number} options.limit - Maximum items
   * @returns {Promise<Array>} List of action items
   */
  async getAll({ status = null, skip = 0, limit = 1000 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('skip', skip);
    params.append('limit', limit);

    const response = await apiClient.get(`${BASE_URL}/action-items?${params.toString()}`);
    return response.data;
  },

  /**
   * Add an action item to a transcription.
   * @param {number} transcriptionId - Transcription ID
   * @param {Object} actionItem - Action item data
   * @returns {Promise<Object>} Created action item
   */
  async add(transcriptionId, actionItem) {
    const response = await apiClient.post(
      `${BASE_URL}/transcriptions/${transcriptionId}/action-items`,
      actionItem
    );
    return response.data;
  },

  /**
   * Update an action item.
   * @param {number} itemId - Action item ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated action item
   */
  async update(itemId, updates) {
    const response = await apiClient.put(`${BASE_URL}/action-items/${itemId}`, updates);
    return response.data;
  },

  /**
   * Delete an action item.
   * @param {number} itemId - Action item ID
   * @returns {Promise<void>}
   */
  async delete(itemId) {
    await apiClient.delete(`${BASE_URL}/action-items/${itemId}`);
  },

  /**
   * Sync action item to Google Calendar.
   * @param {number} itemId - Action item ID
   * @returns {Promise<Object>} Updated action item
   */
  async syncToCalendar(itemId) {
    const response = await apiClient.post(`${BASE_URL}/action-items/${itemId}/sync-calendar`);
    return response.data;
  },

  /**
   * Link an action item to a project.
   * @param {number} projectId - Project ID
   * @param {number} actionItemId - Action item ID
   * @returns {Promise<Object>} Link result
   */
  async linkToProject(projectId, actionItemId) {
    const response = await apiClient.post(
      `/api/v1/projects/${projectId}/action-items/${actionItemId}`
    );
    return response.data;
  },

  /**
   * Unlink an action item from a project.
   * @param {number} projectId - Project ID
   * @param {number} actionItemId - Action item ID
   * @returns {Promise<void>}
   */
  async unlinkFromProject(projectId, actionItemId) {
    await apiClient.delete(`/api/v1/projects/${projectId}/action-items/${actionItemId}`);
  },
};

export default ActionItemService;
