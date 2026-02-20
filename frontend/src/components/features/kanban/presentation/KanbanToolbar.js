/**
 * KanbanToolbar Component
 * Presents filter controls for kanban board (time horizon, search, show-only-my-tasks, etc)
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Chip,
} from '@mui/material';

const KanbanToolbar = ({
  // Global mode filters
  filterUserName = '',
  onFilterUserNameChange,
  showOnlyMyTasks = false,
  onShowOnlyMyTasksChange,
  timeHorizon = 'all',
  onTimeHorizonChange,
  showFilters = true,
  isProjectMode = false,

  // Project mode filters
  searchQuery = '',
  onSearchQueryChange,
  showCompleted = true,
  onShowCompletedChange,

  // Legend
  showLegend = true,
}) => {
  const timeHorizonOptions = [
    { value: '1week', label: 'Next Week' },
    { value: '2weeks', label: 'Next 2 Weeks' },
    { value: '1month', label: 'Next Month' },
    { value: '3months', label: 'Next 3 Months' },
    { value: '6months', label: 'Next 6 Months' },
    { value: '1year', label: 'Next Year' },
    { value: 'all', label: 'All Time' },
  ];

  if (!showFilters) {
    return null;
  }

  return (
    <>
      <Card sx={{ mb: 2, bgcolor: 'action.hover' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            {isProjectMode ? 'Filters' : 'Filter Settings'}
          </Typography>

          {/* Global mode filters */}
          {!isProjectMode && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                label="My Name"
                placeholder="Enter your name"
                value={filterUserName}
                onChange={(e) => onFilterUserNameChange(e.target.value)}
                sx={{ minWidth: 200, flex: '1 1 200px', maxWidth: 280 }}
              />
              <FormControl size="small" sx={{ minWidth: 150, flex: '0 1 180px' }}>
                <InputLabel>Time Horizon</InputLabel>
                <Select
                  value={timeHorizon}
                  label="Time Horizon"
                  onChange={(e) => onTimeHorizonChange(e.target.value)}
                >
                  {timeHorizonOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={showOnlyMyTasks}
                    onChange={(e) => onShowOnlyMyTasksChange(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show only my tasks"
                sx={{ m: 0 }}
              />
            </Box>
          )}

          {/* Project mode filters */}
          {isProjectMode && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                label="Search"
                placeholder="Search action items"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                sx={{ minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showCompleted}
                    onChange={(e) => onShowCompletedChange(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show completed"
                sx={{ m: 0 }}
              />
            </Box>
          )}

          {showOnlyMyTasks && !filterUserName && !isProjectMode && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Enter your name to filter tasks
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      {showLegend && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Chip label="High Priority" size="small" sx={{ bgcolor: 'error.main', color: 'white' }} />
          <Chip
            label="Medium Priority"
            size="small"
            sx={{ bgcolor: 'warning.main', color: 'white' }}
          />
          <Chip
            label="Low Priority"
            size="small"
            sx={{ bgcolor: 'success.main', color: 'white' }}
          />
          <Chip label="No Priority" size="small" sx={{ bgcolor: 'grey.500', color: 'white' }} />
          {filterUserName && !showOnlyMyTasks && !isProjectMode && (
            <Chip
              label="My Task (highlighted)"
              size="small"
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)',
              }}
            />
          )}
        </Box>
      )}
    </>
  );
};

export default KanbanToolbar;
