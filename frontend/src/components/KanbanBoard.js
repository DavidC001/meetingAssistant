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
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  InputLabel,
  FormControl,
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

// Portal component for react-beautiful-dnd to fix drag offset issues
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
  
  // Render to portal when dragging
  return ReactDOM.createPortal(child, document.body);
};


const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

const priorityColors = {
  high: '#f44336',
  medium: '#ff9800',
  low: '#4caf50',
};

const statusLabels = {
  'pending': 'Pending',
  'in_progress': 'In Progress',
  'completed': 'Completed',
};

const KanbanBoard = () => {
  const [columns, setColumns] = useState({
    'pending': [],
    'in_progress': [],
    'completed': [],
  });
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    task: '',
    owner: '',
    due_date: '',
    status: '',
    priority: '',
    notes: ''
  });
  
  // User filter state
  const [filterUserName, setFilterUserName] = useState(() => {
    return localStorage.getItem('kanbanUserName') || '';
  });
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(() => {
    return localStorage.getItem('kanbanShowOnlyMyTasks') === 'true';
  });
  const [allActionItems, setAllActionItems] = useState([]);

  useEffect(() => {
    fetchActionItems();
  }, []);
  
  // Apply filter when toggle or name changes
  useEffect(() => {
    applyFilter();
  }, [showOnlyMyTasks, filterUserName, allActionItems]);
  
  // Save user preferences to localStorage
  useEffect(() => {
    localStorage.setItem('kanbanUserName', filterUserName);
  }, [filterUserName]);
  
  useEffect(() => {
    localStorage.setItem('kanbanShowOnlyMyTasks', showOnlyMyTasks.toString());
  }, [showOnlyMyTasks]);

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/calendar/action-items`);
      const items = response.data;
      
      // Filter action items for next 3 months
      const now = new Date();
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(now.getMonth() + 3);
      
      const filteredItems = items.filter(item => {
        if (!item.due_date) return true; // Include items without due date
        const dueDate = new Date(item.due_date);
        return dueDate >= now && dueDate <= threeMonthsFromNow;
      });
      
      setAllActionItems(filteredItems);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching action items:', error);
      setLoading(false);
    }
  };
  
  const applyFilter = () => {
    let items = [...allActionItems];
    
    // Apply user filter if enabled
    if (showOnlyMyTasks && filterUserName) {
      items = items.filter(item => {
        if (!item.owner) return false;
        return item.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim();
      });
    }
    
    // Group action items by status
    const grouped = {
      'pending': [],
      'in_progress': [],
      'completed': [],
    };

    items.forEach(item => {
      const status = item.status || 'pending';
      if (grouped[status]) {
        grouped[status].push(item);
      }
    });

    setColumns(grouped);
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
        `${API_BASE_URL}/calendar/action-items/${movedTask.id}`,
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
    // Don't clear selectedTask here - it's needed for edit dialog
  };
  
  const handleEdit = () => {
    if (!selectedTask) return;
    
    setEditFormData({
      task: selectedTask.task || '',
      owner: selectedTask.owner || '',
      due_date: selectedTask.due_date || '',
      status: selectedTask.status || 'pending',
      priority: selectedTask.priority || 'medium',
      notes: selectedTask.notes || ''
    });
    setEditDialogOpen(true);
    setAnchorEl(null); // Close menu but keep selectedTask
  };
  
  const handleSaveEdit = async () => {
    if (!selectedTask) return;
    
    try {
      await axios.put(`${API_BASE_URL}/calendar/action-items/${selectedTask.id}`, editFormData);
      setEditDialogOpen(false);
      setSelectedTask(null); // Clear after save
      fetchActionItems();
    } catch (error) {
      console.error('Error updating action item:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/meetings/action-items/${selectedTask.id}`);
      fetchActionItems();
    } catch (error) {
      console.error('Error deleting action item:', error);
    } finally {
      setAnchorEl(null);
      setSelectedTask(null);
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
            Showing action items for the next 3 months • Drag tasks to update their status
          </Typography>
        </Box>
      </Box>
      
      {/* User Filter */}
      <Paper sx={{ mb: 3, p: 2 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          User Filter
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              size="small"
              label="My Name"
              placeholder="Enter your full name as it appears in meetings"
              value={filterUserName}
              onChange={(e) => setFilterUserName(e.target.value)}
              helperText="Only show tasks assigned to this name"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyMyTasks}
                  onChange={(e) => setShowOnlyMyTasks(e.target.checked)}
                  color="primary"
                />
              }
              label="Show only my tasks"
            />
          </Grid>
        </Grid>
        {showOnlyMyTasks && !filterUserName && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Enter your name above to filter tasks
          </Alert>
        )}
      </Paper>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, position: 'relative' }}>
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
                          <PortalAwareItem provided={provided} snapshot={snapshot}>
                            <Card
                              sx={{
                                mb: 2,
                                cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                                opacity: snapshot.isDragging ? 0.8 : 1,
                                boxShadow: snapshot.isDragging ? 6 : 1,
                                transition: 'box-shadow 0.2s ease-in-out',
                                '&:hover': {
                                  boxShadow: 3,
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
                                {task.task}
                              </Typography>

                              {/* Task Meta */}
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                {task.owner && (
                                  <Chip
                                    avatar={<Avatar sx={{ width: 24, height: 24 }}>{task.owner[0]}</Avatar>}
                                    label={task.owner}
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
                        </PortalAwareItem>
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
        <MenuItem onClick={handleEdit}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => { setEditDialogOpen(false); setSelectedTask(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Action Item</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Task"
            fullWidth
            value={editFormData.task}
            onChange={(e) => setEditFormData({ ...editFormData, task: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Owner"
            fullWidth
            value={editFormData.owner}
            onChange={(e) => setEditFormData({ ...editFormData, owner: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Due Date"
            type="date"
            fullWidth
            value={editFormData.due_date}
            onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={editFormData.status}
              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              label="Status"
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={editFormData.priority}
              onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
              label="Priority"
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Notes"
            fullWidth
            multiline
            rows={3}
            value={editFormData.notes}
            onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditDialogOpen(false); setSelectedTask(null); }}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KanbanBoard;
