/**
 * FilterBar Component
 * 
 * Unified filter bar with search, filter chips, sort, and clear all functionality.
 * Designed for meetings browser and other list views.
 */

import React, { useState } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Popover,
  Stack,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel,
  FormGroup,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Clear as ClearIcon,
  CalendarToday as CalendarIcon,
  Folder as FolderIcon,
  Label as TagIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';

const FilterBar = ({
  searchValue = '',
  onSearchChange,
  filters = {},
  onFiltersChange,
  sortBy = 'date',
  sortOrder = 'desc',
  onSortChange,
  availableFilters = {
    statuses: [],
    folders: [],
    tags: [],
  },
  onClearAll,
  showViewModeToggle = false,
  viewMode = 'grid',
  onViewModeChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [statusAnchor, setStatusAnchor] = useState(null);
  const [folderAnchor, setFolderAnchor] = useState(null);
  const [tagAnchor, setTagAnchor] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);

  const activeFilterCount = Object.values(filters).filter(
    (value) => value && (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  const handleStatusClick = (event) => setStatusAnchor(event.currentTarget);
  const handleFolderClick = (event) => setFolderAnchor(event.currentTarget);
  const handleTagClick = (event) => setTagAnchor(event.currentTarget);
  const handleDateClick = (event) => setDateAnchor(event.currentTarget);

  const handleClose = () => {
    setStatusAnchor(null);
    setFolderAnchor(null);
    setTagAnchor(null);
    setDateAnchor(null);
  };

  const handleStatusChange = (status) => {
    const currentStatuses = filters.statuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleFolderChange = (folder) => {
    onFiltersChange({ ...filters, folder });
    handleClose();
  };

  const handleTagToggle = (tag) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const handleDateRangeChange = (range) => {
    onFiltersChange({ ...filters, dateRange: range });
    handleClose();
  };

  const handleRemoveFilter = (filterType, value) => {
    if (filterType === 'statuses') {
      const newStatuses = filters.statuses.filter((s) => s !== value);
      onFiltersChange({ ...filters, statuses: newStatuses });
    } else if (filterType === 'tags') {
      const newTags = filters.tags.filter((t) => t !== value);
      onFiltersChange({ ...filters, tags: newTags });
    } else {
      const newFilters = { ...filters };
      delete newFilters[filterType];
      onFiltersChange(newFilters);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Main Filter Bar */}
      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={2}
        alignItems={isMobile ? 'stretch' : 'center'}
        sx={{ mb: 2 }}
      >
        {/* Search Input */}
        <TextField
          placeholder="Search meetings..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          fullWidth={isMobile}
          sx={{ minWidth: isMobile ? 'auto' : 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchValue && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearchChange('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Filter Buttons */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FilterIcon />}
            endIcon={<ArrowDownIcon />}
            onClick={handleStatusClick}
          >
            Status {filters.statuses?.length > 0 && `(${filters.statuses.length})`}
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<FolderIcon />}
            endIcon={<ArrowDownIcon />}
            onClick={handleFolderClick}
          >
            Folder {filters.folder && '(1)'}
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<TagIcon />}
            endIcon={<ArrowDownIcon />}
            onClick={handleTagClick}
          >
            Tags {filters.tags?.length > 0 && `(${filters.tags.length})`}
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<CalendarIcon />}
            endIcon={<ArrowDownIcon />}
            onClick={handleDateClick}
          >
            Date {filters.dateRange && '(1)'}
          </Button>
        </Stack>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Sort Dropdown */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              onSortChange(newSortBy, newSortOrder);
            }}
            label="Sort By"
            startAdornment={<SortIcon sx={{ mr: 1, color: 'text.secondary' }} />}
          >
            <MenuItem value="date-desc">Newest First</MenuItem>
            <MenuItem value="date-asc">Oldest First</MenuItem>
            <MenuItem value="title-asc">Title A-Z</MenuItem>
            <MenuItem value="title-desc">Title Z-A</MenuItem>
            <MenuItem value="status-asc">Status</MenuItem>
          </Select>
        </FormControl>

        {/* Clear All Button */}
        {activeFilterCount > 0 && (
          <Button
            variant="text"
            size="small"
            startIcon={<ClearIcon />}
            onClick={onClearAll}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Clear All
          </Button>
        )}
      </Stack>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {filters.statuses?.map((status) => (
            <Chip
              key={status}
              label={status}
              size="small"
              onDelete={() => handleRemoveFilter('statuses', status)}
              color="primary"
              variant="outlined"
            />
          ))}
          {filters.folder && (
            <Chip
              label={`Folder: ${filters.folder}`}
              size="small"
              onDelete={() => handleRemoveFilter('folder')}
              color="primary"
              variant="outlined"
              icon={<FolderIcon />}
            />
          )}
          {filters.tags?.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onDelete={() => handleRemoveFilter('tags', tag)}
              color="primary"
              variant="outlined"
              icon={<TagIcon />}
            />
          ))}
          {filters.dateRange && (
            <Chip
              label={`Date: ${filters.dateRange}`}
              size="small"
              onDelete={() => handleRemoveFilter('dateRange')}
              color="primary"
              variant="outlined"
              icon={<CalendarIcon />}
            />
          )}
        </Stack>
      )}

      {/* Status Filter Popover */}
      <Popover
        open={Boolean(statusAnchor)}
        anchorEl={statusAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter by Status
          </Typography>
          <FormGroup>
            {availableFilters.statuses.map((status) => (
              <FormControlLabel
                key={status}
                control={
                  <Checkbox
                    checked={filters.statuses?.includes(status) || false}
                    onChange={() => handleStatusChange(status)}
                  />
                }
                label={status}
              />
            ))}
          </FormGroup>
        </Box>
      </Popover>

      {/* Folder Filter Popover */}
      <Popover
        open={Boolean(folderAnchor)}
        anchorEl={folderAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter by Folder
          </Typography>
          <Stack spacing={1}>
            <Button
              variant="text"
              size="small"
              onClick={() => handleFolderChange(null)}
              sx={{ justifyContent: 'flex-start' }}
            >
              All Folders
            </Button>
            {availableFilters.folders.map((folder) => (
              <Button
                key={folder}
                variant={filters.folder === folder ? 'contained' : 'text'}
                size="small"
                onClick={() => handleFolderChange(folder)}
                sx={{ justifyContent: 'flex-start' }}
              >
                {folder}
              </Button>
            ))}
          </Stack>
        </Box>
      </Popover>

      {/* Tags Filter Popover */}
      <Popover
        open={Boolean(tagAnchor)}
        anchorEl={tagAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter by Tags
          </Typography>
          <FormGroup>
            {availableFilters.tags.map((tag) => (
              <FormControlLabel
                key={tag}
                control={
                  <Checkbox
                    checked={filters.tags?.includes(tag) || false}
                    onChange={() => handleTagToggle(tag)}
                  />
                }
                label={tag}
              />
            ))}
          </FormGroup>
        </Box>
      </Popover>

      {/* Date Range Filter Popover */}
      <Popover
        open={Boolean(dateAnchor)}
        anchorEl={dateAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter by Date
          </Typography>
          <Stack spacing={1}>
            <Button
              variant={filters.dateRange === 'today' ? 'contained' : 'text'}
              size="small"
              onClick={() => handleDateRangeChange('today')}
              sx={{ justifyContent: 'flex-start' }}
            >
              Today
            </Button>
            <Button
              variant={filters.dateRange === 'week' ? 'contained' : 'text'}
              size="small"
              onClick={() => handleDateRangeChange('week')}
              sx={{ justifyContent: 'flex-start' }}
            >
              This Week
            </Button>
            <Button
              variant={filters.dateRange === 'month' ? 'contained' : 'text'}
              size="small"
              onClick={() => handleDateRangeChange('month')}
              sx={{ justifyContent: 'flex-start' }}
            >
              This Month
            </Button>
            <Button
              variant={filters.dateRange === 'year' ? 'contained' : 'text'}
              size="small"
              onClick={() => handleDateRangeChange('year')}
              sx={{ justifyContent: 'flex-start' }}
            >
              This Year
            </Button>
            <Divider />
            <Button
              variant="text"
              size="small"
              onClick={() => handleDateRangeChange(null)}
              sx={{ justifyContent: 'flex-start' }}
            >
              All Time
            </Button>
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
};

export default FilterBar;
