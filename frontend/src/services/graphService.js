/**
 * Graph Service - Handles graph API operations.
 * Provides data for meeting relationships visualization.
 */

import apiClient from './apiClient';

const BASE_URL = '/api/v1/graph';

const GraphService = {
  /**
   * Get graph data for visualization
   * @returns {Promise<Object>} Graph data with nodes, edges, and stats
   */
  async getGraphData() {
    const response = await apiClient.get(`${BASE_URL}/data`);
    return response.data;
  },
};

export default GraphService;
