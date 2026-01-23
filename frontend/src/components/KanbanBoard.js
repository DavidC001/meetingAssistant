import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Button,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

const priorityColors = {
  high: '#f44336',
  medium: '#ff9800',
  low: '#4caf50',
};

const statusLabels = {
  'to-do': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
};

const KanbanBoard = () => {
  const [columns, setColumns] = useState({
    'to-do': [],
    'in-progress': [],
    'done': [],
  });
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchActionItems();
  }, []);

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/action-items/`);
      
      // Group action items by status
      const grouped = {
        'to-do': [],
        'in-progress': [],
        'done': [],
      };

      response.data.forEach(item => {
        const status = item.status || 'to-do';
        if (grouped[status]) {
          grouped[status].push(item);
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
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Get the task
    const sourceColumn = Array.from(columns[source.droppableId]);
    const destColumn = source.droppableId === destination.droppableId
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
      await axios.put(
        `${API_BASE_URL}/action-items/${movedTask.id}`,
        { status: destination.droppableId }
      );
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
      await axios.delete(`${API_BASE_URL}/action-items/${selectedTask.id}`);
      fetchActionItems();
    } catch (error) {
      console.error('Error deleting action item:', error);
    } finally {
      handleMenuClose();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now;
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue,
    };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Action Items Board
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Drag tasks between columns to update their status
          </Typography>
        </Box>
      </Box>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
          {Object.entries(columns).map(([columnId, tasks]) => (
            <Paper
              key={columnId}
              sx={{
                minWidth: 320,
                maxWidth: 400,
                flex: '1 1 320px',
                bgcolor: 'background.default',
              }}
            >
              {/* Column Header */}
              <Box
                sx={{
                  p: 2,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" fontWeight={600}>
                  {statusLabels[columnId]}
                </Typography>
                <Typography variant="caption" color="text.secondary">
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
                      p: 2,
                      minHeight: 400,
                      bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {tasks.map((task, index) => (
                      <Draggable
                        key={task.id.toString()}
                        draggableId={task.id.toString()}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            sx={{
                              mb: 2,
                              cursor: 'grab',
                              opacity: snapshot.isDragging ? 0.8 : 1,
                              transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                boxShadow: 3,
                              },
                              '&:active': {
                                cursor: 'grabbing',
                              },
                            }}
                          >
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              {/* Task Header */}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                {task.priority && (
                                  <Chip
                                    icon={<FlagIcon />}
                                    label={task.priority}
                                    size="small"
                                    sx={{
                                      bgcolor: priorityColors[task.priority] + '20',
                                      color: priorityColors[task.priority],
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleMenuOpen(e, task)}
                                >
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </Box>

                              {/* Task Description */}
                              <Typography
                                variant="body1"
                                sx={{
                                  mb: 1.5,
                                  fontWeight: 500,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {task.description}
                              </Typography>

                              {/* Task Meta */}
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                {task.assigned_to && (
                                  <Chip
                                    avatar={<Avatar sx={{ width: 24, height: 24 }}>{task.assigned_to[0]}</Avatar>}
                                    label={task.assigned_to}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                                {task.due_date && (() => {
                                  const { text, isOverdue } = formatDate(task.due_date);
                                  return (
                                    <Chip
                                      icon={<CalendarIcon />}
                                      label={text}
                                      size="small"
                                      color={isOverdue ? 'error' : 'default'}
                                      variant="outlined"
                                    />
                                  );
                                })()}
                              </Box>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </Paper>
          ))}
        </Box>
      </DragDropContext>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {/* Edit handler */}}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default KanbanBoard;
