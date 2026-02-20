/**
 * KanbanHeader Component
 * Presents header with title, task count, and action buttons (Add Task, Add Existing)
 */

import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const KanbanHeader = ({
  headerTitle = 'Action Items Board',
  headerSubtitle = '',
  totalTasks = 0,
  allowAdd = true,
  isProjectMode = false,
  onAddTask,
  onAddExisting,
  showHeader = true,
}) => {
  if (!showHeader) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mb: 2, maxWidth: 'calc(3 * 380px + 2 * 20px)', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" component="h2">
            {headerTitle}
          </Typography>
          {headerSubtitle && (
            <Typography variant="body2" color="text.secondary">
              {headerSubtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {totalTasks} tasks • Drag to update status
          </Typography>
          {allowAdd && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAddTask}
                size="small"
                sx={{ borderRadius: 2 }}
              >
                Add Task
              </Button>
              {isProjectMode && (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={onAddExisting}
                  size="small"
                  sx={{ borderRadius: 2 }}
                >
                  Add Existing
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default KanbanHeader;
