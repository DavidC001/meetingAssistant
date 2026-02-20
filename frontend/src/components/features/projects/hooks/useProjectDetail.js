/**
 * useProjectDetail
 * Manages project data, edit/delete dialogs, export, and available tags.
 * Exposes a flat { project, loading, error, ... actions } interface.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../../../services/projectService';
import { downloadBlob, MeetingService } from '../../../../services';
import logger from '../../../../utils/logger';

export const useProjectDetail = (projectId) => {
  const navigate = useNavigate();

  // Core project state
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    tags: [],
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Export state
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectService.getProject(projectId);
      setProject(response.data);
    } catch (err) {
      setError('Failed to load project: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadAvailableTags = useCallback(async (currentProject) => {
    try {
      const response = await MeetingService.getAllTags();
      const tagsSet = new Set(response || []);
      if (currentProject?.tags && Array.isArray(currentProject.tags)) {
        currentProject.tags.forEach((tag) => {
          if (tag && tag.trim()) tagsSet.add(tag.trim());
        });
      }
      setAvailableTags(Array.from(tagsSet).sort());
    } catch (err) {
      logger.warn('Failed to load available tags', err);
    }
  }, []);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (project) loadAvailableTags(project);
  }, [project, loadAvailableTags]);

  // Edit actions
  const openEditDialog = useCallback(() => {
    if (!project) return;
    setEditFormData({
      name: project.name,
      description: project.description || '',
      status: project.status || 'active',
      tags: project.tags || [],
    });
    setEditDialogOpen(true);
  }, [project]);

  const closeEditDialog = useCallback(() => setEditDialogOpen(false), []);

  const handleUpdateProject = useCallback(async () => {
    try {
      await projectService.updateProject(projectId, {
        name: editFormData.name,
        description: editFormData.description || null,
        status: editFormData.status,
        tags: editFormData.tags,
      });
      setEditDialogOpen(false);
      await loadProject();
    } catch (err) {
      setError('Failed to update project: ' + (err.response?.data?.detail || err.message));
    }
  }, [projectId, editFormData, loadProject]);

  // Delete actions
  const openDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);
  const closeDeleteDialog = useCallback(() => setDeleteDialogOpen(false), []);

  const handleDeleteProject = useCallback(async () => {
    try {
      await projectService.deleteProject(projectId, false);
      setDeleteDialogOpen(false);
      navigate('/projects');
    } catch (err) {
      setError('Failed to delete project: ' + (err.response?.data?.detail || err.message));
    }
  }, [projectId, navigate]);

  // Export helpers
  const getExportFilename = (response, fallbackName) => {
    const cd =
      response?.headers?.['content-disposition'] || response?.headers?.['Content-Disposition'];
    if (cd) {
      const match = /filename="?([^";]+)"?/i.exec(cd);
      if (match?.[1]) return match[1];
    }
    return fallbackName;
  };

  const openExportMenu = useCallback((event) => setExportAnchorEl(event.currentTarget), []);
  const closeExportMenu = useCallback(() => setExportAnchorEl(null), []);

  const handleExport = useCallback(
    async (formatType) => {
      if (!projectId) return;
      try {
        setExporting(true);
        setExportError(null);
        const response = await projectService.exportProject(projectId, formatType);
        const baseName = (project?.name || `project_${projectId}`).replace(/[^a-z0-9-_]+/gi, '_');
        const filename = getExportFilename(response, `${baseName}_report.${formatType}`);
        downloadBlob(response.data, filename);
      } catch {
        setExportError('Failed to export project report. Please try again.');
      } finally {
        setExporting(false);
        closeExportMenu();
      }
    },
    [projectId, project, closeExportMenu]
  );

  return {
    project,
    loading,
    error,
    availableTags,
    // Edit dialog
    editDialogOpen,
    editFormData,
    setEditFormData,
    openEditDialog,
    closeEditDialog,
    handleUpdateProject,
    // Delete dialog
    deleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    handleDeleteProject,
    // Export
    exportAnchorEl,
    exporting,
    exportError,
    openExportMenu,
    closeExportMenu,
    handleExport,
    // Refresh
    refresh: loadProject,
  };
};
