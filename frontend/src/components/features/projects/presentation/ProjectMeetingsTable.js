/**
 * ProjectMeetingsTable
 * Presentational component for the Meetings tab (tab 1).
 * Renders filter toolbar + sortable meetings table.
 * All data comes via props — no service calls.
 */

import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Clear as ClearIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getMeetingStatusColor = (status) => {
  const colors = {
    completed: 'success',
    processing: 'warning',
    failed: 'error',
    pending: 'default',
  };
  return colors[status] || 'default';
};

export const ProjectMeetingsTable = ({
  filteredMeetings,
  meetingsLoading,
  searchQuery,
  onSearchChange,
  onClearSearch,
  statusFilter,
  onStatusChange,
  sortBy,
  sortOrder,
  onSort,
  onLoadMeetings,
  onNavigateToMeeting,
}) => (
  <>
    {/* Filters */}
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <TextField
          fullWidth
          placeholder="Search meetings by title, folder, or speaker..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={onClearSearch}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            label="Status"
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={onLoadMeetings} disabled={meetingsLoading}>
          <RefreshIcon />
        </Button>
      </Stack>
    </Paper>

    {/* Table */}
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <TableSortLabel
                active={sortBy === 'title'}
                direction={sortBy === 'title' ? sortOrder : 'asc'}
                onClick={() => onSort('title')}
              >
                Title
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortBy === 'date'}
                direction={sortBy === 'date' ? sortOrder : 'asc'}
                onClick={() => onSort('date')}
              >
                Date
              </TableSortLabel>
            </TableCell>
            <TableCell>Speakers</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Action Items</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {meetingsLoading ? (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <CircularProgress sx={{ my: 2 }} />
              </TableCell>
            </TableRow>
          ) : filteredMeetings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" color="text.secondary" py={4}>
                  No meetings found
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            filteredMeetings.map((meeting) => (
              <TableRow
                key={meeting.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onNavigateToMeeting(meeting.id)}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {meeting.title || `Meeting ${meeting.id}`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CalendarIcon fontSize="small" color="action" />
                    <Typography variant="body2">{formatDate(meeting.meeting_date)}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="body2">{meeting.speakers?.length || 0}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={meeting.status || 'unknown'}
                    color={getMeetingStatusColor(meeting.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{meeting.action_items_count || 0}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Meeting">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToMeeting(meeting.id);
                      }}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  </>
);

export default ProjectMeetingsTable;
