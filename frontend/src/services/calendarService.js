/**
 * Calendar Service - Handles calendar API operations.
 * Wraps Google Calendar integration and action item syncing.
 */

import apiClient from './apiClient';

const BASE_URL = '/api/v1/calendar';
const ACTION_ITEMS_URL = '/api/v1/meetings/action-items';

const CalendarService = {
  /**
   * Get Google Calendar authentication status
   * @returns {Promise<Object>} Status object with isConnected flag
   */
  async getGoogleStatus() {
    const response = await apiClient.get(`${BASE_URL}/google/status`);
    return response.data;
  },

  /**
   * Get Google Calendar authentication URL
   * @returns {Promise<Object>} Object with auth-url
   */
  async getGoogleAuthUrl() {
    const response = await apiClient.get(`${BASE_URL}/google/auth-url`);
    return response.data;
  },

  /**
   * Authorize Google Calendar with auth code
   * @param {string} code - Authorization code from Google
   * @returns {Promise<Object>} Authorization response
   */
  async authorizeGoogle(code) {
    const response = await apiClient.post(`${BASE_URL}/google/authorize`, { code });
    return response.data;
  },

  /**
   * Disconnect Google Calendar
   * @returns {Promise<void>}
   */
  async disconnectGoogle() {
    const response = await apiClient.post(`${BASE_URL}/google/disconnect`);
    return response.data;
  },

  /**
   * Get all action items from calendar
   * @returns {Promise<Array>} List of action items
   */
  async getActionItems() {
    const response = await apiClient.get(`${BASE_URL}/action-items`);
    return response.data;
  },

  /**
   * Create action item in calendar
   * @param {Object} data - Action item data
   * @returns {Promise<Object>} Created action item
   */
  async createActionItem(data) {
    const response = await apiClient.post(`${BASE_URL}/action-items`, data);
    return response.data;
  },

  /**
   * Update action item in calendar
   * @param {number} itemId - Action item ID
   * @param {Object} data - Updated action item data
   * @returns {Promise<Object>} Updated action item
   */
  async updateActionItem(itemId, data) {
    const response = await apiClient.put(`${BASE_URL}/action-items/${itemId}`, data);
    return response.data;
  },

  /**
   * Delete action item from calendar
   * @param {number} itemId - Action item ID
   * @returns {Promise<void>}
   */
  async deleteActionItem(itemId) {
    const response = await apiClient.delete(`${ACTION_ITEMS_URL}/${itemId}`);
    return response.data;
  },

  /**
   * Sync action item with Google Calendar
   * @param {number} itemId - Action item ID
   * @returns {Promise<Object>} Sync response
   */
  async syncActionItemToGoogle(itemId) {
    const response = await apiClient.post(`${BASE_URL}/action-items/${itemId}/sync`);
    return response.data;
  },

  /**
   * Remove action item from Google Calendar sync
   * @param {number} itemId - Action item ID
   * @returns {Promise<void>}
   */
  async unsyncActionItemFromGoogle(itemId) {
    const response = await apiClient.delete(`${BASE_URL}/action-items/${itemId}/sync`);
    return response.data;
  },

  /**
   * Sync all pending action items with Google Calendar
   * @returns {Promise<Object>} Sync response
   */
  async syncAllPending() {
    const response = await apiClient.post(`${BASE_URL}/sync-all?status=pending`);
    return response.data;
  },
};

export default CalendarService;
