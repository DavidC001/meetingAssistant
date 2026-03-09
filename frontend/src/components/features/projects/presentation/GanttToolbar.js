import React from 'react';
import {
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

// Centralized Gantt color palette — must stay in sync with backend get_gantt_data().
const GANTT_COLORS = {
  meeting: '#5C6BC0',
  milestonePending: '#FF7043',
  milestoneCompleted: '#8D6E63',
  actionPending: '#FFA726',
  actionInProgress: '#26A69A',
  actionCompleted: '#66BB6A',
  actionCancelled: '#78909C',
  todayLine: '#EF5350',
};

const LegendDot = ({ color, label }) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
      }}
    />
    <Typography variant="caption" sx={{ lineHeight: 1 }}>
      {label}
    </Typography>
  </Stack>
);

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
    <Paper sx={{ px: 2, py: 1.5, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* Item Types */}
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
          Types:
        </Typography>
        <LegendDot color={GANTT_COLORS.meeting} label="Meetings" />
        <LegendDot color={GANTT_COLORS.milestonePending} label="Milestones" />
        <LegendDot color={GANTT_COLORS.milestoneCompleted} label="Milestones (done)" />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Action Item Statuses */}
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
          Action Items:
        </Typography>
        <LegendDot color={GANTT_COLORS.actionPending} label="Pending" />
        <LegendDot color={GANTT_COLORS.actionInProgress} label="In Progress" />
        <LegendDot color={GANTT_COLORS.actionCompleted} label="Completed" />
        <LegendDot color={GANTT_COLORS.actionCancelled} label="Cancelled" />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Today marker */}
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 18, height: 3, bgcolor: GANTT_COLORS.todayLine, borderRadius: 1 }} />
          <Typography variant="caption">Today</Typography>
        </Stack>
      </Stack>
    </Paper>
  </>
);

export default GanttToolbar;
