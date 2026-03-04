/**
 * SpeakersPanel Component
 * Displays and manages speakers for a meeting
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Stack,
  Autocomplete,
  Avatar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { stringAvatar } from '../../../../utils/stringAvatar';
import ConfirmDialog from '../../../common/ConfirmDialog';

/**
 * SpeakersPanel Component
 * @param {Object} props
 * @param {Array} props.speakers - List of speakers for meeting
 * @param {Array} props.allSpeakers - Available speakers for autocomplete
 * @param {Function} props.onUpdate - Callback when speaker is updated (speaker) => Promise<void>
 * @param {Function} props.onDelete - Callback when speaker is deleted (speakerId) => Promise<void>
 * @param {Function} props.onAdd - Callback when new speaker is added (speakerId) => Promise<void>
 */
export const SpeakersPanel = ({ speakers = [], allSpeakers = [], onUpdate, onDelete, onAdd }) => {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Unique speaker names from all meetings — used for rename autocomplete
  // allSpeakers can be an array of strings (from backend) or objects with name/speaker_name
  const allSpeakerNames = useMemo(
    () => [
      ...new Set(
        allSpeakers
          .map((s) => (typeof s === 'string' ? s : s.name || s.speaker_name))
          .filter(Boolean)
      ),
    ],
    [allSpeakers]
  );

  const handleEdit = (speaker) => {
    setEditingId(speaker.id);
    setEditingName(speaker.name || speaker.speaker_name || '');
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim()) return;
    try {
      setIsLoading(true);
      await onUpdate?.({
        ...speakers.find((s) => s.id === editingId),
        name: editingName.trim(),
      });
      setEditingId(null);
      setEditingName('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (speakerId) => {
    setConfirmDeleteId(speakerId);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsLoading(true);
      await onDelete?.(confirmDeleteId);
    } finally {
      setIsLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const handleAddSpeaker = async () => {
    if (!selectedSpeaker?.trim()) return;
    try {
      setIsLoading(true);
      await onAdd?.(selectedSpeaker.trim());
      setSelectedSpeaker('');
      setOpenAddDialog(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Build list of speaker names available for adding (excluding already-assigned names)
  const usedSpeakerNames = new Set(
    speakers.map((s) => (s.name || s.speaker_name || '').toLowerCase())
  );
  const availableForAdd = allSpeakerNames.filter(
    (name) => !usedSpeakerNames.has(name.toLowerCase())
  );

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
            Speakers ({speakers.length})
          </Typography>
          <IconButton size="small" onClick={() => setOpenAddDialog(true)} title="Add speaker">
            <AddIcon />
          </IconButton>
        </Box>

        {!speakers.length ? (
          <Alert severity="info">No speakers assigned to this meeting.</Alert>
        ) : (
          <List disablePadding>
            {speakers.map((speaker) => {
              const isEditing = editingId === speaker.id;
              return (
                <ListItem
                  key={speaker.id}
                  disableGutters
                  secondaryAction={
                    !isEditing ? (
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleEdit(speaker)}
                          disabled={isLoading}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleDelete(speaker.id)}
                          disabled={isLoading}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : undefined
                  }
                  sx={{
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                    // make room for the secondaryAction buttons when not editing
                    pr: isEditing ? 0 : 9,
                  }}
                >
                  <Avatar
                    {...stringAvatar(speaker.name || speaker.speaker_name || 'S')}
                    sx={{ mr: 2, flexShrink: 0 }}
                  />
                  {isEditing ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <Autocomplete
                        freeSolo
                        fullWidth
                        options={allSpeakerNames}
                        inputValue={editingName}
                        onInputChange={(_, value) => setEditingName(value)}
                        onChange={(_, value) => {
                          if (value) setEditingName(value);
                        }}
                        disabled={isLoading}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            autoFocus
                            placeholder="Speaker name..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditingName('');
                              }
                            }}
                          />
                        )}
                      />
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={handleSaveEdit}
                        disabled={isLoading || !editingName.trim()}
                        title="Save"
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                        disabled={isLoading}
                        title="Cancel"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <ListItemText
                      primary={speaker.name || speaker.speaker_name || 'Unknown'}
                      secondary={speaker.email || ''}
                    />
                  )}
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>

      {/* Add Speaker Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>
          Add Speaker
          <IconButton
            onClick={() => setOpenAddDialog(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ minWidth: '400px' }}>
          <Autocomplete
            freeSolo
            fullWidth
            options={availableForAdd}
            inputValue={selectedSpeaker || ''}
            onInputChange={(_, value) => setSelectedSpeaker(value)}
            onChange={(_, value) => {
              if (value) setSelectedSpeaker(value);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Speaker name"
                placeholder="Type or select a speaker name..."
              />
            )}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddSpeaker}
            variant="contained"
            disabled={!selectedSpeaker?.trim() || isLoading}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete Speaker"
        message="Are you sure you want to delete this speaker?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </Card>
  );
};

export default SpeakersPanel;
