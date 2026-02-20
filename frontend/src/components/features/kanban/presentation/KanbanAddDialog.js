/**
 * KanbanAddDialog Component
 * Dialog for creating new action items with optional project linking
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
  Add as AddIcon,
  Close as CloseIcon,
  Flag as FlagIcon,
  HourglassEmpty as PendingIcon,
  PlayCircleOutline as InProgressIcon,
  CheckCircleOutline as CompletedIcon,
} from '@mui/icons-material';
import { projectService } from '../../../../services';
import logger from '../../../../utils/logger';

const KanbanAddDialog = ({
  open = false,
  isProjectMode = false,
  projectId = null,
  defaultStatus = 'pending',
  defaultOwner = '',
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState({
    task: '',
    owner: defaultOwner,
    priority: 'medium',
    due_date: '',
    status: defaultStatus,
  });

  const [projects, setProjects] = useState([]);
  const [addProjectIds, setAddProjectIds] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Reset form and fetch projects when dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        task: '',
        owner: defaultOwner,
        priority: 'medium',
        due_date: '',
        status: defaultStatus,
      });

      fetchProjects();
      setAddProjectIds(isProjectMode && projectId ? [projectId] : []);
    }
  }, [open, isProjectMode, projectId, defaultOwner, defaultStatus]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await projectService.listProjects();
      const raw = response?.data;
      const items = Array.isArray(raw) ? raw : raw?.items || raw?.data || raw?.projects || [];
      setProjects(items);
    } catch (error) {
      logger.error('Error fetching projects in KanbanAddDialog:', error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSave = () => {
    if (!form.task.trim()) return;
    onSave(form, addProjectIds);
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
          <AddIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            Add New Task
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
            autoFocus
            placeholder="What needs to be done?"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Assigned To"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              fullWidth
              placeholder="Enter name"
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={form.status}
                label="Status"
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <MenuItem value="pending">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PendingIcon sx={{ fontSize: 18 }} />
                    Pending
                  </Box>
                </MenuItem>
                <MenuItem value="in-progress">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InProgressIcon sx={{ fontSize: 18 }} />
                    In Progress
                  </Box>
                </MenuItem>
                <MenuItem value="completed">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CompletedIcon sx={{ fontSize: 18 }} />
                    Completed
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
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
            <TextField
              label="Due Date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
          <Box>
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
                  const isLinked = addProjectIds.includes(project.id);
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
                      onClick={() =>
                        setAddProjectIds((prev) =>
                          prev.includes(project.id)
                            ? prev.filter((id) => id !== project.id)
                            : [...prev, project.id]
                        )
                      }
                    />
                  );
                })}
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {isProjectMode
                ? 'Current project is always linked. Select additional projects to link.'
                : 'Select projects to link after creation'}
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
          startIcon={<AddIcon />}
          sx={{ borderRadius: 2 }}
          disabled={!form.task.trim()}
        >
          Add Task
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KanbanAddDialog;
