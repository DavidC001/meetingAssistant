/**
 * MeetingsBrowserContainer
 * Orchestrates meeting browsing: filter/sort state (synced to URL), view preferences,
 * bulk selection and dialogs — all data concerns delegated to useMeetingsBrowser.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  Label as TagIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import FilterBar from '../../../common/FilterBar';
import ViewModeToggle from '../../../common/ViewModeToggle';
import MeetingCard from '../../../common/MeetingCard';
import LoadingSkeleton from '../../../common/LoadingSkeleton';
import EmptyState from '../../../common/EmptyState';
import PageHeader from '../../../common/PageHeader';
import { ConfirmDialog } from '../../../common';
import { useMeetingsBrowser } from '../hooks';

const MeetingsBrowserContainer = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter/sort state — synced with URL
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

  // Bulk dialog state
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkTagsDialogOpen, setBulkTagsDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkFolder, setBulkFolder] = useState('');
  const [bulkTags, setBulkTags] = useState([]);

  // Data + actions from hook
  const {
    filteredMeetings,
    availableFilters,
    isLoading,
    error,
    processing,
    snackbar,
    closeSnackbar,
    meetingActions,
    bulkActions,
  } = useMeetingsBrowser({ searchQuery, filters, sortBy, sortOrder });

  // Sync filters → URL
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

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('meetingsViewMode', viewMode);
  }, [viewMode]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setFilters({ statuses: [], folder: null, tags: [], dateRange: null });
    setSortBy('date');
    setSortOrder('desc');
  };

  const handleToggleSelection = (id) => {
    setSelectedMeetings((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkMove = async () => {
    const ok = await bulkActions.bulkMove(selectedMeetings, bulkFolder);
    if (ok) {
      setBulkMoveDialogOpen(false);
      setBulkFolder('');
      setSelectedMeetings([]);
    }
  };

  const handleBulkAddTags = async () => {
    const ok = await bulkActions.bulkAddTags(selectedMeetings, bulkTags);
    if (ok) {
      setBulkTagsDialogOpen(false);
      setBulkTags([]);
      setSelectedMeetings([]);
    }
  };

  const handleBulkDelete = async () => {
    const ok = await bulkActions.bulkDelete(selectedMeetings);
    if (ok) {
      setBulkDeleteDialogOpen(false);
      setSelectedMeetings([]);
    }
  };

  const hasFilters =
    searchQuery || Object.values(filters).some((v) => v && (Array.isArray(v) ? v.length : true));

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
                <MeetingCard meeting={meeting} variant="grid" {...meetingActions} />
              </Box>
            </Grid>
          ))}
        </Grid>
      );
    }

    return (
      <Stack spacing={1}>
        {filteredMeetings.map((meeting) => (
          <Box key={meeting.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={selectedMeetings.includes(meeting.id)}
              onChange={() => handleToggleSelection(meeting.id)}
            />
            <Box sx={{ flexGrow: 1 }}>
              <MeetingCard meeting={meeting} variant="list" {...meetingActions} />
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'grid' ? 'card' : 'list'} count={6} />
      ) : filteredMeetings.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No meetings match your filters' : 'No meetings yet'}
          description={
            hasFilters ? 'Try adjusting your filters' : 'Upload your first meeting to get started'
          }
          actionLabel={hasFilters ? 'Clear Filters' : undefined}
          onAction={handleClearAllFilters}
        />
      ) : (
        renderMeetings()
      )}

      {/* Bulk Action Bar */}
      {selectedMeetings.length > 0 && (
        <Paper
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200, borderRadius: 0 }}
          elevation={8}
        >
          <Toolbar>
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              {selectedMeetings.length} selected
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<MoveIcon />} onClick={() => setBulkMoveDialogOpen(true)}>
                Move
              </Button>
              <Button startIcon={<TagIcon />} onClick={() => setBulkTagsDialogOpen(true)}>
                Add Tags
              </Button>
              <Button
                startIcon={<DeleteIcon />}
                onClick={() => setBulkDeleteDialogOpen(true)}
                color="error"
              >
                Delete
              </Button>
              <IconButton onClick={() => setSelectedMeetings([])}>
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
        onClose={closeSnackbar}
        message={snackbar.message}
      >
        <Alert severity={snackbar.severity} onClose={closeSnackbar}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingsBrowserContainer;
