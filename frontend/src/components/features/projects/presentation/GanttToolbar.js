import React from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

/**
 * Toolbar above the Gantt chart: type filter, date range pickers, presets, legend.
 */
const GanttToolbar = ({
  filterType,
  onFilterChange,
  typeCounts,
  dateRangeStart,
  onStartChange,
  dateRangeEnd,
  onEndChange,
  onApplyPreset,
  onAddActionItem,
  isDarkMode,
}) => (
  <>
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Type</InputLabel>
          <Select value={filterType} label="Filter by Type" onChange={onFilterChange}>
            <MenuItem value="all">All Items ({typeCounts.all})</MenuItem>
            <MenuItem value="meeting">Meetings ({typeCounts.meeting})</MenuItem>
            <MenuItem value="milestone">Milestones ({typeCounts.milestone})</MenuItem>
            <MenuItem value="action_item">Action Items ({typeCounts.action_item})</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ ml: 'auto' }}>
          <Button variant="contained" size="small" onClick={onAddActionItem}>
            Add Action Item
          </Button>
        </Box>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
          Date Range:
        </Typography>

        <TextField
          type="date"
          label="From"
          size="small"
          value={dateRangeStart}
          onChange={(e) => onStartChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        <TextField
          type="date"
          label="To"
          size="small"
          value={dateRangeEnd}
          onChange={(e) => onEndChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        <Box sx={{ borderLeft: `1px solid ${isDarkMode ? '#555' : '#e0e0e0'}`, pl: 2, ml: 1 }}>
          <Typography variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
            Quick Presets:
          </Typography>
          <Stack direction="row" spacing={1}>
            {['thisWeek', 'thisMonth', 'next30days', 'next3months', 'allData'].map((preset) => (
              <Button
                key={preset}
                size="small"
                variant="outlined"
                onClick={() => onApplyPreset(preset)}
              >
                {preset === 'thisWeek'
                  ? 'This Week'
                  : preset === 'thisMonth'
                    ? 'This Month'
                    : preset === 'next30days'
                      ? 'Next 30 Days'
                      : preset === 'next3months'
                        ? 'Next 3 Months'
                        : 'All Data'}
              </Button>
            ))}
          </Stack>
        </Box>

        <Box sx={{ ml: 'auto' }}>
          <Typography variant="caption" color="text.secondary">
            Showing: {new Date(dateRangeStart).toLocaleDateString()} –{' '}
            {new Date(dateRangeEnd).toLocaleDateString()}
          </Typography>
        </Box>
      </Stack>
    </Paper>

    {/* Legend */}
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" sx={{ mr: 1 }}>
          Legend:
        </Typography>
        <Chip label="Meetings" size="small" sx={{ bgcolor: '#4CAF50', color: 'white' }} />
        <Chip label="Milestones" size="small" sx={{ bgcolor: '#9C27B0', color: 'white' }} />
        <Chip label="Action Items" size="small" sx={{ bgcolor: '#2196F3', color: 'white' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
          <Box sx={{ width: 20, height: 3, bgcolor: '#f44336', mr: 0.5 }} />
          <Typography variant="caption">Today</Typography>
        </Box>
      </Stack>
    </Paper>
  </>
);

export default GanttToolbar;
