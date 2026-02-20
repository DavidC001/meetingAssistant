import { useState, useEffect } from 'react';
import { projectService } from '../../../../services/projectService';
import { MeetingService } from '../../../../services';
import logger from '../../../../utils/logger';

const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Form fields
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
        tags,
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
        tags,
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

  return {
    projects,
    loading,
    error,
    setError,
    // Dialog states
    createDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    selectedProject,
    // Form fields
    selectedMeetings,
    setSelectedMeetings,
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    projectStatus,
    setProjectStatus,
    tags,
    setTags,
    availableTags,
    // Handlers
    handleOpenCreateDialog,
    handleOpenEditDialog,
    handleOpenDeleteDialog,
    handleCloseDialog,
    handleCreateProject,
    handleUpdateProject,
    handleDeleteProject,
    getStatusColor,
  };
};

export default useProjects;
