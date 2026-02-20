import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';

/**
 * Dialog for adding a new action item to the Gantt chart.
 */
const AddActionItemDialog = ({ open, onClose, addForm, setAddForm, onSave }) => {
  const setField = (field) => (e) => setAddForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Action Item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Task"
            value={addForm.task}
            onChange={setField('task')}
            required
            fullWidth
          />
          <TextField label="Owner" value={addForm.owner} onChange={setField('owner')} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={addForm.start_date}
              onChange={setField('start_date')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Due Date"
              type="date"
              value={addForm.due_date}
              onChange={setField('due_date')}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={addForm.status} label="Status" onChange={setField('status')}>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select value={addForm.priority} label="Priority" onChange={setField('priority')}>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TextField
            label="Notes"
            value={addForm.notes}
            onChange={setField('notes')}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddActionItemDialog;
