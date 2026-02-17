import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputLabel,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import {
  FolderSpecial as FolderSpecialIcon,
  Add as AddIcon,
  Dashboard as DashboardIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../../services/projectService';
import { MeetingService } from '../../../services';
import MeetingPicker from './MeetingPicker';

import logger from '../../../utils/logger';
const ProjectsManager = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMeetings, setSelectedMeetings] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectStatus, setProjectStatus] = useState('active');
  const [tags, setTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadAvailableTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectsData = await projectService.listProjects();
      setProjects(projectsData.data);
    } catch (err) {
      setError('Failed to load data: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const response = await MeetingService.getAllTags();
      const tagsSet = new Set(response || []);
      projects.forEach((project) => {
        if (project.tags && Array.isArray(project.tags)) {
          project.tags.forEach((tag) => {
            if (tag && tag.trim()) {
              tagsSet.add(tag.trim());
            }
          });
        }
      });
      setAvailableTags(Array.from(tagsSet).sort());
    } catch (err) {
      logger.warn('Failed to load tags', err);
    }
  };

  const handleOpenCreateDialog = () => {
    setSelectedProject(null);
    setSelectedMeetings([]);
    setProjectName('');
    setProjectDescription('');
    setProjectStatus('active');
    setTags([]);
    setCreateDialogOpen(true);
  };

  const handleOpenEditDialog = (project) => {
    setSelectedProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description || '');
    setProjectStatus(project.status || 'active');
    setTags(project.tags || []);
    setSelectedMeetings(project.meeting_ids || []);
    setEditDialogOpen(true);
  };

  const handleOpenDeleteDialog = (project) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    if (selectedMeetings.length === 0) {
      setError('Please select at least one meeting');
      return;
    }

    try {
      await projectService.createProject({
        meeting_ids: selectedMeetings,
        tags: tags,
        name: projectName,
        description: projectDescription || null,
      });
      setCreateDialogOpen(false);
      setSelectedMeetings([]);
      setProjectName('');
      setProjectDescription('');
      setTags([]);
      await loadData();
    } catch (err) {
      setError('Failed to create project: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedProject(null);
    setSelectedMeetings([]);
    setProjectName('');
    setProjectDescription('');
    setProjectStatus('active');
    setTags([]);
  };

  const handleUpdateProject = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      await projectService.updateProject(selectedProject.id, {
        name: projectName,
        description: projectDescription || null,
        status: projectStatus,
        tags: tags,
        meeting_ids: selectedMeetings.length > 0 ? selectedMeetings : undefined,
      });
      setEditDialogOpen(false);
      await loadData();
    } catch (err) {
      setError('Failed to update project: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.deleteProject(selectedProject.id, false);
      setDeleteDialogOpen(false);
      await loadData();
    } catch (err) {
      setError('Failed to delete project: ' + (err.response?.data?.detail || err.message));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'on_hold':
        return 'warning';
      case 'completed':
        return 'info';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" gutterBottom>
            Projects Manager
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
          >
            New Project
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Create projects by selecting meetings and adding optional tags for organization
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Active Projects */}
      {projects.filter((p) => p.status === 'active').length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" gutterBottom>
            Active Projects
          </Typography>
          <Grid container spacing={3}>
            {projects
              .filter((p) => p.status === 'active')
              .map((project) => (
                <Grid item xs={12} sm={6} md={4} key={project.id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Box display="flex" alignItems="center">
                          <FolderSpecialIcon
                            sx={{ mr: 1, color: project.color || 'primary.main' }}
                          />
                          <Typography variant="h6">{project.name}</Typography>
                        </Box>
                        <Chip
                          label={project.status}
                          color={getStatusColor(project.status)}
                          size="small"
                        />
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
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(project)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(project)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Box>
      )}

      {/* On Hold Projects */}
      {projects.filter((p) => p.status === 'on_hold').length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" gutterBottom>
            On Hold Projects
          </Typography>
          <Grid container spacing={3}>
            {projects
              .filter((p) => p.status === 'on_hold')
              .map((project) => (
                <Grid item xs={12} sm={6} md={4} key={project.id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Box display="flex" alignItems="center">
                          <FolderSpecialIcon
                            sx={{ mr: 1, color: project.color || 'primary.main' }}
                          />
                          <Typography variant="h6">{project.name}</Typography>
                        </Box>
                        <Chip
                          label={project.status}
                          color={getStatusColor(project.status)}
                          size="small"
                        />
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
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(project)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(project)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Box>
      )}

      {/* Completed Projects */}
      {projects.filter((p) => p.status === 'completed').length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" gutterBottom>
            Completed Projects
          </Typography>
          <Grid container spacing={3}>
            {projects
              .filter((p) => p.status === 'completed')
              .map((project) => (
                <Grid item xs={12} sm={6} md={4} key={project.id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Box display="flex" alignItems="center">
                          <FolderSpecialIcon
                            sx={{ mr: 1, color: project.color || 'primary.main' }}
                          />
                          <Typography variant="h6">{project.name}</Typography>
                        </Box>
                        <Chip
                          label={project.status}
                          color={getStatusColor(project.status)}
                          size="small"
                        />
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
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(project)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(project)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Box>
      )}

      {/* Archived Projects */}
      {projects.filter((p) => p.status === 'archived').length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" gutterBottom>
            Archived Projects
          </Typography>
          <Grid container spacing={3}>
            {projects
              .filter((p) => p.status === 'archived')
              .map((project) => (
                <Grid item xs={12} sm={6} md={4} key={project.id}>
                  <Card sx={{ opacity: 0.7 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Box display="flex" alignItems="center">
                          <FolderSpecialIcon
                            sx={{ mr: 1, color: project.color || 'primary.main' }}
                          />
                          <Typography variant="h6">{project.name}</Typography>
                        </Box>
                        <Chip
                          label={project.status}
                          color={getStatusColor(project.status)}
                          size="small"
                        />
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
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(project)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(project)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Box>
      )}

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              fullWidth
              margin="normal"
              required
              autoFocus
            />
            <TextField
              label="Description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              fullWidth
              margin="normal"
              multiline
              rows={2}
            />
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={tags}
              onChange={(event, newValue) => setTags(newValue)}
              filterOptions={(options, params) => {
                const filtered = options.filter((option) =>
                  option.toLowerCase().includes(params.inputValue.toLowerCase())
                );
                if (params.inputValue !== '' && !filtered.includes(params.inputValue)) {
                  filtered.push(params.inputValue);
                }
                return filtered;
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Add tags..."
                  helperText="Optional: organize projects with tags. Select existing or type new ones."
                  margin="normal"
                />
              )}
            />
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Select Meetings ({selectedMeetings.length} selected)
              </Typography>
              <MeetingPicker
                selectedMeetings={selectedMeetings}
                onSelectionChange={setSelectedMeetings}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleCreateProject}
            variant="contained"
            color="primary"
            disabled={selectedMeetings.length === 0}
          >
            Create Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              fullWidth
              margin="normal"
              required
              autoFocus
            />
            <TextField
              label="Description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              fullWidth
              margin="normal"
              multiline
              rows={2}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                value={projectStatus}
                onChange={(e) => setProjectStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="on_hold">On Hold</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={tags}
              onChange={(event, newValue) => setTags(newValue)}
              filterOptions={(options, params) => {
                const filtered = options.filter((option) =>
                  option.toLowerCase().includes(params.inputValue.toLowerCase())
                );
                if (params.inputValue !== '' && !filtered.includes(params.inputValue)) {
                  filtered.push(params.inputValue);
                }
                return filtered;
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Add tags..."
                  helperText="Optional: organize projects with tags. Select existing or type new ones."
                  margin="normal"
                />
              )}
            />
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Select Meetings ({selectedMeetings.length} selected)
              </Typography>
              <MeetingPicker
                selectedMeetings={selectedMeetings}
                onSelectionChange={setSelectedMeetings}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleUpdateProject} variant="contained" color="primary">
            Update Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            Associated meetings will NOT be deleted, only the project itself.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleDeleteProject} variant="contained" color="error">
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectsManager;
