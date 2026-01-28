/**
 * Diary Service
 *
 * Provides API methods for managing daily work diary entries and reminders.
 */

import apiClient from './apiClient';

const diaryService = {
  /**
   * List diary entries with optional date range filter and pagination
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (YYYY-MM-DD)
   * @param {string} params.endDate - End date (YYYY-MM-DD)
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 50)
   * @returns {Promise<Object>} - { entries, total, page, page_size }
   */
  getEntries: async ({ startDate, endDate, page = 1, pageSize = 50 } = {}) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    params.append('page', page);
    params.append('page_size', pageSize);

    const response = await apiClient.get(`/api/v1/diary/entries?${params}`);
    return response.data;
  },

  /**
   * Get diary entry for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {boolean} includeActionItems - Include action items summary (default: true)
   * @returns {Promise<Object>} - Diary entry with optional action items summary
   */
  getEntry: async (date, includeActionItems = true) => {
    const params = new URLSearchParams();
    params.append('include_action_items', includeActionItems);

    const response = await apiClient.get(`/api/v1/diary/entries/${date}?${params}`);
    return response.data;
  },

  /**
   * Get diary template for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<string>} - Template content
   */
  getTemplate: async (date) => {
    const response = await apiClient.get(`/api/v1/diary/template/${date}`);
    return response.data.template;
  },

  /**
   * Create a new diary entry
   * @param {Object} entryData - Diary entry data
   * @param {string} entryData.date - Date in YYYY-MM-DD format
   * @param {string} entryData.content - Markdown content
   * @param {string} entryData.mood - Mood (e.g., "productive", "challenging")
   * @param {Array<string>} entryData.highlights - Key accomplishments
   * @param {Array<string>} entryData.blockers - Blockers/challenges
   * @param {boolean} autoGenerate - Auto-generate content from action items
   * @returns {Promise<Object>} - Created diary entry
   */
  createEntry: async (entryData, autoGenerate = false) => {
    const params = new URLSearchParams();
    params.append('auto_generate', autoGenerate);

    const response = await apiClient.post(`/api/v1/diary/entries?${params}`, entryData);
    return response.data;
  },

  /**
   * Update an existing diary entry
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} - Updated diary entry
   */
  updateEntry: async (date, updateData) => {
    const response = await apiClient.put(`/api/v1/diary/entries/${date}`, updateData);
    return response.data;
  },

  /**
   * Delete a diary entry
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<void>}
   */
  deleteEntry: async (date) => {
    await apiClient.delete(`/api/v1/diary/entries/${date}`);
  },

  /**
   * Check if a diary reminder should be shown
   * @returns {Promise<Object>} - Reminder response with action items summary
   */
  checkReminder: async () => {
    const response = await apiClient.get('/api/v1/diary/reminder');
    return response.data;
  },

  /**
   * Dismiss reminder for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<void>}
   */
  dismissReminder: async (date) => {
    await apiClient.post('/api/v1/diary/reminder/dismiss', { date });
  },

  /**
   * Get action items summary for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Action items summary
   */
  getActionItemsSummary: async (date) => {
    const response = await apiClient.get(`/api/v1/diary/entries/${date}/action-items-summary`);
    return response.data;
  },

  /**
   * Take snapshot of action items for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} - Snapshot creation result
   */
  snapshotActionItems: async (date) => {
    const response = await apiClient.post(`/api/v1/diary/entries/${date}/snapshot-action-items`);
    return response.data;
  },
};

export default diaryService;
