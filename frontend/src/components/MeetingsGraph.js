import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  Button,
} from '@mui/material';
import {
  People as PeopleIcon,
  Folder as FolderIcon,
  LocalOffer as TagIcon,
  Event as MeetingIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Refresh as RefreshIcon,
  VisibilityOff as HideIcon,
  Visibility as ShowIcon,
  OpenInNew as OpenIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from '@mui/icons-material';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const MeetingsGraph = () => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Removed custom wheel handler to fix scrolling issues
  // useEffect(() => {
  //   const container = containerRef.current;
  //   if (!container) return;

  //   const handleWheel = (e) => {
  //     // Only allow zoom if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
  //     if (!e.ctrlKey && !e.metaKey) {
  //       e.preventDefault();
  //       e.stopPropagation();
  //     }
  //   };

  //   container.addEventListener('wheel', handleWheel, { passive: false });
  //   return () => {
  //     container.removeEventListener('wheel', handleWheel);
  //   };
  // }, []);

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/graph/data`);
      const data = response.data;
      
      // Transform edges to links for react-force-graph
      const links = data.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
      }));
      
      setGraphData({ nodes: data.nodes, links });
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setError(err.response?.data?.detail || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const handleStopSimulation = useCallback(() => {
    if (graphRef.current) {
      // Pause the simulation completely
      graphRef.current.pauseAnimation();
      setIsSimulationRunning(false);
    }
  }, []);

  const handleResumeSimulation = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.resumeAnimation();
      // Reheat the simulation briefly to allow repositioning
      graphRef.current.d3ReheatSimulation();
      setIsSimulationRunning(true);
      // Auto-stop after settling
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.pauseAnimation();
          setIsSimulationRunning(false);
        }
      }, 3000);
    }
  }, []);

  // Stop simulation after initial layout is complete
  const handleEngineStop = useCallback(() => {
    // Simulation has settled, pause to prevent unwanted movement
    if (graphRef.current && isSimulationRunning) {
      graphRef.current.pauseAnimation();
      setIsSimulationRunning(false);
    }
  }, [isSimulationRunning]);

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

  const handleNodeClick = useCallback((node, event) => {
    // Ignore if this was a drag operation
    if (isDragging) {
      setIsDragging(false);
      return;
    }

    const now = Date.now();
    const isDoubleClick = clickNodeRef.current === node.id && (now - clickTimeRef.current) < 300;
    
    if (isDoubleClick) {
      // Double-click: navigate to meeting
      if (node.type === 'meeting' && node.data && node.data.id) {
        window.location.href = `/meetings/${node.data.id}`;
      }
      clickTimeRef.current = 0;
      clickNodeRef.current = null;
      return;
    }
    
    // Single click: select node and highlight connections
    clickTimeRef.current = now;
    clickNodeRef.current = node.id;
    
    setSelectedNode(node);
    
    // Highlight connected nodes and links
    const connectedNodes = new Set();
    const connectedLinks = new Set();
    
    connectedNodes.add(node.id);
    
    graphData.links.forEach(link => {
      if (link.source.id === node.id || link.source === node.id) {
        connectedLinks.add(link);
        connectedNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
      }
      if (link.target.id === node.id || link.target === node.id) {
        connectedLinks.add(link);
        connectedNodes.add(typeof link.source === 'object' ? link.source.id : link.source);
      }
    });
    
    setHighlightNodes(connectedNodes);
    setHighlightLinks(connectedLinks);
  }, [graphData.links, isDragging]);

  const handleNodeDrag = useCallback((node) => {
    setIsDragging(true);
  }, []);

  const handleNodeDragEnd = useCallback((node) => {
    // Fix node position after dragging to prevent it from floating away
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
    // Reset dragging state after a short delay to allow click to be ignored
    setTimeout(() => setIsDragging(false), 100);
  }, []);

  const handleOpenMeeting = useCallback(() => {
    if (selectedNode && selectedNode.type === 'meeting' && selectedNode.data && selectedNode.data.id) {
      window.location.href = `/meetings/${selectedNode.data.id}`;
    }
  }, [selectedNode]);

  const handleHideNode = useCallback(() => {
    if (selectedNode) {
      setHiddenNodes(prev => {
        const newSet = new Set(prev);
        newSet.add(selectedNode.id);
        return newSet;
      });
      setSelectedNode(null);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
    }
  }, [selectedNode]);

  const handleShowAllNodes = useCallback(() => {
    setHiddenNodes(new Set());
  }, []);

  const handleNodeHover = useCallback((node) => {
    setHoverNode(node);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = 12 / globalScale;
    const nodeSize = getNodeSize(node);
    
    // Draw node
    ctx.fillStyle = getNodeColor(node);
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
    ctx.fill();
    
    // Highlight if selected or connected
    const isHighlighted = highlightNodes.has(node.id);
    if (isHighlighted) {
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }
    
    // Draw label if enabled
    if (showLabels || isHighlighted || node === hoverNode) {
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#333';
      ctx.fillText(label, node.x, node.y + nodeSize + fontSize);
    }
  }, [highlightNodes, hoverNode, showLabels]);

  const paintLink = useCallback((link, ctx, globalScale) => {
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
  }, [highlightLinks]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.2, 500);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.2, 500);
    }
  };

  const handleCenter = () => {
    if (graphRef.current) {
      // Add padding to prevent nodes from going out of bounds
      graphRef.current.zoomToFit(500, 50); // 500ms duration, 50px padding
    }
  };

  const handleTypeToggle = (event, newTypes) => {
    if (newTypes.length > 0) {
      setVisibleTypes(newTypes);
    }
  };

  const filteredData = React.useMemo(() => {
    return {
      nodes: graphData.nodes.filter(node => 
        visibleTypes.includes(node.type) && !hiddenNodes.has(node.id)
      ),
      links: graphData.links.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return graphData.nodes.some(n => n.id === sourceId && visibleTypes.includes(n.type) && !hiddenNodes.has(n.id)) &&
               graphData.nodes.some(n => n.id === targetId && visibleTypes.includes(n.type) && !hiddenNodes.has(n.id));
      })
    };
  }, [graphData, visibleTypes, hiddenNodes]);

  useEffect(() => {
    if (graphRef.current && filteredData.nodes.length > 0) {
      // Reset simulation state when data changes
      setIsSimulationRunning(true);
      
      // Clear fixed positions for new/filtered nodes to allow initial layout
      filteredData.nodes.forEach(node => {
        node.fx = undefined;
        node.fy = undefined;
      });
      
      // Zoom to fit after a brief delay to allow layout
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.zoomToFit(400, 60);
        }
      }, 500);
    }
  }, [filteredData.nodes.length]); // Only re-zoom if node count changes

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
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
        💡 <strong>Tips:</strong> Scroll to zoom. Drag background to pan. Click nodes to see details. <strong>Double-click meetings</strong> to open them. Drag nodes to reposition (they stay fixed). Use the freeze button to stop all movement.
      </Alert>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <MeetingIcon sx={{ mr: 1, color: '#1976d2' }} />
                  <Box>
                    <Typography variant="h5">{stats.meetings}</Typography>
                    <Typography variant="body2" color="text.secondary">Meetings</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ mr: 1, color: '#f50057' }} />
                  <Box>
                    <Typography variant="h5">{stats.people}</Typography>
                    <Typography variant="body2" color="text.secondary">People</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FolderIcon sx={{ mr: 1, color: '#ff9800' }} />
                  <Box>
                    <Typography variant="h5">{stats.folders}</Typography>
                    <Typography variant="body2" color="text.secondary">Folders</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TagIcon sx={{ mr: 1, color: '#4caf50' }} />
                  <Box>
                    <Typography variant="h5">{stats.tags}</Typography>
                    <Typography variant="body2" color="text.secondary">Tags</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <ToggleButtonGroup
            value={visibleTypes}
            onChange={handleTypeToggle}
            aria-label="node types"
            size="small"
          >
            <ToggleButton value="meeting" aria-label="meetings">
              <MeetingIcon sx={{ mr: 0.5 }} fontSize="small" />
              Meetings
            </ToggleButton>
            <ToggleButton value="person" aria-label="people">
              <PeopleIcon sx={{ mr: 0.5 }} fontSize="small" />
              People
            </ToggleButton>
            <ToggleButton value="folder" aria-label="folders">
              <FolderIcon sx={{ mr: 0.5 }} fontSize="small" />
              Folders
            </ToggleButton>
            <ToggleButton value="tag" aria-label="tags">
              <TagIcon sx={{ mr: 0.5 }} fontSize="small" />
              Tags
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControlLabel
              control={<Switch checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />}
              label="Show Labels"
            />
            
            {hiddenNodes.size > 0 && (
              <Tooltip title={`Show ${hiddenNodes.size} hidden node(s)`}>
                <IconButton onClick={handleShowAllNodes} size="small" color="warning">
                  <ShowIcon />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Zoom In">
              <IconButton onClick={handleZoomIn} size="small">
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <IconButton onClick={handleZoomOut} size="small">
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Center">
              <IconButton onClick={handleCenter} size="small">
                <CenterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchGraphData} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={isSimulationRunning ? "Freeze Graph" : "Unfreeze Graph"}>
              <IconButton 
                onClick={isSimulationRunning ? handleStopSimulation : handleResumeSimulation} 
                size="small" 
                color={isSimulationRunning ? "warning" : "success"}
              >
                {isSimulationRunning ? <LockOpenIcon /> : <LockIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

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
              border: '1px solid #e0e0e0'
            }}
          >
            <Box
              ref={containerRef}
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                '& canvas': {
                  display: 'block',
                  outline: 'none'
                },
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
                enableNodeDrag={true}
                enableZoomInteraction={true}
                enablePanInteraction={true}
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
            <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)} Details
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Chip
                  icon={
                    selectedNode.type === 'meeting' ? <MeetingIcon /> :
                    selectedNode.type === 'person' ? <PeopleIcon /> :
                    selectedNode.type === 'folder' ? <FolderIcon /> :
                    <TagIcon />
                  }
                  label={selectedNode.type}
                  color="primary"
                  size="small"
                />
              </Box>

              <Typography variant="body1" sx={{ mb: 2, fontWeight: 'bold' }}>
                {selectedNode.label}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {selectedNode.type === 'meeting' && selectedNode.data && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<OpenIcon />}
                    onClick={handleOpenMeeting}
                    fullWidth
                  >
                    Open Meeting
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  startIcon={<HideIcon />}
                  onClick={handleHideNode}
                  fullWidth
                >
                  Hide Node
                </Button>
              </Box>

              {selectedNode.type === 'meeting' && selectedNode.data && (
                <Box>
                  {selectedNode.data.meeting_date && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Date:</strong> {new Date(selectedNode.data.meeting_date).toLocaleDateString()}
                    </Typography>
                  )}
                  {selectedNode.data.folder && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Folder:</strong> {selectedNode.data.folder}
                    </Typography>
                  )}
                  {selectedNode.data.tags && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        <strong>Tags:</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedNode.data.tags.split(',').map((tag, idx) => (
                          <Chip key={idx} label={tag.trim()} size="small" />
                        ))}
                      </Box>
                    </Box>
                  )}
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Status:</strong> {selectedNode.data.status}
                  </Typography>
                </Box>
              )}

              <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
                <strong>Connected to {highlightNodes.size - 1} nodes</strong>
              </Typography>

              {selectedNode.type === 'meeting' && selectedNode.data && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                    Tip: Add meeting references in notes using #meeting-{selectedNode.data.id} or [[{selectedNode.data.id}]]
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Legend:</strong>
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#1976d2', mr: 1 }} />
            <Typography variant="body2">Meeting</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#f50057', mr: 1 }} />
            <Typography variant="body2">Person</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#ff9800', mr: 1 }} />
            <Typography variant="body2">Folder</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#4caf50', mr: 1 }} />
            <Typography variant="body2">Tag</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
            <Box sx={{ width: 24, height: 2, bgcolor: '#999', mr: 1 }} />
            <Typography variant="body2">Relationship</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 24, height: 2, borderTop: '2px dashed #999', mr: 1 }} />
            <Typography variant="body2">Meeting Reference</Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default MeetingsGraph;
