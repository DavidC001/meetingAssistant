/**
 * MeetingsBrowser Component (Refactored)
 * 
 * Improved meetings browser with:
 * - FilterBar integration
 * - Cleaner architecture
 * - Better view modes
 * - Enhanced bulk operations
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Stack,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Paper,
  Typography,
  Checkbox,
  Toolbar,
  Slide,
  Alert,
  Snackbar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  Label as TagIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  GraphicEq as AudioIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import FilterBar from './common/FilterBar';
import ViewModeToggle from './common/ViewModeToggle';
import MeetingCard from './common/MeetingCard';
import LoadingSkeleton from './common/LoadingSkeleton';
import EmptyState from './common/EmptyState';
import PageHeader from './common/PageHeader';
import { ConfirmDialog } from './common';
import api from '../api';

// Slide transition for bulk action bar
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const MeetingsBrowser = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Data state
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state (synced with URL)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState({
    statuses: searchParams.get('status')?.split(',').filter(Boolean) || [],
    folder: searchParams.get('folder') || null,
    tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
    dateRange: searchParams.get('dateRange') || null,
  });
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'date');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [viewMode, setViewMode] = useState(localStorage.getItem('meetingsViewMode') || 'grid');

  // Selection state
  const [selectedMeetings, setSelectedMeetings] = useState([]);

  // Dialog state
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkTagsDialogOpen, setBulkTagsDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkFolder, setBulkFolder] = useState('');
  const [bulkTags, setBulkTags] = useState([]);
  const [processing, setProcessing] = useState(false);

  // Success/error messages
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/v1/meetings/');
      setMeetings(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch meetings.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Separate effect for polling that doesn't cause re-renders
  useEffect(() => {
    // Poll for processing meetings
    const pollInterval = setInterval(() => {
      // Check if there are any processing meetings before fetching
      api.get('/api/v1/meetings/')
        .then(response => {
          const hasProcessing = response.data.some(m => 
            m.status === 'processing' || m.status === 'pending'
          );
          if (hasProcessing) {
            setMeetings(response.data);
          }
        })
        .catch(err => console.error('Polling error:', err));
    }, 15000);

    return () => clearInterval(pollInterval);
  }, []); // Empty dependency array - only set up once

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (filters.statuses.length) params.set('status', filters.statuses.join(','));
    if (filters.folder) params.set('folder', filters.folder);
    if (filters.tags.length) params.set('tags', filters.tags.join(','));
    if (filters.dateRange) params.set('dateRange', filters.dateRange);
    if (sortBy !== 'date') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, filters, sortBy, sortOrder, setSearchParams]);

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('meetingsViewMode', viewMode);
  }, [viewMode]);

  // Get available filter options
  const availableFilters = useMemo(() => {
    const statuses = [...new Set(meetings.map(m => m.status))];
    const folders = [...new Set(meetings.map(m => m.folder || 'Uncategorized'))];
    const tags = [...new Set(meetings.flatMap(m => {
      if (!m.tags) return [];
      if (typeof m.tags === 'string') {
        return m.tags.split(',').map(t => t.trim()).filter(Boolean);
      }
      return m.tags;
    }))];

    return { statuses, folders, tags };
  }, [meetings]);

  // Filter and sort meetings
  const filteredMeetings = useMemo(() => {
    let result = [...meetings];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(meeting =>
        (meeting.filename || meeting.title || '').toLowerCase().includes(query) ||
        (meeting.folder || '').toLowerCase().includes(query) ||
        (meeting.tags || '').toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filters.statuses.length) {
      result = result.filter(m => filters.statuses.includes(m.status));
    }

    // Folder filter
    if (filters.folder) {
      result = result.filter(m => (m.folder || 'Uncategorized') === filters.folder);
    }

    // Tags filter
    if (filters.tags.length) {
      result = result.filter(m => {
        const meetingTags = typeof m.tags === 'string' 
          ? m.tags.split(',').map(t => t.trim())
          : (m.tags || []);
        return filters.tags.some(tag => meetingTags.includes(tag));
      });
    }

    // Date range filter
    if (filters.dateRange) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let filterDate;

      switch (filters.dateRange) {
        case 'today':
          filterDate = startOfDay;
          break;
        case 'week':
          filterDate = new Date(startOfDay);
          filterDate.setDate(filterDate.getDate() - 7);
          break;
        case 'month':
          filterDate = new Date(startOfDay);
          filterDate.setMonth(filterDate.getMonth() - 1);
          break;
        case 'year':
          filterDate = new Date(startOfDay);
          filterDate.setFullYear(filterDate.getFullYear() - 1);
          break;
        default:
          filterDate = null;
      }

      if (filterDate) {
        result = result.filter(m => 
          new Date(m.meeting_date || m.created_at) >= filterDate
        );
      }
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.meeting_date || a.created_at) - new Date(b.meeting_date || b.created_at);
          break;
        case 'title':
          comparison = (a.title || a.filename || '').localeCompare(b.title || b.filename || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [meetings, searchQuery, filters, sortBy, sortOrder]);

  // Bulk operations
  const handleBulkMove = async () => {
    if (!bulkFolder.trim()) return;
    setProcessing(true);
    try {
      await Promise.all(
        selectedMeetings.map(id => {
          const meeting = meetings.find(m => m.id === id);
          return api.updateMeetingTagsFolder(id, meeting?.tags || '', bulkFolder.trim());
        })
      );
      setSnackbar({ open: true, message: `Moved ${selectedMeetings.length} meeting(s) to ${bulkFolder}`, severity: 'success' });
      setBulkMoveDialogOpen(false);
      setBulkFolder('');
      setSelectedMeetings([]);
      await fetchMeetings();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to move some meetings', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAddTags = async () => {
    if (!bulkTags.length) return;
    setProcessing(true);
    try {
      await Promise.all(
        selectedMeetings.map(id => {
          const meeting = meetings.find(m => m.id === id);
          const existingTags = meeting?.tags ? meeting.tags.split(',').map(t => t.trim()) : [];
          const newTags = [...new Set([...existingTags, ...bulkTags])].join(', ');
          return api.updateMeetingTagsFolder(id, newTags, meeting?.folder || '');
        })
      );
      setSnackbar({ open: true, message: `Added tags to ${selectedMeetings.length} meeting(s)`, severity: 'success' });
      setBulkTagsDialogOpen(false);
      setBulkTags([]);
      setSelectedMeetings([]);
      await fetchMeetings();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to add tags to some meetings', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    setProcessing(true);
    try {
      await Promise.all(selectedMeetings.map(id => api.delete(`/api/v1/meetings/${id}`)));
      setSnackbar({ open: true, message: `Deleted ${selectedMeetings.length} meeting(s)`, severity: 'success' });
      setBulkDeleteDialogOpen(false);
      setSelectedMeetings([]);
      await fetchMeetings();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete some meetings', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectAll = () => {
    setSelectedMeetings(filteredMeetings.map(m => m.id));
  };

  const handleClearSelection = () => {
    setSelectedMeetings([]);
  };

  const handleToggleSelection = (meetingId) => {
    setSelectedMeetings(prev =>
      prev.includes(meetingId)
        ? prev.filter(id => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  // Individual meeting action handlers
  const navigate = useNavigate();

  const handleViewMeeting = (meeting) => {
    navigate(`/meetings/${meeting.id}`);
  };

  const handleEditMeeting = (meeting) => {
    navigate(`/meetings/${meeting.id}`);
  };

  const handleChatMeeting = (meeting) => {
    navigate(`/meetings/${meeting.id}?tab=chat`);
  };

  const handleDownloadMeeting = async (meeting, format = 'txt') => {
    try {
      const response = await api.get(`/api/v1/meetings/${meeting.id}/download/${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${meeting.filename}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSnackbar({ open: true, message: 'Download started', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to download transcript', severity: 'error' });
    }
  };

  const handleRegenerateAudio = async (meeting) => {
    try {
      await api.post(`/api/v1/meetings/${meeting.id}/audio/regenerate`);
      setSnackbar({ open: true, message: 'Audio regeneration started', severity: 'success' });
      await fetchMeetings();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to regenerate audio', severity: 'error' });
    }
  };

  const handleRestartProcessing = async (meeting) => {
    try {
      await api.post(`/api/v1/meetings/${meeting.id}/restart-processing`);
      setSnackbar({ open: true, message: 'Processing restarted', severity: 'success' });
      await fetchMeetings();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to restart processing', severity: 'error' });
    }
  };

  const handleDeleteMeeting = async (meeting) => {
    if (window.confirm(`Are you sure you want to delete "${meeting.filename}"?`)) {
      try {
        await api.delete(`/api/v1/meetings/${meeting.id}`);
        setSnackbar({ open: true, message: 'Meeting deleted', severity: 'success' });
        await fetchMeetings();
      } catch (err) {
        setSnackbar({ open: true, message: 'Failed to delete meeting', severity: 'error' });
      }
    }
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setFilters({ statuses: [], folder: null, tags: [], dateRange: null });
    setSortBy('date');
    setSortOrder('desc');
  };

  // Render meetings based on view mode
  const renderMeetings = () => {
    if (viewMode === 'grid') {
      return (
        <Grid container spacing={3}>
          {filteredMeetings.map((meeting) => (
            <Grid item xs={12} sm={6} md={4} key={meeting.id}>
              <Box sx={{ position: 'relative' }}>
                <Checkbox
                  checked={selectedMeetings.includes(meeting.id)}
                  onChange={() => handleToggleSelection(meeting.id)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 1,
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                />
                <MeetingCard 
                  meeting={meeting} 
                  variant="grid"
                  onView={handleViewMeeting}
                  onEdit={handleEditMeeting}
                  onChat={handleChatMeeting}
                  onDownload={handleDownloadMeeting}
                  onDelete={handleDeleteMeeting}
                  onRegenerateAudio={handleRegenerateAudio}
                  onRestartProcessing={handleRestartProcessing}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      );
    }

    if (viewMode === 'list') {
      return (
        <Stack spacing={1}>
          {filteredMeetings.map((meeting) => (
            <Box key={meeting.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={selectedMeetings.includes(meeting.id)}
                onChange={() => handleToggleSelection(meeting.id)}
              />
              <Box sx={{ flexGrow: 1 }}>
                <MeetingCard 
                  meeting={meeting} 
                  variant="list"
                  onView={handleViewMeeting}
                  onEdit={handleEditMeeting}
                  onChat={handleChatMeeting}
                  onDownload={handleDownloadMeeting}
                  onDelete={handleDeleteMeeting}
                  onRegenerateAudio={handleRegenerateAudio}
                  onRestartProcessing={handleRestartProcessing}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      );
    }

    // Table view (simplified for now)
    return (
      <Stack spacing={1}>
        {filteredMeetings.map((meeting) => (
          <Box key={meeting.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={selectedMeetings.includes(meeting.id)}
              onChange={() => handleToggleSelection(meeting.id)}
            />
            <Box sx={{ flexGrow: 1 }}>
              <MeetingCard meeting={meeting} variant="list" />
            </Box>
          </Box>
        ))}
      </Stack>
    );
  };

  return (
    <Box>
      <PageHeader
        title="Meetings Browser"
        subtitle={`${filteredMeetings.length} meeting${filteredMeetings.length !== 1 ? 's' : ''}`}
      />

      {/* Filter Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <FilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(newSortBy, newSortOrder) => {
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            availableFilters={availableFilters}
            onClearAll={handleClearAllFilters}
          />
        </Box>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'grid' ? 'card' : 'list'} count={6} />
      ) : filteredMeetings.length === 0 ? (
        <EmptyState
          title={searchQuery || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length : true))
            ? 'No meetings match your filters'
            : 'No meetings yet'}
          description={searchQuery || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length : true))
            ? 'Try adjusting your filters'
            : 'Upload your first meeting to get started'}
          actionLabel={!(searchQuery || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length : true))) ? 'Clear Filters' : undefined}
          onAction={handleClearAllFilters}
        />
      ) : (
        renderMeetings()
      )}

      {/* Bulk Action Bar */}
      {selectedMeetings.length > 0 && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            borderRadius: 0,
          }}
          elevation={8}
        >
          <Toolbar>
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              {selectedMeetings.length} selected
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                startIcon={<MoveIcon />}
                onClick={() => setBulkMoveDialogOpen(true)}
              >
                Move
              </Button>
              <Button
                startIcon={<TagIcon />}
                onClick={() => setBulkTagsDialogOpen(true)}
              >
                Add Tags
              </Button>
              <Button
                startIcon={<DeleteIcon />}
                onClick={() => setBulkDeleteDialogOpen(true)}
                color="error"
              >
                Delete
              </Button>
              <IconButton onClick={handleClearSelection}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Paper>
      )}

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onClose={() => setBulkMoveDialogOpen(false)}>
        <DialogTitle>Move to Folder</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={availableFilters.folders}
            value={bulkFolder}
            onInputChange={(e, value) => setBulkFolder(value)}
            renderInput={(params) => (
              <TextField {...params} label="Folder" fullWidth sx={{ mt: 2 }} />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkMoveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkMove} variant="contained" disabled={processing}>
            Move
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Tags Dialog */}
      <Dialog open={bulkTagsDialogOpen} onClose={() => setBulkTagsDialogOpen(false)}>
        <DialogTitle>Add Tags</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            freeSolo
            options={availableFilters.tags}
            value={bulkTags}
            onChange={(e, value) => setBulkTags(value)}
            renderInput={(params) => (
              <TextField {...params} label="Tags" fullWidth sx={{ mt: 2 }} />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkTagsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkAddTags} variant="contained" disabled={processing}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Meetings"
        message={`Are you sure you want to delete ${selectedMeetings.length} meeting(s)? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        processing={processing}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingsBrowser;
