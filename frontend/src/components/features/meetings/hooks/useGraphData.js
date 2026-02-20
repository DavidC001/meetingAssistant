/**
 * useGraphData Hook
 * Fetches and normalizes meetings graph data from the API.
 */

import { useState, useEffect, useCallback } from 'react';
import { GraphService } from '../../../../services';
import logger from '../../../../utils/logger';

export const useGraphData = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GraphService.getGraphData();
      const links = data.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
      }));
      setGraphData({ nodes: data.nodes, links });
      setStats(data.stats);
    } catch (err) {
      logger.error('Error fetching graph data:', err);
      setError(err.response?.data?.detail || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  return { graphData, stats, loading, error, refresh: fetchGraphData };
};
