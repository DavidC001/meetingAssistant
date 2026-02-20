import React from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import MeetingPicker from './MeetingPicker';

/**
 * Shared dialog for creating and editing a project.
 * In create mode, `isEdit` is false — status selector is hidden.
 */
const ProjectFormDialog = ({
  open,
  isEdit,
  onClose,
  onSubmit,
  projectName,
  setProjectName,
  projectDescription,
  setProjectDescription,
  projectStatus,
  setProjectStatus,
  tags,
  setTags,
  availableTags,
  selectedMeetings,
  setSelectedMeetings,
}) => {
  const title = isEdit ? 'Edit Project' : 'Create New Project';
  const submitLabel = isEdit ? 'Update Project' : 'Create Project';

  const handleTagFilterOptions = (options, params) => {
    const filtered = options.filter((option) =>
      option.toLowerCase().includes(params.inputValue.toLowerCase())
    );
    if (params.inputValue !== '' && !filtered.includes(params.inputValue)) {
      filtered.push(params.inputValue);
    }
    return filtered;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
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

          {isEdit && (
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
          )}

          <Autocomplete
            multiple
            freeSolo
            options={availableTags}
            value={tags}
            onChange={(event, newValue) => setTags(newValue)}
            filterOptions={handleTagFilterOptions}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} size="small" />
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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          color="primary"
          disabled={!isEdit && selectedMeetings.length === 0}
        >
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectFormDialog;
