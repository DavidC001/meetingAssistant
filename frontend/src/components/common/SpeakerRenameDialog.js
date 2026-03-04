/**
 * SpeakerRenameDialog Component
 *
 * Reusable dialog for renaming a speaker with autocomplete support.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  Typography,
} from '@mui/material';

/**
 * @param {Object} props
 * @param {boolean}  props.open          - Whether the dialog is open
 * @param {string}   props.speakerName   - Current speaker name (pre-filled)
 * @param {string[]} props.allSpeakerNames - Known speaker names for autocomplete
 * @param {Function} props.onConfirm     - Called with newName when confirmed
 * @param {Function} props.onClose       - Called when dialog is dismissed
 */
const SpeakerRenameDialog = ({ open, speakerName, allSpeakerNames = [], onConfirm, onClose }) => {
  const [newName, setNewName] = useState(speakerName || '');

  // Keep local state in sync when the dialog opens for a different speaker
  useEffect(() => {
    if (open) setNewName(speakerName || '');
  }, [open, speakerName]);

  const handleConfirm = () => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== speakerName) {
      onConfirm?.(trimmed);
    }
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rename Speaker</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Current name: <strong>{speakerName}</strong>
        </Typography>
        <Autocomplete
          freeSolo
          options={allSpeakerNames.filter((n) => n !== speakerName)}
          inputValue={newName}
          onInputChange={(_, value) => setNewName(value)}
          onChange={(_, value) => {
            if (value) setNewName(value);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="New name"
              autoFocus
              size="small"
              sx={{ mt: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
                if (e.key === 'Escape') onClose?.();
              }}
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!newName.trim() || newName.trim() === speakerName}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SpeakerRenameDialog;
