import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Switch,
  FormControlLabel,
  Skeleton,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  InputLabel,
  FormControl,
  Grid,
  Alert,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  Flag as FlagIcon,
  FilterList as FilterListIcon,
  AssignmentTurnedIn as TaskIcon,
  HourglassEmpty as PendingIcon,
  PlayCircleOutline as InProgressIcon,
  CheckCircleOutline as CompletedIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

const priorityConfig = {
  high: { color: '#d32f2f', label: 'High' },
  medium: { color: '#ed6c02', label: 'Medium' },
  low: { color: '#2e7d32', label: 'Low' },
  none: { color: '#757575', label: 'No Priority' },
};

const columnConfig = {
  pending: {
    label: 'Pending',
    icon: PendingIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  'in-progress': {
    label: 'In Progress',
    icon: InProgressIcon,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  completed: {
    label: 'Completed',
    icon: CompletedIcon,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
};

// Portal component for dragging - fixes the position issue
const PortalAwareItem = ({ provided, snapshot, children }) => {
  const usePortal = snapshot.isDragging;

  const child = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={provided.draggableProps.style}
    >
      {children}
    </div>
  );

  if (!usePortal) {
    return child;
  }

  // Use portal when dragging to fix position issues
  return ReactDOM.createPortal(child, document.body);
};

const KanbanBoard = () => {
  const [columns, setColumns] = useState({
    pending: [],
    'in-progress': [],
    completed: [],
  });
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    task: '',
    owner: '',
    priority: 'medium',
    due_date: '',
  });

  // Add task dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    task: '',
    owner: '',
    priority: 'medium',
    due_date: '',
    status: 'pending',
  });

  // User filter state
  const [filterUserName, setFilterUserName] = useState(() => {
    return localStorage.getItem('kanbanUserName') || '';
  });
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(() => {
    return localStorage.getItem('kanbanShowOnlyMyTasks') === 'true';
  });
  const [timeHorizon, setTimeHorizon] = useState(() => {
    return localStorage.getItem('kanbanTimeHorizon') || '3months';
  });

  // Time horizon options
  const timeHorizonOptions = [
    { value: '1week', label: 'Next Week' },
    { value: '2weeks', label: 'Next 2 Weeks' },
    { value: '1month', label: 'Next Month' },
    { value: '3months', label: 'Next 3 Months' },
    { value: '6months', label: 'Next 6 Months' },
    { value: '1year', label: 'Next Year' },
    { value: 'all', label: 'All Time' },
  ];

  // Debounce the filter fetch - wait for user to stop typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchActionItems();
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [showOnlyMyTasks, filterUserName, timeHorizon]);

  // Save filter preferences
  useEffect(() => {
    localStorage.setItem('kanbanUserName', filterUserName);
  }, [filterUserName]);

  useEffect(() => {
    localStorage.setItem('kanbanShowOnlyMyTasks', showOnlyMyTasks.toString());
  }, [showOnlyMyTasks]);

  useEffect(() => {
    localStorage.setItem('kanbanTimeHorizon', timeHorizon);
  }, [timeHorizon]);

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/calendar/action-items`);

      // Filter action items based on time horizon
      const now = new Date();
      let timeLimit = new Date();

      switch (timeHorizon) {
        case '1week':
          timeLimit.setDate(now.getDate() + 7);
          break;
        case '2weeks':
          timeLimit.setDate(now.getDate() + 14);
          break;
        case '1month':
          timeLimit.setMonth(now.getMonth() + 1);
          break;
        case '3months':
          timeLimit.setMonth(now.getMonth() + 3);
          break;
        case '6months':
          timeLimit.setMonth(now.getMonth() + 6);
          break;
        case '1year':
          timeLimit.setFullYear(now.getFullYear() + 1);
          break;
        case 'all':
        default:
          timeLimit = null; // No time limit
          break;
      }

      let filteredItems = response.data.filter((item) => {
        if (!item.due_date) return true; // Include items without due date
        if (!timeLimit) return true; // No time limit (show all)
        const dueDate = new Date(item.due_date);
        // Include items within time horizon OR expired items that are not completed
        const isExpiredIncomplete = dueDate < now && item.status !== 'completed';
        return isExpiredIncomplete || (dueDate >= now && dueDate <= timeLimit);
      });

      // Apply user filter if enabled
      if (showOnlyMyTasks && filterUserName) {
        filteredItems = filteredItems.filter((item) => {
          if (!item.owner) return false;
          return item.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim();
        });
      }

      // Group action items by status
      const grouped = {
        pending: [],
        'in-progress': [],
        completed: [],
      };

      filteredItems.forEach((item) => {
        // Normalize status - handle both 'in-progress' and 'in_progress' formats
        let status = item.status || 'pending';
        status = status.replace('_', '-');
        if (grouped[status]) {
          grouped[status].push(item);
        } else {
          // Default to pending if status is not recognized
          grouped['pending'].push(item);
        }
      });

      setColumns(grouped);
    } catch (error) {
      console.error('Error fetching action items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) return;

    // No change in position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Get the task
    const sourceColumn = Array.from(columns[source.droppableId]);
    const destColumn =
      source.droppableId === destination.droppableId
        ? sourceColumn
        : Array.from(columns[destination.droppableId]);

    const [movedTask] = sourceColumn.splice(source.index, 1);

    // Update task status
    movedTask.status = destination.droppableId;

    if (source.droppableId === destination.droppableId) {
      // Reorder within same column
      sourceColumn.splice(destination.index, 0, movedTask);
      setColumns({
        ...columns,
        [source.droppableId]: sourceColumn,
      });
    } else {
      // Move to different column
      destColumn.splice(destination.index, 0, movedTask);
      setColumns({
        ...columns,
        [source.droppableId]: sourceColumn,
        [destination.droppableId]: destColumn,
      });
    }

    // Update on server
    try {
      await axios.put(`${API_BASE_URL}/calendar/action-items/${movedTask.id}`, {
        status: destination.droppableId,
      });
    } catch (error) {
      console.error('Error updating action item:', error);
      // Revert on error
      fetchActionItems();
    }
  };

  const handleMenuOpen = (event, task) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const handleDelete = async () => {
    if (!selectedTask) return;

    try {
      await axios.delete(`${API_BASE_URL}/calendar/action-items/${selectedTask.id}`);
      fetchActionItems();
    } catch (error) {
      console.error('Error deleting action item:', error);
    } finally {
      handleMenuClose();
    }
  };

  const handleEditOpen = () => {
    if (!selectedTask) return;
    setEditForm({
      id: selectedTask.id,
      task: selectedTask.task || '',
      owner: selectedTask.owner || '',
      priority: selectedTask.priority || 'medium',
      due_date: selectedTask.due_date ? selectedTask.due_date.split('T')[0] : '',
    });
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedTask(null);
  };

  const handleEditSave = async () => {
    console.log('handleEditSave called, editForm:', editForm);
    if (!editForm.id) {
      console.log('No editForm.id, returning early');
      return;
    }
    if (!editForm.task.trim()) {
      console.log('No task text, returning early');
      return;
    }

    try {
      console.log('Sending PUT request to update action item:', editForm.id);
      const response = await axios.put(`${API_BASE_URL}/calendar/action-items/${editForm.id}`, {
        task: editForm.task,
        owner: editForm.owner,
        priority: editForm.priority,
        due_date: editForm.due_date || null,
      });
      console.log('Updated action item:', response.data);
      await fetchActionItems();
      handleEditClose();
    } catch (error) {
      console.error('Error updating action item:', error);
      alert('Failed to update task: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Add task handlers
  const handleAddOpen = (status = 'pending') => {
    setAddForm({
      task: '',
      owner: filterUserName || '', // Default to the "My Name" filter value
      priority: 'medium',
      due_date: '',
      status: status,
    });
    setAddDialogOpen(true);
  };

  const handleAddClose = () => {
    setAddDialogOpen(false);
  };

  const handleAddSave = async () => {
    if (!addForm.task.trim()) return;

    try {
      await axios.post(`${API_BASE_URL}/calendar/action-items`, {
        task: addForm.task,
        owner: addForm.owner || null,
        priority: addForm.priority,
        due_date: addForm.due_date || null,
        status: addForm.status,
      });
      fetchActionItems();
      handleAddClose();
    } catch (error) {
      console.error('Error creating action item:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now && date.toDateString() !== now.toDateString();
    const isToday = date.toDateString() === now.toDateString();
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue,
      isToday,
    };
  };

  const getTotalTasks = () => {
    return Object.values(columns).reduce((sum, tasks) => sum + tasks.length, 0);
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
      {/* Header - constrained to match kanban columns width */}
      <Box sx={{ maxWidth: 'calc(3 * 380px + 2 * 20px)', width: '100%' }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h5" component="h2">
              Action Items Board
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {getTotalTasks()} tasks • Drag to update status
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleAddOpen('pending')}
                size="small"
                sx={{ borderRadius: 2 }}
              >
                Add Task
              </Button>
            </Box>
          </Box>

          {/* User Filter Controls */}
          <Card sx={{ mb: 2, bgcolor: 'action.hover' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Filter Settings
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label="My Name"
                  placeholder="Enter your name"
                  value={filterUserName}
                  onChange={(e) => setFilterUserName(e.target.value)}
                  sx={{ minWidth: 200, flex: '1 1 200px', maxWidth: 280 }}
                />
                <FormControl size="small" sx={{ minWidth: 150, flex: '0 1 180px' }}>
                  <InputLabel>Time Horizon</InputLabel>
                  <Select
                    value={timeHorizon}
                    label="Time Horizon"
                    onChange={(e) => setTimeHorizon(e.target.value)}
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
                      onChange={(e) => setShowOnlyMyTasks(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Show only my tasks"
                  sx={{ m: 0 }}
                />
              </Box>
              {showOnlyMyTasks && !filterUserName && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Enter your name to filter tasks
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label="High Priority"
              size="small"
              sx={{ bgcolor: 'error.main', color: 'white' }}
            />
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
            {filterUserName && !showOnlyMyTasks && (
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
        </Paper>
      </Box>

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
            '&::-webkit-scrollbar-track': { bgcolor: 'grey.100', borderRadius: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.300', borderRadius: 4 },
          }}
        >
          {Object.entries(columns).map(([columnId, tasks]) => {
            const config = columnConfig[columnId];
            const Icon = config.icon;

            return (
              <Paper
                key={columnId}
                elevation={0}
                sx={{
                  minWidth: 340,
                  maxWidth: 380,
                  flex: '1 1 340px',
                  bgcolor: 'background.paper',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Column Header */}
                <Box
                  sx={{
                    p: 2,
                    background: config.gradient,
                    color: 'white',
                  }}
                >
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Icon />
                      <Typography variant="h6" fontWeight={700}>
                        {config.label}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleAddOpen(columnId)}
                      sx={{
                        color: 'white',
                        opacity: 0.8,
                        '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.2)' },
                      }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                  </Typography>
                </Box>

                {/* Droppable Column */}
                <Droppable droppableId={columnId}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        p: 1.5,
                        flex: 1,
                        minHeight: 400,
                        bgcolor: snapshot.isDraggingOver
                          ? alpha(
                              config.gradient.includes('#667eea')
                                ? '#667eea'
                                : config.gradient.includes('#f093fb')
                                  ? '#f093fb'
                                  : '#4facfe',
                              0.08
                            )
                          : 'transparent',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      {tasks.length === 0 && !snapshot.isDraggingOver && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            py: 6,
                            opacity: 0.5,
                          }}
                        >
                          <Icon sx={{ fontSize: 48, mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            No tasks here
                          </Typography>
                        </Box>
                      )}
                      {tasks.map((task, index) => {
                        // Check if this is the user's task (only highlight when not filtering to only my tasks)
                        const isMyTask =
                          !showOnlyMyTasks &&
                          filterUserName &&
                          task.owner &&
                          task.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim();

                        return (
                          <Draggable
                            key={task.id.toString()}
                            draggableId={task.id.toString()}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <PortalAwareItem provided={provided} snapshot={snapshot}>
                                <Card
                                  elevation={snapshot.isDragging ? 8 : isMyTask ? 2 : 1}
                                  sx={{
                                    mb: 1.5,
                                    cursor: 'grab',
                                    borderRadius: 2.5,
                                    border: '1px solid',
                                    borderColor: snapshot.isDragging
                                      ? 'primary.main'
                                      : 'transparent',
                                    bgcolor: isMyTask
                                      ? 'rgba(33, 150, 243, 0.04)'
                                      : 'background.paper',
                                    transform: snapshot.isDragging
                                      ? 'rotate(3deg) scale(1.02)'
                                      : 'none',
                                    transition: snapshot.isDragging ? 'none' : 'all 0.2s ease',
                                    boxShadow: isMyTask
                                      ? 'inset 0 0 0 2px rgba(33, 150, 243, 0.25), 0 2px 8px rgba(33, 150, 243, 0.15)'
                                      : undefined,
                                    '&:hover': {
                                      boxShadow: isMyTask
                                        ? 'inset 0 0 0 2px rgba(33, 150, 243, 0.4), 0 4px 12px rgba(33, 150, 243, 0.2)'
                                        : 4,
                                      borderColor: 'primary.light',
                                      transform: 'translateY(-2px)',
                                    },
                                    '&:active': {
                                      cursor: 'grabbing',
                                    },
                                  }}
                                >
                                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    {/* Task Header */}
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        mb: 1.5,
                                      }}
                                    >
                                      {(() => {
                                        const priority = task.priority || 'none';
                                        const config =
                                          priorityConfig[priority] || priorityConfig.none;
                                        return (
                                          <Chip
                                            icon={<FlagIcon sx={{ fontSize: '14px !important' }} />}
                                            label={config.label}
                                            size="small"
                                            sx={{
                                              bgcolor: config.bgColor,
                                              color: config.color,
                                              fontWeight: 600,
                                              fontSize: '0.7rem',
                                              height: 24,
                                              '& .MuiChip-icon': {
                                                color: config.color,
                                              },
                                            }}
                                          />
                                        );
                                      })()}
                                      <IconButton
                                        size="small"
                                        onClick={(e) => handleMenuOpen(e, task)}
                                        sx={{
                                          mt: -0.5,
                                          mr: -0.5,
                                          opacity: 0.6,
                                          '&:hover': { opacity: 1 },
                                        }}
                                      >
                                        <MoreVertIcon fontSize="small" />
                                      </IconButton>
                                    </Box>

                                    {/* Task Description */}
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        mb: 2,
                                        fontWeight: 500,
                                        lineHeight: 1.5,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        color: 'text.primary',
                                      }}
                                    >
                                      {task.task}
                                    </Typography>

                                    {/* Task Meta */}
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        gap: 1,
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      {task.owner && (
                                        <Chip
                                          avatar={
                                            <Avatar
                                              sx={{
                                                width: 22,
                                                height: 22,
                                                fontSize: '0.7rem',
                                                bgcolor: 'primary.main',
                                              }}
                                            >
                                              {task.owner[0]?.toUpperCase()}
                                            </Avatar>
                                          }
                                          label={task.owner}
                                          size="small"
                                          sx={{
                                            height: 26,
                                            bgcolor: 'grey.100',
                                            '& .MuiChip-label': { fontSize: '0.75rem' },
                                          }}
                                        />
                                      )}
                                      {task.due_date &&
                                        (() => {
                                          const { text, isOverdue, isToday } = formatDate(
                                            task.due_date
                                          );
                                          return (
                                            <Chip
                                              icon={
                                                <CalendarIcon
                                                  sx={{ fontSize: '14px !important' }}
                                                />
                                              }
                                              label={isToday ? 'Today' : text}
                                              size="small"
                                              sx={{
                                                height: 26,
                                                bgcolor: isOverdue
                                                  ? '#ffebee'
                                                  : isToday
                                                    ? '#e3f2fd'
                                                    : 'grey.100',
                                                color: isOverdue
                                                  ? '#d32f2f'
                                                  : isToday
                                                    ? '#1976d2'
                                                    : 'text.secondary',
                                                '& .MuiChip-icon': {
                                                  color: isOverdue
                                                    ? '#d32f2f'
                                                    : isToday
                                                      ? '#1976d2'
                                                      : 'text.secondary',
                                                },
                                                '& .MuiChip-label': { fontSize: '0.75rem' },
                                              }}
                                            />
                                          );
                                        })()}
                                    </Box>
                                  </CardContent>
                                </Card>
                              </PortalAwareItem>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Paper>
            );
          })}
        </Box>
      </DragDropContext>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
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
        <MenuItem onClick={handleEditOpen}>
          <ListItemIcon>
            <EditIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleEditClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Edit Action Item
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            <TextField
              label="Task Description"
              value={editForm.task}
              onChange={(e) => setEditForm({ ...editForm, task: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Assigned To"
                value={editForm.owner}
                onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={editForm.priority}
                  label="Priority"
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                >
                  <MenuItem value="high">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FlagIcon sx={{ color: '#d32f2f', fontSize: 18 }} />
                      High
                    </Box>
                  </MenuItem>
                  <MenuItem value="medium">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FlagIcon sx={{ color: '#ed6c02', fontSize: 18 }} />
                      Medium
                    </Box>
                  </MenuItem>
                  <MenuItem value="low">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FlagIcon sx={{ color: '#2e7d32', fontSize: 18 }} />
                      Low
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
            <TextField
              label="Due Date"
              type="date"
              value={editForm.due_date}
              onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button
            type="button"
            onClick={handleEditClose}
            startIcon={<CloseIcon />}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleEditSave}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{ borderRadius: 2 }}
            disabled={!editForm.task.trim()}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={handleAddClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Add New Task
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            <TextField
              label="Task Description"
              value={addForm.task}
              onChange={(e) => setAddForm({ ...addForm, task: e.target.value })}
              multiline
              rows={3}
              fullWidth
              autoFocus
              placeholder="What needs to be done?"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Assigned To"
                value={addForm.owner}
                onChange={(e) => setAddForm({ ...addForm, owner: e.target.value })}
                fullWidth
                placeholder="Enter name"
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={addForm.status}
                  label="Status"
                  onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                >
                  <MenuItem value="pending">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PendingIcon sx={{ fontSize: 18 }} />
                      Pending
                    </Box>
                  </MenuItem>
                  <MenuItem value="in-progress">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InProgressIcon sx={{ fontSize: 18 }} />
                      In Progress
                    </Box>
                  </MenuItem>
                  <MenuItem value="completed">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CompletedIcon sx={{ fontSize: 18 }} />
                      Completed
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={addForm.priority}
                  label="Priority"
                  onChange={(e) => setAddForm({ ...addForm, priority: e.target.value })}
                >
                  <MenuItem value="high">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FlagIcon sx={{ color: '#d32f2f', fontSize: 18 }} />
                      High
                    </Box>
                  </MenuItem>
                  <MenuItem value="medium">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FlagIcon sx={{ color: '#ed6c02', fontSize: 18 }} />
                      Medium
                    </Box>
                  </MenuItem>
                  <MenuItem value="low">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FlagIcon sx={{ color: '#2e7d32', fontSize: 18 }} />
                      Low
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Due Date"
                type="date"
                value={addForm.due_date}
                onChange={(e) => setAddForm({ ...addForm, due_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={handleAddClose} startIcon={<CloseIcon />} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleAddSave}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ borderRadius: 2 }}
            disabled={!addForm.task.trim()}
          >
            Add Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KanbanBoard;
