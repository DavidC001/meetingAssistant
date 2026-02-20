import React from 'react';
import { Box, Button, Card, CardContent, Chip, Grid, IconButton, Typography } from '@mui/material';
import {
  FolderSpecial as FolderSpecialIcon,
  Dashboard as DashboardIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * Renders a single project card with name, status, description, tags,
 * meeting/action-item counts, and action buttons.
 */
const ProjectCard = ({ project, onEdit, onDelete, getStatusColor, dimmed }) => {
  const navigate = useNavigate();

  return (
    <Grid item xs={12} sm={6} md={4}>
      <Card sx={dimmed ? { opacity: 0.7 } : undefined}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
            <Box display="flex" alignItems="center">
              <FolderSpecialIcon sx={{ mr: 1, color: project.color || 'primary.main' }} />
              <Typography variant="h6">{project.name}</Typography>
            </Box>
            <Chip label={project.status} color={getStatusColor(project.status)} size="small" />
          </Box>

          {project.description && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {project.description}
            </Typography>
          )}

          {project.tags && project.tags.length > 0 && (
            <Box mb={2}>
              <Typography variant="caption" color="text.secondary" display="block">
                Tags
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                {project.tags.map((tag, idx) => (
                  <Chip key={idx} label={tag} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}

          <Box mb={2}>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Meetings
                </Typography>
                <Typography variant="body1">{project.meeting_count}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Action Items
                </Typography>
                <Typography variant="body1">
                  {project.completed_action_items}/{project.action_item_count}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<DashboardIcon />}
              onClick={() => navigate(`/projects/${project.id}`)}
              sx={{ flex: 1 }}
            >
              Dashboard
            </Button>
            <IconButton size="small" onClick={() => onEdit(project)} color="primary">
              <EditIcon />
            </IconButton>
            <IconButton size="small" onClick={() => onDelete(project)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
};

export default ProjectCard;
