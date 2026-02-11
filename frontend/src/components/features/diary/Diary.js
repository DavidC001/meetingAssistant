/**
 * Diary Component
 *
 * Main component for the Daily Work Diary feature.
 * Allows users to create and edit diary entries with action items integration.
 */

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as InProgressIcon,
  AddCircle as NewIcon,
  BarChart as StatisticsIcon,
} from '@mui/icons-material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import diaryService from '../../../services/diaryService';
import './Diary.css';

const PRODUCTIVITY_OPTIONS = [
  { value: '1', label: '1 - Very Low' },
  { value: '2', label: '2 - Low' },
  { value: '3', label: '3 - Below Average' },
  { value: '4', label: '4 - Slightly Below Average' },
  { value: '5', label: '5 - Average' },
  { value: '6', label: '6 - Slightly Above Average' },
  { value: '7', label: '7 - Good' },
  { value: '8', label: '8 - Very Good' },
  { value: '9', label: '9 - Excellent' },
  { value: '10', label: '10 - Outstanding' },
];

const Diary = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(
    searchParams.get('date') ? new Date(searchParams.get('date')) : new Date()
  );
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form fields
  const [content, setContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [productivity, setProductivity] = useState('');

  // Time tracking fields
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');

  // Action items section
  const [actionItemsExpanded, setActionItemsExpanded] = useState(true);
  const [actionItemsSummary, setActionItemsSummary] = useState(null);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [filterUserName, setFilterUserName] = useState(() => {
    return localStorage.getItem('diaryUserName') || '';
  });
  const [draggedItem, setDraggedItem] = useState(null);
  const scrollIntervalRef = React.useRef(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    localStorage.setItem('diaryUserName', filterUserName);
  }, [filterUserName]);

  useEffect(() => {
    loadEntry();

    // Cleanup function
    return () => {
      document.removeEventListener('dragover', handleDragOverWithScroll);
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [currentDate]);

  const formatDateForApi = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadEntry = async () => {
    try {
      setLoading(true);
      setError(null);
      const dateStr = formatDateForApi(currentDate);

      try {
        const data = await diaryService.getEntry(dateStr, true);
        setEntry(data);
        setContent(data.content || '');
        setProductivity(data.mood || ''); // Keep using 'mood' field name in API for backward compatibility
        setArrivalTime(data.arrival_time || '');
        setDepartureTime(data.departure_time || '');
        setHoursWorked(data.hours_worked || '');
        setActionItemsSummary(data.action_items_summary || null);
      } catch (err) {
        if (err.response?.status === 404) {
          // No entry exists yet - initialize with template
          setEntry(null);

          // Create template
          const template = await diaryService.getTemplate(dateStr);
          setContent(template);

          setProductivity('');
          setArrivalTime('');
          setDepartureTime('');
          setHoursWorked('');

          // Still load action items summary
          try {
            const summary = await diaryService.getActionItemsSummary(dateStr);
            setActionItemsSummary(summary);
          } catch {
            setActionItemsSummary(null);
          }
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error('Error loading diary entry:', err);
      setError(err.message || 'Failed to load diary entry');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const dateStr = formatDateForApi(currentDate);
      const entryData = {
        date: dateStr,
        content,
        mood: productivity || null, // Keep using 'mood' field name in API
        arrival_time: arrivalTime || null,
        departure_time: departureTime || null,
        hours_worked: hoursWorked ? parseFloat(hoursWorked) : null,
      };

      if (entry) {
        // Update existing entry
        await diaryService.updateEntry(dateStr, entryData);
        setSuccessMessage('Diary entry updated successfully');
      } else {
        // Create new entry
        await diaryService.createEntry(entryData);
        setSuccessMessage('Diary entry created successfully');
      }

      // Reload entry
      await loadEntry();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error saving diary entry:', err);
      setError(err.message || 'Failed to save diary entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this diary entry?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const dateStr = formatDateForApi(currentDate);
      await diaryService.deleteEntry(dateStr);

      setSuccessMessage('Diary entry deleted successfully');

      // Clear form
      setEntry(null);
      setContent('');
      setProductivity('');

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting diary entry:', err);
      setError(err.message || 'Failed to delete diary entry');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
    setSearchParams({ date: formatDateForApi(newDate) });
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
    setSearchParams({ date: formatDateForApi(newDate) });
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSearchParams({ date: formatDateForApi(today) });
  };

  const handleActionItemDragStart = (e, item) => {
    setDraggedItem(item);
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';

    // Start auto-scroll when dragging
    document.addEventListener('dragover', handleDragOverWithScroll);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setIsDragging(false);
    document.removeEventListener('dragover', handleDragOverWithScroll);
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleDragOverWithScroll = (e) => {
    const scrollThreshold = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 10;
    const viewportHeight = window.innerHeight;
    const mouseY = e.clientY;

    // Clear existing interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    // Scroll up if near top
    if (mouseY < scrollThreshold) {
      scrollIntervalRef.current = setInterval(() => {
        window.scrollBy(0, -scrollSpeed);
      }, 20);
    }
    // Scroll down if near bottom
    else if (mouseY > viewportHeight - scrollThreshold) {
      scrollIntervalRef.current = setInterval(() => {
        window.scrollBy(0, scrollSpeed);
      }, 20);
    }
  };

  const handleContentDrop = (e) => {
    e.preventDefault();
    const itemData = e.dataTransfer.getData('application/json');
    if (itemData) {
      const item = JSON.parse(itemData);
      // Use [x] for completed items, [ ] for others
      const checkbox = item.status === 'completed' ? 'x' : ' ';
      const reference = `- [${checkbox}] **${item.task}** _(Action Item #${item.id})_`;

      // Find the "Worked on:" section and insert the reference there
      const workedOnPattern = /## Worked on:/i;
      const match = content.match(workedOnPattern);

      if (match) {
        const insertPosition = match.index + match[0].length;
        // Find the next section or end of content
        const afterWorkedOn = content.substring(insertPosition);
        const nextSectionMatch = afterWorkedOn.match(/\n##/);
        const endOfWorkedOn = nextSectionMatch
          ? insertPosition + nextSectionMatch.index
          : content.length;

        // Get content before and after the insertion point
        let workedOnContent = content.substring(insertPosition, endOfWorkedOn);

        // Remove the placeholder text if it exists
        workedOnContent = workedOnContent.replace(
          /\n_Drag action items here from the right panel_/i,
          ''
        );

        // Add the new reference
        const newContent =
          content.substring(0, insertPosition) +
          '\n' +
          reference +
          workedOnContent +
          content.substring(endOfWorkedOn);

        setContent(newContent);
      } else {
        // Fallback: append to end if section not found
        setContent(content + '\n' + reference);
      }
    }
  };

  const handleContentDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const calculateHours = () => {
    if (arrivalTime && departureTime) {
      const [arrHours, arrMins] = arrivalTime.split(':').map(Number);
      const [depHours, depMins] = departureTime.split(':').map(Number);

      const arrivalMinutes = arrHours * 60 + arrMins;
      const departureMinutes = depHours * 60 + depMins;

      const diffMinutes = departureMinutes - arrivalMinutes;
      const hours = (diffMinutes / 60).toFixed(2);

      setHoursWorked(hours);
    }
  };

  const filterActionItems = (items) => {
    if (!showOnlyMyTasks || !filterUserName) {
      return items;
    }
    return items.filter(
      (item) =>
        item.owner && item.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim()
    );
  };

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Box className="diary-container" p={3}>
      <Paper elevation={2} sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Daily Diary
          </Typography>

          {/* Date Navigation */}
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton
              onClick={() => navigate('/diary/statistics')}
              color="primary"
              title="View Statistics"
            >
              <StatisticsIcon />
            </IconButton>

            <IconButton onClick={handlePreviousDay} title="Previous Day">
              <ChevronLeftIcon />
            </IconButton>

            <Button
              variant="outlined"
              onClick={handleToday}
              startIcon={<TodayIcon />}
              sx={{ minWidth: 120 }}
            >
              Today
            </Button>

            <IconButton onClick={handleNextDay} title="Next Day">
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom color="primary">
          {formatDisplayDate(currentDate)}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Left Column - Entry Content */}
            <Grid item xs={12} md={7}>
              <Box mb={3}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Productivity Level</InputLabel>
                  <Select
                    value={productivity}
                    onChange={(e) => setProductivity(e.target.value)}
                    label="Productivity Level"
                  >
                    <MenuItem value="">
                      <em>Not rated</em>
                    </MenuItem>
                    {PRODUCTIVITY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Notes (Markdown supported) - Drag action items here
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setPreviewMode(!previewMode)}
                      variant="outlined"
                    >
                      {previewMode ? 'Edit' : 'Preview'}
                    </Button>
                  </Box>

                  {!previewMode ? (
                    <TextField
                      fullWidth
                      multiline
                      rows={15}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onDrop={handleContentDrop}
                      onDragOver={handleContentDragOver}
                      placeholder="Write your daily notes here... You can drag action items from the right panel to reference them."
                      sx={{
                        '& .MuiInputBase-root': {
                          borderWidth: isDragging ? 3 : 2,
                          borderStyle: 'dashed',
                          borderColor: isDragging ? 'primary.main' : 'primary.light',
                          backgroundColor: isDragging ? 'action.hover' : 'inherit',
                          transition: 'all 0.2s ease',
                        },
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        minHeight: 400,
                        maxHeight: 600,
                        overflow: 'auto',
                        bgcolor: 'background.paper',
                        '& h1': { fontSize: '1.5rem', fontWeight: 600, mb: 2 },
                        '& h2': { fontSize: '1.25rem', fontWeight: 600, mt: 3, mb: 1 },
                        '& h3': { fontSize: '1.1rem', fontWeight: 600, mt: 2, mb: 1 },
                        '& ul': { pl: 3 },
                        '& li': { mb: 0.5 },
                        '& input[type="checkbox"]': { mr: 1 },
                        '& p': { mb: 1 },
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    </Box>
                  )}
                </Box>

                {/* Time Tracking */}
                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    ⏰ Time Tracking
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="time"
                        label="Arrival Time"
                        value={arrivalTime}
                        onChange={(e) => setArrivalTime(e.target.value)}
                        onBlur={calculateHours}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="time"
                        label="Departure Time"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                        onBlur={calculateHours}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Hours Worked"
                        value={hoursWorked}
                        onChange={(e) => setHoursWorked(e.target.value)}
                        InputProps={{ inputProps: { min: 0, max: 24, step: 0.25 } }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Action Buttons */}
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>

                  {entry && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      Delete
                    </Button>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Right Column - Action Items Summary */}
            <Grid item xs={12} md={5}>
              <Card variant="outlined">
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    onClick={() => setActionItemsExpanded(!actionItemsExpanded)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <Typography variant="h6">Action Items</Typography>
                    <IconButton size="small">
                      {actionItemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  <Collapse in={actionItemsExpanded}>
                    {/* Filter Controls */}
                    <Box mt={2} mb={2}>
                      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                        <TextField
                          size="small"
                          label="My Name"
                          value={filterUserName}
                          onChange={(e) => setFilterUserName(e.target.value)}
                          sx={{ flex: '1 1 200px', minWidth: '150px' }}
                          placeholder="Enter your name"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={showOnlyMyTasks}
                              onChange={(e) => setShowOnlyMyTasks(e.target.checked)}
                              size="small"
                            />
                          }
                          label="My Items Only"
                        />
                      </Box>
                      {showOnlyMyTasks && !filterUserName && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          Please enter your name to filter
                        </Alert>
                      )}
                    </Box>

                    {actionItemsSummary ? (
                      <Box mt={2}>
                        <Alert severity="info" sx={{ mb: 2 }}>
                          💡 Drag action items to the notes field to reference them
                        </Alert>

                        {/* In Progress Items */}
                        {filterActionItems(actionItemsSummary.in_progress_items || []).length >
                          0 && (
                          <Box mb={2}>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <InProgressIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="primary">
                                In Progress (
                                {
                                  filterActionItems(actionItemsSummary.in_progress_items || [])
                                    .length
                                }
                                )
                              </Typography>
                            </Box>
                            <List dense>
                              {filterActionItems(actionItemsSummary.in_progress_items || []).map(
                                (item) => (
                                  <ListItem
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleActionItemDragStart(e, item)}
                                    onDragEnd={handleDragEnd}
                                    sx={{
                                      cursor: 'grab',
                                      '&:hover': {
                                        backgroundColor: 'action.hover',
                                      },
                                      '&:active': {
                                        cursor: 'grabbing',
                                      },
                                      opacity: draggedItem?.id === item.id ? 0.5 : 1,
                                      transition: 'opacity 0.2s',
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      <InProgressIcon color="primary" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={item.task}
                                      secondary={`${item.owner || 'Unassigned'} ${
                                        item.due_date ? `• Due: ${item.due_date}` : ''
                                      }`}
                                      primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                  </ListItem>
                                )
                              )}
                            </List>
                          </Box>
                        )}

                        {/* Items Due Today */}
                        {filterActionItems(actionItemsSummary.created_items || []).length > 0 && (
                          <Box mb={2}>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <NewIcon color="warning" fontSize="small" />
                              <Typography variant="subtitle2" color="warning.main">
                                Due Today (
                                {filterActionItems(actionItemsSummary.created_items || []).length})
                              </Typography>
                            </Box>
                            <List dense>
                              {filterActionItems(actionItemsSummary.created_items || []).map(
                                (item) => (
                                  <ListItem
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleActionItemDragStart(e, item)}
                                    onDragEnd={handleDragEnd}
                                    sx={{
                                      cursor: 'grab',
                                      '&:hover': {
                                        backgroundColor: 'action.hover',
                                      },
                                      '&:active': {
                                        cursor: 'grabbing',
                                      },
                                      opacity: draggedItem?.id === item.id ? 0.5 : 1,
                                      transition: 'opacity 0.2s',
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      <NewIcon color="warning" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={item.task}
                                      secondary={`${item.owner || 'Unassigned'} ${
                                        item.priority ? `• ${item.priority}` : ''
                                      }`}
                                      primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                  </ListItem>
                                )
                              )}
                            </List>
                          </Box>
                        )}

                        {/* Completed Items */}
                        {filterActionItems(actionItemsSummary.completed_items || []).length > 0 && (
                          <Box mb={2}>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <CheckCircleIcon color="success" fontSize="small" />
                              <Typography variant="subtitle2" color="success.main">
                                Completed (
                                {filterActionItems(actionItemsSummary.completed_items || []).length}
                                )
                              </Typography>
                            </Box>
                            <List dense>
                              {filterActionItems(actionItemsSummary.completed_items || []).map(
                                (item) => (
                                  <ListItem
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleActionItemDragStart(e, item)}
                                    onDragEnd={handleDragEnd}
                                    sx={{
                                      cursor: 'grab',
                                      '&:hover': {
                                        backgroundColor: 'action.hover',
                                      },
                                      '&:active': {
                                        cursor: 'grabbing',
                                      },
                                      opacity: draggedItem?.id === item.id ? 0.5 : 1,
                                      transition: 'opacity 0.2s',
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      <CheckCircleIcon color="success" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={item.task}
                                      secondary={item.owner}
                                      primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                  </ListItem>
                                )
                              )}
                            </List>
                          </Box>
                        )}

                        {/* Created Items */}
                        {filterActionItems(actionItemsSummary.created_items || []).length > 0 && (
                          <Box mb={2}>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <NewIcon color="info" fontSize="small" />
                              <Typography variant="subtitle2" color="info.main">
                                New Items (
                                {filterActionItems(actionItemsSummary.created_items || []).length})
                              </Typography>
                            </Box>
                            <List dense>
                              {filterActionItems(actionItemsSummary.created_items || []).map(
                                (item) => (
                                  <ListItem
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleActionItemDragStart(e, item)}
                                    onDragEnd={handleDragEnd}
                                    sx={{
                                      cursor: 'grab',
                                      '&:hover': {
                                        backgroundColor: 'action.hover',
                                      },
                                      '&:active': {
                                        cursor: 'grabbing',
                                      },
                                      opacity: draggedItem?.id === item.id ? 0.5 : 1,
                                      transition: 'opacity 0.2s',
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      <NewIcon color="info" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={item.task}
                                      secondary={item.owner}
                                      primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                  </ListItem>
                                )
                              )}
                            </List>
                          </Box>
                        )}

                        {filterActionItems(actionItemsSummary.completed_items || []).length === 0 &&
                          filterActionItems(actionItemsSummary.in_progress_items || []).length ===
                            0 &&
                          filterActionItems(actionItemsSummary.created_items || []).length ===
                            0 && (
                            <Typography variant="body2" color="text.secondary">
                              {showOnlyMyTasks && filterUserName
                                ? `No action items assigned to ${filterUserName} for this day.`
                                : 'No action items activity for this day.'}
                            </Typography>
                          )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Loading action items...
                      </Typography>
                    )}
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Paper>
    </Box>
  );
};

export default Diary;
