/**
 * KanbanBoardContainer Component
 * Orchestrates kanban board with hooks, dialogs, and presentation
 * Replaces the monolithic KanbanBoard.js with modular architecture
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Paper,
  useTheme,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DragDropContext } from 'react-beautiful-dnd';

import { useActionItems } from '../hooks';
import ConfirmDialog from '../../../common/ConfirmDialog';
import {
  KanbanHeader,
  KanbanToolbar,
  KanbanColumn,
  KanbanEditDialog,
  KanbanAddDialog,
  KanbanAddExistingDialog,
} from '../presentation';

import { getPriorityConfig, getColumnConfig } from '../../../../utils/kanbanConfig';
import { getDateChipInfo } from '../../../../utils';

const KanbanBoardContainer = ({
  mode = 'global',
  projectId,
  transcriptionId,
  initialItems,
  showHeader = true,
  showFilters = true,
  allowAdd = true,
  allowEdit = true,
  allowDelete = true,
  defaultShowCompleted = true,
  headerTitle,
  headerSubtitle,
  defaultOwner = '',
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Get theme-aware configs
  const priorityConfig = getPriorityConfig(isDarkMode);
  const columnConfig = getColumnConfig(isDarkMode);

  // Filters state
  const [filterUserName, setFilterUserName] = useState(() => {
    if (mode === 'project' || !showFilters) return '';
    return localStorage.getItem(`kanban-userName`) || '';
  });

  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(() => {
    if (mode === 'project' || !showFilters) return false;
    return localStorage.getItem(`kanban-showOnlyMyTasks`) === 'true';
  });

  const [timeHorizon, setTimeHorizon] = useState(() => {
    if (mode === 'project' || !showFilters) return 'all';
    return localStorage.getItem(`kanban-timeHorizon`) || '3months';
  });

  const [showCompleted, setShowCompleted] = useState(defaultShowCompleted);
  const [searchQuery, setSearchQuery] = useState('');

  // Hook for action items management
  const {
    columns,
    loading,
    isProjectMode,
    isMeetingMode,
    updateItemStatus,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    deleteActionItemPermanently,
    linkExistingItem,
  } = useActionItems({
    mode,
    projectId,
    transcriptionId,
    initialItems,
    filterUserName,
    showOnlyMyTasks,
    timeHorizon,
    showCompleted,
    searchQuery,
  });

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addExistingDialogOpen, setAddExistingDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Task selection state
  const [selectedTask, setSelectedTask] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [deleteType, setDeleteType] = useState('unlink'); // 'unlink' or 'global'

  // Save filter preferences
  useEffect(() => {
    if (mode === 'project' || !showFilters) return;
    localStorage.setItem('kanban-userName', filterUserName);
  }, [filterUserName, mode, showFilters]);

  useEffect(() => {
    if (mode === 'project' || !showFilters) return;
    localStorage.setItem('kanban-showOnlyMyTasks', showOnlyMyTasks.toString());
  }, [showOnlyMyTasks, mode, showFilters]);

  useEffect(() => {
    if (mode === 'project' || !showFilters) return;
    localStorage.setItem('kanban-timeHorizon', timeHorizon);
  }, [timeHorizon, mode, showFilters]);

  // Drag-drop handler
  const handleDragEnd = async (result) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceItems = Array.from(columns[source.droppableId] || []);
    const movedTask = sourceItems[source.index];

    if (movedTask) {
      await updateItemStatus(movedTask.id, destination.droppableId);
    }
  };

  // Menu handlers
  const handleMenuOpen = (event, task) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = (keepSelected = false) => {
    setAnchorEl(null);
    if (!keepSelected) {
      setSelectedTask(null);
    }
  };

  // Edit handlers
  const handleEditOpen = () => {
    if (selectedTask) {
      setEditDialogOpen(true);
      handleMenuClose(true); // keep selectedTask so the dialog receives a valid task prop
    }
  };

  const handleEditSave = async (form) => {
    if (!form.id) return;

    const payload = {
      task: form.task,
      owner: form.owner,
      priority: form.priority,
      due_date: form.due_date || null,
    };

    const success = await updateActionItem(form.id, payload);
    if (success) {
      setEditDialogOpen(false);
      setSelectedTask(null);
    }
  };

  // Add handlers
  const handleAddOpen = (status = 'pending') => {
    setAddDialogOpen(true);
  };

  const handleAddSave = async (form, projectIds = []) => {
    const payload = {
      task: form.task,
      owner: form.owner || null,
      priority: form.priority,
      due_date: form.due_date || null,
      status: form.status,
    };

    const success = await createActionItem(payload, projectIds);
    if (success) {
      setAddDialogOpen(false);
    }
  };

  // Add existing handler
  const handleAddExistingOpen = () => {
    setAddExistingDialogOpen(true);
  };

  const handleLinkExisting = async (itemId) => {
    const success = await linkExistingItem(itemId);
    if (success) {
      setAddExistingDialogOpen(false);
    }
  };

  // Delete handlers
  const handleDeleteClick = () => {
    if (!selectedTask) return;

    if (isProjectMode && !isMeetingMode) {
      // In project mode, unlink is the default
      deleteActionItem(selectedTask.id);
      handleMenuClose();
    } else {
      // In global/meeting mode, prompt before deleting
      setDeleteType('global');
      setDeleteConfirmOpen(true);
      handleMenuClose(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTask) return;

    if (deleteType === 'global') {
      await deleteActionItemPermanently(selectedTask.id);
    } else {
      await deleteActionItem(selectedTask.id);
    }

    setDeleteConfirmOpen(false);
    handleMenuClose();
  };

  // Get total tasks count
  const getTotalTasks = () => {
    return Object.values(columns).reduce((sum, tasks) => sum + (tasks?.length || 0), 0);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3].map((i) => (
            <Paper key={i} sx={{ flex: 1, p: 2, minWidth: 300 }}>
              <Skeleton variant="text" width={120} height={32} />
              <Skeleton variant="text" width={60} height={20} sx={{ mb: 2 }} />
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} variant="rounded" height={120} sx={{ mb: 2 }} />
              ))}
            </Paper>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showHeader && (
        <Box sx={{ maxWidth: 'calc(3 * 380px + 2 * 20px)', width: '100%' }}>
          <KanbanHeader
            headerTitle={headerTitle || 'Action Items Board'}
            headerSubtitle={headerSubtitle}
            totalTasks={getTotalTasks()}
            allowAdd={allowAdd}
            isProjectMode={isProjectMode}
            onAddTask={() => handleAddOpen('pending')}
            onAddExisting={handleAddExistingOpen}
            showHeader={showHeader}
          />
        </Box>
      )}

      <KanbanToolbar
        // Global mode
        filterUserName={filterUserName}
        onFilterUserNameChange={setFilterUserName}
        showOnlyMyTasks={showOnlyMyTasks}
        onShowOnlyMyTasksChange={setShowOnlyMyTasks}
        timeHorizon={timeHorizon}
        onTimeHorizonChange={setTimeHorizon}
        // Project mode
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        showCompleted={showCompleted}
        onShowCompletedChange={setShowCompleted}
        // Common
        showFilters={showFilters}
        isProjectMode={isProjectMode}
        showLegend={showHeader}
      />

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Box
          sx={{
            display: 'flex',
            gap: 2.5,
            flex: 1,
            overflowX: 'auto',
            pb: 2,
            '&::-webkit-scrollbar': { height: 8 },
            '&::-webkit-scrollbar-track': {
              bgcolor: isDarkMode ? 'grey.800' : 'grey.100',
              borderRadius: 4,
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDarkMode ? 'grey.600' : 'grey.300',
              borderRadius: 4,
            },
          }}
        >
          {Object.entries(columns).map(([columnId, tasks]) => {
            const config = columnConfig[columnId];

            return (
              <KanbanColumn
                key={columnId}
                columnId={columnId}
                tasks={tasks || []}
                config={config}
                allowEdit={allowEdit}
                allowDelete={allowDelete}
                showOnlyMyTasks={showOnlyMyTasks}
                filterUserName={filterUserName}
                priorityConfig={priorityConfig}
                isDarkMode={isDarkMode}
                onMenuOpen={handleMenuOpen}
                formatDate={getDateChipInfo}
              />
            );
          })}
        </Box>
      </DragDropContext>

      {/* Context Menu */}
      {(allowEdit || allowDelete) && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => handleMenuClose()}
          PaperProps={{
            elevation: 3,
            sx: {
              borderRadius: 2,
              minWidth: 140,
              '& .MuiMenuItem-root': {
                borderRadius: 1,
                mx: 0.5,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              },
            },
          }}
        >
          {allowEdit && (
            <MenuItem onClick={handleEditOpen}>
              <ListItemIcon>
                <EditIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          )}
          {allowDelete && selectedTask && (
            <>
              {isProjectMode && !isMeetingMode ? (
                <>
                  <MenuItem onClick={handleDeleteClick}>
                    <ListItemIcon>
                      <DeleteIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    <ListItemText sx={{ color: 'warning.main' }}>Remove from Project</ListItemText>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setDeleteType('global');
                      setDeleteConfirmOpen(true);
                      handleMenuClose(true);
                    }}
                  >
                    <ListItemIcon>
                      <DeleteIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText sx={{ color: 'error.main' }}>Delete Permanently</ListItemText>
                  </MenuItem>
                </>
              ) : (
                <MenuItem onClick={handleDeleteClick}>
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
                </MenuItem>
              )}
            </>
          )}
        </Menu>
      )}

      {/* Edit Dialog */}
      {allowEdit && (
        <KanbanEditDialog
          open={editDialogOpen}
          task={selectedTask}
          isProjectMode={isProjectMode}
          projectId={projectId}
          onSave={handleEditSave}
          onCancel={() => {
            setEditDialogOpen(false);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Add Dialog */}
      {allowAdd && (
        <KanbanAddDialog
          open={addDialogOpen}
          isProjectMode={isProjectMode}
          projectId={projectId}
          defaultStatus="pending"
          defaultOwner={defaultOwner || filterUserName}
          onSave={handleAddSave}
          onCancel={() => setAddDialogOpen(false)}
        />
      )}

      {/* Add Existing Dialog */}
      {allowAdd && isProjectMode && (
        <KanbanAddExistingDialog
          open={addExistingDialogOpen}
          projectId={projectId}
          onSave={handleLinkExisting}
          onCancel={() => setAddExistingDialogOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={deleteType === 'global' ? 'Delete Action Item Permanently' : 'Remove from Project'}
        message={
          deleteType === 'global'
            ? `This will permanently delete "${selectedTask?.task}" from the system, not just remove it from this project.`
            : `Are you sure you want to remove "${selectedTask?.task}" from this project?`
        }
        confirmLabel={deleteType === 'global' ? 'Delete Permanently' : 'Remove'}
        confirmColor={deleteType === 'global' ? 'error' : 'warning'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </Box>
  );
};

export default KanbanBoardContainer;
