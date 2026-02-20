import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Typography,
  FormControlLabel,
  Switch,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Google as GoogleIcon,
} from '@mui/icons-material';

/**
 * Action item create / edit dialog.
 * Fully controlled — all state and handlers come from props.
 */
export function EventDetailDialog({
  open,
  editMode,
  selectedEvent,
  formData,
  onFormChange,
  onSave,
  onClose,
  onDelete,
  // Project linking
  projects,
  loadingProjects,
  linkedProjects,
  newItemProjectIds,
  onProjectLink,
  onNewItemProjectToggle,
  // Google sync
  googleConnected,
  onSyncItem,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editMode ? 'Edit Action Item' : 'New Action Item'}
        {selectedEvent?.resource?.synced_to_calendar && (
          <Chip icon={<GoogleIcon />} label="Synced" size="small" color="success" sx={{ ml: 2 }} />
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Meeting source info */}
          {selectedEvent?.resource?.meeting_title && (
            <Alert severity="info" icon={false}>
              <Typography variant="body2">
                <strong>From Meeting:</strong> {selectedEvent.resource.meeting_title}
                {selectedEvent.resource.meeting_id && (
                  <Button
                    size="small"
                    sx={{ ml: 1 }}
                    onClick={() =>
                      window.open(`/meetings/${selectedEvent.resource.meeting_id}`, '_blank')
                    }
                  >
                    View Meeting
                  </Button>
                )}
              </Typography>
              {selectedEvent.resource.meeting_date && (
                <Typography variant="caption" color="text.secondary">
                  Meeting Date: {new Date(selectedEvent.resource.meeting_date).toLocaleDateString()}
                </Typography>
              )}
            </Alert>
          )}

          <TextField
            label="Task"
            fullWidth
            value={formData.task}
            onChange={(e) => onFormChange('task', e.target.value)}
            required
            multiline
            rows={2}
          />
          <TextField
            label="Owner"
            fullWidth
            value={formData.owner}
            onChange={(e) => onFormChange('owner', e.target.value)}
          />
          <TextField
            label="Due Date"
            type="date"
            fullWidth
            value={formData.due_date}
            onChange={(e) => onFormChange('due_date', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={formData.status}
              label="Status"
              onChange={(e) => onFormChange('status', e.target.value)}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.priority}
              label="Priority"
              onChange={(e) => onFormChange('priority', e.target.value)}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Notes"
            fullWidth
            value={formData.notes}
            onChange={(e) => onFormChange('notes', e.target.value)}
            multiline
            rows={3}
          />

          {/* Project linking */}
          {projects.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Projects
              </Typography>
              {loadingProjects ? (
                <CircularProgress size={24} />
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {projects.map((project) => {
                    const isLinked = editMode
                      ? linkedProjects.has(project.id)
                      : newItemProjectIds.includes(project.id);
                    return (
                      <Chip
                        key={project.id}
                        label={project.name}
                        clickable
                        variant={isLinked ? 'filled' : 'outlined'}
                        color={isLinked ? 'primary' : 'default'}
                        onClick={() => {
                          if (editMode) {
                            onProjectLink(project.id);
                          } else {
                            onNewItemProjectToggle(project.id);
                          }
                        }}
                        sx={{
                          '&:hover': {
                            backgroundColor: isLinked ? 'primary.dark' : 'action.hover',
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {editMode
                  ? 'Click project chips to link/unlink this action item'
                  : 'Select projects to link after creation'}
              </Typography>
            </Box>
          )}

          {/* Google sync toggle (edit mode only) */}
          {editMode && googleConnected && (
            <FormControlLabel
              control={
                <Switch
                  checked={selectedEvent?.resource?.synced_to_calendar || false}
                  onChange={() =>
                    onSyncItem(selectedEvent.id, selectedEvent.resource.synced_to_calendar)
                  }
                />
              }
              label="Sync to Google Calendar"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {editMode && (
          <Button onClick={onDelete} color="error" startIcon={<DeleteIcon />}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSave}
          variant="contained"
          startIcon={editMode ? <EditIcon /> : <AddIcon />}
        >
          {editMode ? 'Save Changes' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
