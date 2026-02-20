/**
 * MeetingsGraphContainer
 * Orchestrates the meetings relationship graph: data via useGraphData,
 * interaction state (selection, highlight, hover, filters, zoom) managed here.
 * Raw axios removed — all API calls go through GraphService via useGraphData.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Grid } from '@mui/material';
import ForceGraph2D from 'react-force-graph-2d';
import { useGraphData } from '../hooks';
import { GraphStatsCards, GraphToolbar, GraphNodeDetail, GraphLegend } from '../presentation';

const getNodeColor = (node) => {
  switch (node.type) {
    case 'meeting':
      return '#1976d2';
    case 'person':
      return '#f50057';
    case 'folder':
      return '#ff9800';
    case 'tag':
      return '#4caf50';
    default:
      return '#999';
  }
};

const getNodeSize = (node) => {
  switch (node.type) {
    case 'meeting':
      return 8;
    case 'person':
      return 6;
    case 'folder':
      return 7;
    case 'tag':
      return 5;
    default:
      return 5;
  }
};

const MeetingsGraphContainer = () => {
  const { graphData, stats, loading, error, refresh } = useGraphData();

  // Interaction state
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  const [visibleTypes, setVisibleTypes] = useState(['meeting', 'person', 'folder', 'tag']);
  const [showLabels, setShowLabels] = useState(true);
  const [hiddenNodes, setHiddenNodes] = useState(new Set());
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const graphRef = useRef();
  const containerRef = useRef();
  const clickTimeRef = useRef(0);
  const clickNodeRef = useRef(null);

  const handleStopSimulation = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.pauseAnimation();
      setIsSimulationRunning(false);
    }
  }, []);

  const handleResumeSimulation = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.resumeAnimation();
      graphRef.current.d3ReheatSimulation();
      setIsSimulationRunning(true);
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.pauseAnimation();
          setIsSimulationRunning(false);
        }
      }, 3000);
    }
  }, []);

  const handleEngineStop = useCallback(() => {
    if (graphRef.current && isSimulationRunning) {
      graphRef.current.pauseAnimation();
      setIsSimulationRunning(false);
    }
  }, [isSimulationRunning]);

  const handleNodeClick = useCallback(
    (node) => {
      if (isDragging) {
        setIsDragging(false);
        return;
      }

      const now = Date.now();
      const isDoubleClick = clickNodeRef.current === node.id && now - clickTimeRef.current < 300;

      if (isDoubleClick) {
        if (node.type === 'meeting' && node.data?.id) {
          window.location.href = `/meetings/${node.data.id}`;
        }
        clickTimeRef.current = 0;
        clickNodeRef.current = null;
        return;
      }

      clickTimeRef.current = now;
      clickNodeRef.current = node.id;
      setSelectedNode(node);

      const connectedNodes = new Set([node.id]);
      const connectedLinks = new Set();

      graphData.links.forEach((link) => {
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        if (srcId === node.id) {
          connectedLinks.add(link);
          connectedNodes.add(tgtId);
        }
        if (tgtId === node.id) {
          connectedLinks.add(link);
          connectedNodes.add(srcId);
        }
      });

      setHighlightNodes(connectedNodes);
      setHighlightLinks(connectedLinks);
    },
    [graphData.links, isDragging]
  );

  const handleNodeDrag = useCallback(() => setIsDragging(true), []);
  const handleNodeDragEnd = useCallback((node) => {
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
    setTimeout(() => setIsDragging(false), 100);
  }, []);

  const handleOpenMeeting = useCallback(() => {
    if (selectedNode?.type === 'meeting' && selectedNode.data?.id) {
      window.location.href = `/meetings/${selectedNode.data.id}`;
    }
  }, [selectedNode]);

  const handleHideNode = useCallback(() => {
    if (selectedNode) {
      setHiddenNodes((prev) => new Set([...prev, selectedNode.id]));
      setSelectedNode(null);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  }, [selectedNode]);

  const handleShowAllNodes = useCallback(() => setHiddenNodes(new Set()), []);
  const handleNodeHover = useCallback((node) => setHoverNode(node), []);
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      const fontSize = 12 / globalScale;
      const nodeSize = getNodeSize(node);
      ctx.fillStyle = getNodeColor(node);
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
      ctx.fill();
      const isHighlighted = highlightNodes.has(node.id);
      if (isHighlighted) {
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }
      if (showLabels || isHighlighted || node === hoverNode) {
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText(node.label, node.x, node.y + nodeSize + fontSize);
      }
    },
    [highlightNodes, hoverNode, showLabels]
  );

  const paintLink = useCallback(
    (link, ctx, globalScale) => {
      const isHighlighted = highlightLinks.has(link);
      ctx.strokeStyle = isHighlighted ? '#ffeb3b' : '#999';
      ctx.lineWidth = isHighlighted ? 2 / globalScale : 1 / globalScale;
      if (link.type === 'references') {
        ctx.setLineDash([5 / globalScale, 5 / globalScale]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      const startX = typeof link.source === 'object' ? link.source.x : link.source;
      const startY = typeof link.source === 'object' ? link.source.y : link.source;
      const endX = typeof link.target === 'object' ? link.target.x : link.target;
      const endY = typeof link.target === 'object' ? link.target.y : link.target;
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    [highlightLinks]
  );

  const handleZoomIn = () => {
    if (graphRef.current) graphRef.current.zoom(graphRef.current.zoom() * 1.2, 500);
  };
  const handleZoomOut = () => {
    if (graphRef.current) graphRef.current.zoom(graphRef.current.zoom() / 1.2, 500);
  };
  const handleCenter = () => {
    if (graphRef.current) graphRef.current.zoomToFit(500, 50);
  };
  const handleTypeToggle = (event, newTypes) => {
    if (newTypes.length > 0) setVisibleTypes(newTypes);
  };

  const filteredData = useMemo(
    () => ({
      nodes: graphData.nodes.filter((n) => visibleTypes.includes(n.type) && !hiddenNodes.has(n.id)),
      links: graphData.links.filter((link) => {
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        return (
          graphData.nodes.some(
            (n) => n.id === srcId && visibleTypes.includes(n.type) && !hiddenNodes.has(n.id)
          ) &&
          graphData.nodes.some(
            (n) => n.id === tgtId && visibleTypes.includes(n.type) && !hiddenNodes.has(n.id)
          )
        );
      }),
    }),
    [graphData, visibleTypes, hiddenNodes]
  );

  // Zoom to fit when node count changes
  React.useEffect(() => {
    if (graphRef.current && filteredData.nodes.length > 0) {
      setIsSimulationRunning(true);
      filteredData.nodes.forEach((node) => {
        node.fx = undefined;
        node.fy = undefined;
      });
      setTimeout(() => {
        if (graphRef.current) graphRef.current.zoomToFit(400, 60);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData.nodes.length]);

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Meetings Graph
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Visualize relationships between meetings, people, folders, and tags
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        💡 <strong>Tips:</strong> Scroll to zoom. Drag background to pan. Click nodes to see
        details. <strong>Double-click meetings</strong> to open them. Drag nodes to reposition (they
        stay fixed). Use the freeze button to stop all movement.
      </Alert>

      <GraphStatsCards stats={stats} />

      <GraphToolbar
        visibleTypes={visibleTypes}
        onTypeToggle={handleTypeToggle}
        showLabels={showLabels}
        onShowLabelsChange={setShowLabels}
        hiddenCount={hiddenNodes.size}
        onShowAllNodes={handleShowAllNodes}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenter={handleCenter}
        onRefresh={refresh}
        isSimulationRunning={isSimulationRunning}
        onStopSimulation={handleStopSimulation}
        onResumeSimulation={handleResumeSimulation}
      />

      {/* Graph + Side Panel */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={selectedNode ? 8 : 12}>
          <Paper
            sx={{
              position: 'relative',
              height: '70vh',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e0e0e0',
            }}
          >
            <Box
              ref={containerRef}
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                '& canvas': { display: 'block', outline: 'none' },
              }}
            >
              <ForceGraph2D
                ref={graphRef}
                graphData={filteredData}
                nodeLabel="label"
                nodeAutoColorBy="type"
                nodeCanvasObject={paintNode}
                linkCanvasObject={paintLink}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onNodeDrag={handleNodeDrag}
                onNodeDragEnd={handleNodeDragEnd}
                onBackgroundClick={handleBackgroundClick}
                onEngineStop={handleEngineStop}
                cooldownTicks={50}
                warmupTicks={50}
                cooldownTime={2000}
                enableNodeDrag
                enableZoomInteraction
                enablePanInteraction
                minZoom={0.5}
                maxZoom={8}
                d3AlphaDecay={0.1}
                d3VelocityDecay={0.6}
                d3AlphaMin={0.001}
                width={containerRef.current?.offsetWidth}
                height={containerRef.current?.offsetHeight}
              />
            </Box>
          </Paper>
        </Grid>

        {selectedNode && (
          <Grid item xs={12} md={4}>
            <GraphNodeDetail
              node={selectedNode}
              connectedCount={highlightNodes.size - 1}
              onOpenMeeting={handleOpenMeeting}
              onHideNode={handleHideNode}
            />
          </Grid>
        )}
      </Grid>

      <GraphLegend />
    </Box>
  );
};

export default MeetingsGraphContainer;
