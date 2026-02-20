import React from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as InProgressIcon,
  AddCircle as NewIcon,
} from '@mui/icons-material';

const ITEM_SECTIONS = [
  {
    key: 'in_progress_items',
    label: 'In Progress',
    Icon: InProgressIcon,
    color: 'primary',
  },
  {
    key: 'created_items',
    label: 'Due Today',
    Icon: NewIcon,
    color: 'warning',
  },
  {
    key: 'completed_items',
    label: 'Completed',
    Icon: CheckCircleIcon,
    color: 'success',
  },
];

const DraggableListItem = ({
  item,
  Icon,
  color,
  onDragStart,
  onDragEnd,
  draggedItem,
  secondary,
}) => (
  <ListItem
    key={item.id}
    draggable
    onDragStart={(e) => onDragStart(e, item)}
    onDragEnd={onDragEnd}
    sx={{
      cursor: 'grab',
      '&:hover': { backgroundColor: 'action.hover' },
      '&:active': { cursor: 'grabbing' },
      opacity: draggedItem?.id === item.id ? 0.5 : 1,
      transition: 'opacity 0.2s',
    }}
  >
    <ListItemIcon sx={{ minWidth: 32 }}>
      <Icon color={color} fontSize="small" />
    </ListItemIcon>
    <ListItemText
      primary={item.task}
      secondary={secondary}
      primaryTypographyProps={{ variant: 'body2' }}
    />
  </ListItem>
);

/**
 * Right-column panel: accordion of action items with DnD + filter controls.
 */
const DiaryActionItems = ({
  actionItemsSummary,
  actionItemsExpanded,
  onToggleExpanded,
  showOnlyMyTasks,
  onToggleShowOnlyMine,
  filterUserName,
  onFilterUserNameChange,
  draggedItem,
  onDragStart,
  onDragEnd,
  filterActionItems,
}) => (
  <Card variant="outlined">
    <CardContent>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        onClick={onToggleExpanded}
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
              onChange={(e) => onFilterUserNameChange(e.target.value)}
              sx={{ flex: '1 1 200px', minWidth: '150px' }}
              placeholder="Enter your name"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showOnlyMyTasks}
                  onChange={(e) => onToggleShowOnlyMine(e.target.checked)}
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

            {ITEM_SECTIONS.map(({ key, label, Icon, color }) => {
              const items = filterActionItems(actionItemsSummary[key] || []);
              if (items.length === 0) return null;
              return (
                <Box key={key} mb={2}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Icon color={color} fontSize="small" />
                    <Typography variant="subtitle2" color={`${color}.main`}>
                      {label} ({items.length})
                    </Typography>
                  </Box>
                  <List dense>
                    {items.map((item) => (
                      <DraggableListItem
                        key={item.id}
                        item={item}
                        Icon={Icon}
                        color={color}
                        draggedItem={draggedItem}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        secondary={
                          key === 'completed_items'
                            ? item.owner
                            : `${item.owner || 'Unassigned'}${
                                item.due_date ? ` • Due: ${item.due_date}` : ''
                              }${item.priority ? ` • ${item.priority}` : ''}`
                        }
                      />
                    ))}
                  </List>
                </Box>
              );
            })}

            {ITEM_SECTIONS.every(
              ({ key }) => filterActionItems(actionItemsSummary[key] || []).length === 0
            ) && (
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
);

export default DiaryActionItems;
