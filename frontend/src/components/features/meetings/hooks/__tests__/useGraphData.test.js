/**
 * Unit tests for useGraphData's data-shape mapping.
 *
 * react-force-graph-2d's <ForceGraph2D> expects a `graphData` prop shaped as
 * { nodes, links } — but the backend payload uses { nodes, edges }. If this
 * hook stops renaming edges -> links (or drops the mapping), the graph view
 * silently renders nothing: ForceGraph2D treats a missing `links` array as
 * empty and draws zero connections/nodes positioning without error.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useGraphData } from '../useGraphData';
import { GraphService } from '../../../../../services';

jest.mock('../../../../../services', () => ({
  GraphService: {
    getGraphData: jest.fn(),
  },
}));

jest.mock('../../../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useGraphData', () => {
  test('maps backend edges to the {nodes, links} shape ForceGraph2D expects', async () => {
    GraphService.getGraphData.mockResolvedValue({
      nodes: [
        { id: 'meeting-1', type: 'meeting', label: 'Meeting 1' },
        { id: 'person-1', type: 'person', label: 'Alice' },
      ],
      edges: [{ source: 'meeting-1', target: 'person-1', type: 'has_participant' }],
      stats: { meetings: 1, people: 1, folders: 0, tags: 0, relationships: 1 },
    });

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.graphData.nodes).toHaveLength(2);
    expect(result.current.graphData.links).toEqual([
      { source: 'meeting-1', target: 'person-1', type: 'has_participant' },
    ]);
    // No stray `edges` key should leak through to the graph-renderer shape.
    expect(result.current.graphData.edges).toBeUndefined();
    expect(result.current.stats).toEqual({
      meetings: 1,
      people: 1,
      folders: 0,
      tags: 0,
      relationships: 1,
    });
  });

  test('returns an empty graph without erroring when there is no data', async () => {
    GraphService.getGraphData.mockResolvedValue({
      nodes: [],
      edges: [],
      stats: { meetings: 0, people: 0, folders: 0, tags: 0, relationships: 0 },
    });

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.graphData).toEqual({ nodes: [], links: [] });
  });

  test('surfaces the backend error message and stops loading on failure', async () => {
    GraphService.getGraphData.mockRejectedValue({
      response: { data: { detail: 'Database unavailable' } },
    });

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Database unavailable');
    expect(result.current.graphData).toEqual({ nodes: [], links: [] });
  });
});
