/**
 * Search Service - Handles global search operations.
 */

import apiClient from './apiClient';

const BASE_URL = '/api/v1/search';

const SearchService = {
  /**
   * Perform a global search across meetings.
   * @param {string} query - Search text
   * @param {Object} options - Search options
   * @param {Array<string>} options.searchIn - Content types to search in
   * @param {number} options.limit - Maximum results
   * @param {string} options.folder - Optional folder filter
   * @param {string} options.dateFrom - Optional ISO date from filter
   * @param {string} options.dateTo - Optional ISO date to filter
   * @param {Array<string>} options.tags - Optional tag filters
   * @returns {Promise<Object>} Search response
   */
  async search(query, options = {}) {
    const {
      searchIn = ['transcripts', 'summaries', 'action_items', 'notes'],
      limit = 20,
      folder,
      dateFrom,
      dateTo,
      tags,
    } = options;

    const payload = {
      query,
      search_in: searchIn,
      limit,
      folder,
      date_from: dateFrom,
      date_to: dateTo,
      tags,
    };

    const response = await apiClient.post(`${BASE_URL}/`, payload);
    return response.data;
  },
};

export default SearchService;
