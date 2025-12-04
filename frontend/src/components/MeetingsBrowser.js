import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  Grid,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Button,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Divider,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  TableChart as TableChartIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Label as LabelIcon,
  DriveFileMove as DrivFileMoveIcon,
  CreateNewFolder as CreateNewFolderIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import api from '../api';

const MeetingsBrowser = ({ onMeetingUpdate }) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // list, grid, table
  const [sortBy, setSortBy] = useState('date_desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFolder, setFilterFolder] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState({});
  
  // Dialog states
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/meetings/');
      setMeetings(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch meetings.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
    
    // Smart polling for processing meetings
    let pollTimeout = null;
    let currentMeetings = meetings;
    
    const scheduleNextPoll = () => {
      const hasProcessingMeetings = currentMeetings.some(m => 
        m.status === 'processing' || m.status === 'pending'
      );
      if (hasProcessingMeetings) {
        pollTimeout = setTimeout(async () => {
          try {
            const response = await api.get('/api/v1/meetings/');
            setMeetings(response.data);
            currentMeetings = response.data;
            scheduleNextPoll();
          } catch (error) {
            console.error('Error polling meetings:', error);
          }
        }, 15000);
      }
    };
    
    const initialPollTimer = setTimeout(scheduleNextPoll, 5000);
    
    return () => {
      if (pollTimeout) clearTimeout(pollTimeout);
      clearTimeout(initialPollTimer);
    };
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = meetings.length;
    const completed = meetings.filter(m => m.status === 'completed').length;
    const processing = meetings.filter(m => m.status === 'processing').length;
    const failed = meetings.filter(m => m.status === 'failed').length;
    const folders = new Set(meetings.map(m => m.folder || 'Uncategorized')).size;
    
    return { total, completed, processing, failed, folders };
  }, [meetings]);

  // Filter and sort meetings
  const filteredAndSortedMeetings = useMemo(() => {
    let result = [...meetings];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(meeting =>
        meeting.filename.toLowerCase().includes(query) ||
        meeting.folder?.toLowerCase().includes(query) ||
        meeting.tags?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(meeting => meeting.status === filterStatus);
    }

    // Folder filter
    if (filterFolder !== 'all') {
      result = result.filter(meeting => 
        (meeting.folder || 'Uncategorized') === filterFolder
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.meeting_date || b.created_at) - new Date(a.meeting_date || a.created_at);
        case 'date_asc':
          return new Date(a.meeting_date || a.created_at) - new Date(b.meeting_date || b.created_at);
        case 'name_asc':
          return a.filename.localeCompare(b.filename);
        case 'name_desc':
          return b.filename.localeCompare(a.filename);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return result;
  }, [meetings, searchQuery, filterStatus, filterFolder, sortBy]);

  // Group by folder
  const groupedMeetings = useMemo(() => {
    const groups = {};
    filteredAndSortedMeetings.forEach(meeting => {
      const folder = meeting.folder || 'Uncategorized';
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(meeting);
    });
    return groups;
  }, [filteredAndSortedMeetings]);

  const folders = useMemo(() => {
    return Array.from(new Set(meetings.map(m => m.folder || 'Uncategorized'))).sort();
  }, [meetings]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'processing':
        return <ScheduleIcon color="primary" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <PendingIcon color="warning" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'primary';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleMenuOpen = (event, meeting) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedMeeting(meeting);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMeeting(null);
  };

  const handleRename = () => {
    setNewName(selectedMeeting.filename);
    setRenameDialogOpen(true);
    setAnchorEl(null);
  };

  const handleRenameConfirm = async () => {
    if (!newName || !newName.trim()) return;
    
    try {
      await api.renameMeeting(selectedMeeting.id, newName.trim());
      setRenameDialogOpen(false);
      setNewName('');
      setSelectedMeeting(null);
      await fetchMeetings();
      if (onMeetingUpdate) onMeetingUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to rename meeting.');
    }
  };

  const handleMoveToFolder = () => {
    setNewFolderName(selectedMeeting.folder || '');
    setMoveFolderDialogOpen(true);
    setAnchorEl(null);
  };

  const handleMoveFolderConfirm = async () => {
    try {
      await api.updateMeetingTagsFolder(
        selectedMeeting.id, 
        selectedMeeting.tags || '', 
        newFolderName.trim()
      );
      setMoveFolderDialogOpen(false);
      setNewFolderName('');
      setSelectedMeeting(null);
      await fetchMeetings();
      if (onMeetingUpdate) onMeetingUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to move meeting.');
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteMeeting(selectedMeeting.id);
      setDeleteDialogOpen(false);
      setSelectedMeeting(null);
      await fetchMeetings();
      if (onMeetingUpdate) onMeetingUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete meeting.');
    }
  };

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }));
  };

  const renderMeetingCard = (meeting, compact = false) => (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s',
        '&:hover': {
          elevation: 6,
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
        }
      }}
    >
      <Box
        component={Link}
        to={`/meetings/${meeting.id}`}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 2.5,
          textDecoration: 'none',
          color: 'inherit'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, mr: 1 }}>
            <Typography variant={compact ? "subtitle1" : "h6"} fontWeight="600" gutterBottom noWrap>
              {meeting.filename}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {getStatusIcon(meeting.status)}
              <Chip
                label={meeting.status.toUpperCase()}
                color={getStatusColor(meeting.status)}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => handleMenuOpen(e, meeting)}
            sx={{ mt: -0.5 }}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, mb: 2 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
            <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {formatDate(meeting.meeting_date || meeting.created_at)}
            </Typography>
          </Stack>
          
          {meeting.folder && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
              <FolderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {meeting.folder}
              </Typography>
            </Stack>
          )}

          {meeting.tags && (
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {meeting.tags.split(',').slice(0, 3).map((tag, i) => (
                  <Chip
                    key={i}
                    icon={<LabelIcon />}
                    label={tag.trim()}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                ))}
                {meeting.tags.split(',').length > 3 && (
                  <Chip
                    label={`+${meeting.tags.split(',').length - 3}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Stack>
            </Box>
          )}
        </Box>

        {meeting.status === 'processing' && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" fontWeight="600" color="primary">
                Processing
              </Typography>
              <Typography variant="caption" fontWeight="600" color="primary">
                {Math.round(meeting.overall_progress || 0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={meeting.overall_progress || 0}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>
        )}
      </Box>
    </Paper>
  );

  const renderListView = () => (
    <Box>
      {Object.keys(groupedMeetings).sort().map((folder) => (
        <Accordion
          key={folder}
          expanded={expandedFolders[folder] !== false}
          onChange={() => toggleFolder(folder)}
          elevation={2}
          sx={{
            mb: 2,
            borderRadius: 2,
            '&:before': { display: 'none' },
            overflow: 'hidden'
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: 'primary.light',
              color: 'primary.contrastText',
              minHeight: 64,
              '&:hover': {
                backgroundColor: 'primary.main',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              {expandedFolders[folder] !== false ?
                <FolderOpenIcon sx={{ fontSize: 28 }} /> :
                <FolderIcon sx={{ fontSize: 28 }} />
              }
              <Typography variant="h6" fontWeight="600">
                {folder}
              </Typography>
              <Chip
                label={`${groupedMeetings[folder].length} meeting${groupedMeetings[folder].length !== 1 ? 's' : ''}`}
                sx={{
                  ml: 'auto',
                  bgcolor: 'white',
                  color: 'primary.main',
                  fontWeight: 600
                }}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2, bgcolor: '#f8f9fa' }}>
            <Grid container spacing={2}>
              {groupedMeetings[folder].map((meeting) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={meeting.id}>
                  {renderMeetingCard(meeting, true)}
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const renderGridView = () => (
    <Grid container spacing={3}>
      {filteredAndSortedMeetings.map((meeting) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={meeting.id}>
          {renderMeetingCard(meeting)}
        </Grid>
      ))}
    </Grid>
  );

  const renderTableView = () => (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <Box component="thead" sx={{ bgcolor: 'primary.light' }}>
            <Box component="tr">
              <Box component="th" sx={{ p: 2, textAlign: 'left', color: 'white', fontWeight: 600 }}>
                Status
              </Box>
              <Box component="th" sx={{ p: 2, textAlign: 'left', color: 'white', fontWeight: 600 }}>
                Name
              </Box>
              <Box component="th" sx={{ p: 2, textAlign: 'left', color: 'white', fontWeight: 600 }}>
                Folder
              </Box>
              <Box component="th" sx={{ p: 2, textAlign: 'left', color: 'white', fontWeight: 600 }}>
                Date
              </Box>
              <Box component="th" sx={{ p: 2, textAlign: 'left', color: 'white', fontWeight: 600 }}>
                Tags
              </Box>
              <Box component="th" sx={{ p: 2, textAlign: 'right', color: 'white', fontWeight: 600 }}>
                Actions
              </Box>
            </Box>
          </Box>
          <Box component="tbody">
            {filteredAndSortedMeetings.map((meeting, index) => (
              <Box
                component="tr"
                key={meeting.id}
                sx={{
                  bgcolor: index % 2 === 0 ? 'background.paper' : 'action.hover',
                  '&:hover': { bgcolor: 'action.selected' },
                  cursor: 'pointer'
                }}
              >
                <Box component="td" sx={{ p: 2 }}>
                  <Chip
                    icon={getStatusIcon(meeting.status)}
                    label={meeting.status}
                    color={getStatusColor(meeting.status)}
                    size="small"
                  />
                </Box>
                <Box
                  component="td"
                  sx={{ p: 2 }}
                  onClick={() => window.location.href = `/meetings/${meeting.id}`}
                >
                  <Typography fontWeight="600">{meeting.filename}</Typography>
                  {meeting.status === 'processing' && (
                    <LinearProgress
                      variant="determinate"
                      value={meeting.overall_progress || 0}
                      sx={{ mt: 1, height: 4, borderRadius: 1 }}
                    />
                  )}
                </Box>
                <Box component="td" sx={{ p: 2 }}>
                  <Chip
                    icon={<FolderIcon />}
                    label={meeting.folder || 'Uncategorized'}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Box component="td" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(meeting.meeting_date || meeting.created_at)}
                  </Typography>
                </Box>
                <Box component="td" sx={{ p: 2 }}>
                  {meeting.tags && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {meeting.tags.split(',').slice(0, 2).map((tag, i) => (
                        <Chip key={i} label={tag.trim()} size="small" />
                      ))}
                      {meeting.tags.split(',').length > 2 && (
                        <Chip label={`+${meeting.tags.split(',').length - 2}`} size="small" />
                      )}
                    </Stack>
                  )}
                </Box>
                <Box component="td" sx={{ p: 2, textAlign: 'right' }}>
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, meeting)}>
                    <MoreVertIcon />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Paper>
  );

  if (isLoading && meetings.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Loading meetings...
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 3 }}>
        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'white' }}>
              <AssessmentIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" fontWeight="600">{stats.total}</Typography>
              <Typography variant="body2">Total Meetings</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
              <CheckCircleIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" fontWeight="600">{stats.completed}</Typography>
              <Typography variant="body2">Completed</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'white' }}>
              <ScheduleIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" fontWeight="600">{stats.processing}</Typography>
              <Typography variant="body2">Processing</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light', color: 'white' }}>
              <ErrorIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" fontWeight="600">{stats.failed}</Typography>
              <Typography variant="body2">Failed</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'white' }}>
              <FolderIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" fontWeight="600">{stats.folders}</Typography>
              <Typography variant="body2">Folders</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Controls */}
        <Card elevation={3}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              {/* Search */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Filters */}
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    label="Status"
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="processing">Processing</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Folder</InputLabel>
                  <Select
                    value={filterFolder}
                    label="Folder"
                    onChange={(e) => setFilterFolder(e.target.value)}
                  >
                    <MenuItem value="all">All Folders</MenuItem>
                    {folders.map(folder => (
                      <MenuItem key={folder} value={folder}>{folder}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Sort */}
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={sortBy}
                    label="Sort By"
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <MenuItem value="date_desc">Newest First</MenuItem>
                    <MenuItem value="date_asc">Oldest First</MenuItem>
                    <MenuItem value="name_asc">Name A-Z</MenuItem>
                    <MenuItem value="name_desc">Name Z-A</MenuItem>
                    <MenuItem value="status">Status</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* View Mode */}
              <Grid item xs={12} sm={6} md={2}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, newMode) => newMode && setViewMode(newMode)}
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="list">
                    <Tooltip title="List View">
                      <ViewListIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="grid">
                    <Tooltip title="Grid View">
                      <ViewModuleIcon />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="table">
                    <Tooltip title="Table View">
                      <TableChartIcon />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>
            </Grid>

            {/* Active Filters Display */}
            {(filterStatus !== 'all' || filterFolder !== 'all' || searchQuery) && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  Active filters:
                </Typography>
                {searchQuery && (
                  <Chip
                    label={`Search: "${searchQuery}"`}
                    size="small"
                    onDelete={() => setSearchQuery('')}
                  />
                )}
                {filterStatus !== 'all' && (
                  <Chip
                    label={`Status: ${filterStatus}`}
                    size="small"
                    onDelete={() => setFilterStatus('all')}
                  />
                )}
                {filterFolder !== 'all' && (
                  <Chip
                    label={`Folder: ${filterFolder}`}
                    size="small"
                    onDelete={() => setFilterFolder('all')}
                  />
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Results */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredAndSortedMeetings.length} of {meetings.length} meetings
        </Typography>
      </Box>

      {filteredAndSortedMeetings.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No meetings found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {meetings.length === 0
              ? 'Upload your first meeting to get started!'
              : 'Try adjusting your filters or search query'}
          </Typography>
        </Paper>
      ) : (
        <>
          {viewMode === 'list' && renderListView()}
          {viewMode === 'grid' && renderGridView()}
          {viewMode === 'table' && renderTableView()}
        </>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRename}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Rename
        </MenuItem>
        <MenuItem onClick={handleMoveToFolder}>
          <DrivFileMoveIcon sx={{ mr: 1 }} fontSize="small" />
          Move to Folder
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <Dialog open={renameDialogOpen} onClose={() => { setRenameDialogOpen(false); setSelectedMeeting(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Rename Meeting</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Meeting Name"
            fullWidth
            variant="outlined"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newName && newName.trim()) {
                handleRenameConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRenameDialogOpen(false); setSelectedMeeting(null); }}>
            Cancel
          </Button>
          <Button
            onClick={handleRenameConfirm}
            variant="contained"
            disabled={!newName || !newName.trim()}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveFolderDialogOpen} onClose={() => { setMoveFolderDialogOpen(false); setSelectedMeeting(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Move to Folder</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={folders.filter(f => f !== 'Uncategorized')}
            value={newFolderName}
            onChange={(event, newValue) => setNewFolderName(newValue || '')}
            onInputChange={(event, newInputValue) => setNewFolderName(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                margin="dense"
                label="Folder Name"
                fullWidth
                variant="outlined"
                helperText="Select existing folder or type new name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleMoveFolderConfirm();
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <CreateNewFolderIcon />
                      </InputAdornment>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMoveFolderDialogOpen(false); setSelectedMeeting(null); }}>
            Cancel
          </Button>
          <Button onClick={handleMoveFolderConfirm} variant="contained">
            Move
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setSelectedMeeting(null); }}>
        <DialogTitle>Delete Meeting</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedMeeting?.filename}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setSelectedMeeting(null); }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MeetingsBrowser;
