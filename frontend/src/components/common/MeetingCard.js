/**
 * MeetingCard Component
 * 
 * Reusable card for displaying meeting information consistently across the app.
 * Supports list view, grid view, and recent meetings display.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  IconButton,
  Chip,
  Stack,
  LinearProgress,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Chat as ChatIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Folder as FolderIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import StatusChip from './StatusChip';

const MeetingCard = ({
  meeting,
  variant = 'grid', // 'grid', 'list', 'compact'
  onDelete,
  onEdit,
  onDownload,
  onChat,
  showProgress = true,
}) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
    });
  };

  const isProcessing = meeting.status === 'processing';

  // Compact variant (for recent meetings)
  if (variant === 'compact') {
    return (
      <Card
        component={Link}
        to={`/meetings/${meeting.id}`}
        sx={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          mb: 1,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateX(4px)',
            boxShadow: 2,
          },
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="body1"
            noWrap
            sx={{ fontWeight: 500, mb: 0.5 }}
          >
            {meeting.title || meeting.filename || 'Untitled Meeting'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDate(meeting.meeting_date || meeting.created_at)} • {formatTime(meeting.meeting_date || meeting.created_at)}
          </Typography>
        </Box>
        <StatusChip status={meeting.status} size="small" />
      </Card>
    );
  }

  // List variant (for table/list views)
  if (variant === 'list') {
    return (
      <Card
        component={Link}
        to={`/meetings/${meeting.id}`}
        sx={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          p: 2,
          mb: 1,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateX(4px)',
            boxShadow: 2,
            '& .meeting-actions': {
              opacity: 1,
            },
          },
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="body1"
              noWrap
              sx={{ fontWeight: 500 }}
            >
              {meeting.title || meeting.filename || 'Untitled Meeting'}
            </Typography>
            {meeting.folder && (
              <Chip
                icon={<FolderIcon />}
                label={meeting.folder}
                size="small"
                variant="outlined"
                sx={{ height: 20 }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {formatDate(meeting.meeting_date || meeting.created_at)} • {formatTime(meeting.meeting_date || meeting.created_at)}
          </Typography>
        </Box>
        <StatusChip status={meeting.status} size="small" sx={{ mr: 1 }} />
        <IconButton
          size="small"
          onClick={handleMenuClick}
          className="meeting-actions"
          sx={{ opacity: 0, transition: 'opacity 0.2s' }}
        >
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          onClick={(e) => e.stopPropagation()}
        >
          {onChat && (
            <MenuItem onClick={() => { handleMenuClose(); onChat(meeting); }}>
              <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Quick Chat</ListItemText>
            </MenuItem>
          )}
          {onDownload && (
            <MenuItem onClick={() => { handleMenuClose(); onDownload(meeting); }}>
              <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Download</ListItemText>
            </MenuItem>
          )}
          {onEdit && (
            <MenuItem onClick={() => { handleMenuClose(); onEdit(meeting); }}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          )}
          {onDelete && (
            <MenuItem onClick={() => { handleMenuClose(); onDelete(meeting); }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          )}
        </Menu>
      </Card>
    );
  }

  // Grid variant (default card view)
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        textDecoration: 'none',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent
        component={Link}
        to={`/meetings/${meeting.id}`}
        sx={{
          flexGrow: 1,
          textDecoration: 'none',
          color: 'inherit',
          pb: 1,
          pt: 1.5,
          pl: 6, // Add left padding to avoid checkbox overlap
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              flexGrow: 1,
              mr: 1,
            }}
          >
            {meeting.title || meeting.filename || 'Untitled Meeting'}
          </Typography>
          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{ mt: -0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {formatDate(meeting.meeting_date || meeting.created_at)}
          </Typography>
          <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {formatTime(meeting.meeting_date || meeting.created_at)}
          </Typography>
        </Stack>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          <StatusChip status={meeting.status} size="small" />
          {meeting.folder && (
            <Chip
              icon={<FolderIcon />}
              label={meeting.folder}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {(() => {
          // Handle tags as either string or array
          let tagsArray = [];
          if (meeting.tags) {
            if (typeof meeting.tags === 'string') {
              tagsArray = meeting.tags.split(',').map(t => t.trim()).filter(Boolean);
            } else if (Array.isArray(meeting.tags)) {
              tagsArray = meeting.tags;
            }
          }
          
          if (tagsArray.length === 0) return null;
          
          return (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {tagsArray.slice(0, 3).map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              ))}
              {tagsArray.length > 3 && (
                <Chip
                  label={`+${tagsArray.length - 3}`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          );
        })()}
      </CardContent>

      {isProcessing && showProgress && (
        <LinearProgress sx={{ height: 2 }} />
      )}

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        {onChat && (
          <MenuItem onClick={() => { handleMenuClose(); onChat(meeting); }}>
            <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Quick Chat</ListItemText>
          </MenuItem>
        )}
        {onDownload && (
          <MenuItem onClick={() => { handleMenuClose(); onDownload(meeting); }}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        {onEdit && (
          <MenuItem onClick={() => { handleMenuClose(); onEdit(meeting); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={() => { handleMenuClose(); onDelete(meeting); }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default MeetingCard;
