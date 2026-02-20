/**
 * KanbanEditDialog Component
 * Dialog for editing action items with project linking in global mode
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import { projectService } from '../../../../services';
import logger from '../../../../utils/logger';

const KanbanEditDialog = ({
  open = false,
  task = null,
  isProjectMode = false,
  projectId = null,
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState({
    id: null,
    task: '',
    owner: '',
    priority: 'medium',
    due_date: '',
  });

  const [projects, setProjects] = useState([]);
  const [selectedTaskProjects, setSelectedTaskProjects] = useState(new Set());
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Initialize form from task
  useEffect(() => {
    if (task) {
      setForm({
        id: task.id,
        task: task.task || '',
        owner: task.owner || '',
        priority: task.priority || 'medium',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
      });

      if (open) {
        fetchProjects(task.id);
      }
    }
  }, [task, open]);

  const fetchProjects = async (taskId) => {
    try {
      setLoadingProjects(true);
      const response = await projectService.listProjects();
      const raw = response?.data;
      const items = Array.isArray(raw) ? raw : raw?.items || raw?.data || raw?.projects || [];
      setProjects(items);

      // Check which projects contain this task
      if (taskId) {
        const projectChecks = await Promise.all(
          items.map(async (project) => {
            try {
              const res = await projectService.getActionItems(project.id);
              const projectItems = res?.data || [];
              return projectItems.some((item) => item.id === taskId) ? project.id : null;
            } catch {
              return null;
            }
          })
        );
        setSelectedTaskProjects(new Set(projectChecks.filter(Boolean)));
      }
    } catch (error) {
      logger.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleToggleProjectLink = async (projectId) => {
    if (!form.id) return;

    try {
      const { ActionItemService } = await import('../../../../services');

      if (selectedTaskProjects.has(projectId)) {
        await ActionItemService.unlinkFromProject(projectId, form.id);
        setSelectedTaskProjects((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      } else {
        await ActionItemService.linkToProject(projectId, form.id);
        setSelectedTaskProjects((prev) => new Set([...prev, projectId]));
      }
    } catch (error) {
      logger.error('Error toggling project link:', error);
    }
  };

  const handleSave = () => {
    if (!form.task.trim()) return;
    onSave(form);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
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
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            multiline
            rows={3}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Assigned To"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={form.priority}
                label="Priority"
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
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
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Projects
            </Typography>
            {loadingProjects ? (
              <CircularProgress size={24} />
            ) : projects.length === 0 ? (
              <Alert severity="info">No projects available.</Alert>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {projects.map((project) => {
                  const isLinked = selectedTaskProjects.has(project.id);
                  const isCurrentProject =
                    isProjectMode && projectId && String(project.id) === String(projectId);

                  return (
                    <Chip
                      key={project.id}
                      label={project.name}
                      clickable={!isCurrentProject}
                      disabled={isCurrentProject}
                      variant={isLinked ? 'filled' : 'outlined'}
                      color={isLinked ? 'primary' : 'default'}
                      onClick={() => handleToggleProjectLink(project.id)}
                    />
                  );
                })}
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {isProjectMode
                ? 'Current project is always linked in this view. Use chips to manage other project links.'
                : 'Click project chips to link/unlink this action item'}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 1 }}>
        <Button onClick={onCancel} startIcon={<CloseIcon />} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
          sx={{ borderRadius: 2 }}
          disabled={!form.task.trim()}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KanbanEditDialog;
