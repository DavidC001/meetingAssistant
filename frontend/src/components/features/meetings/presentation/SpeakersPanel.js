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
  const [selectedSpeaker, setSelectedSpeaker] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Unique speaker names from all meetings — used for rename autocomplete
  const allSpeakerNames = useMemo(
    () => [...new Set(allSpeakers.map((s) => s.name || s.speaker_name).filter(Boolean))],
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
    if (!selectedSpeaker) return;
    try {
      setIsLoading(true);
      await onAdd?.(selectedSpeaker.id);
      setSelectedSpeaker(null);
      setOpenAddDialog(false);
    } finally {
      setIsLoading(false);
    }
  };

  const usedSpeakerIds = new Set(speakers.map((s) => s.id));
  const availableForAdd = allSpeakers.filter((s) => !usedSpeakerIds.has(s.id));

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
            {speakers.map((speaker) => (
              <ListItem
                key={speaker.id}
                secondaryAction={
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
                }
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 1,
                  px: 0,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': {
                    borderBottom: 'none',
                  },
                }}
              >
                <Avatar
                  {...stringAvatar(speaker.name || speaker.speaker_name || 'S')}
                  sx={{ mr: 2 }}
                />
                {editingId === speaker.id ? (
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
                        onBlur={handleSaveEdit}
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
                ) : (
                  <ListItemText
                    primary={speaker.name || speaker.speaker_name || 'Unknown'}
                    secondary={speaker.email || ''}
                  />
                )}
              </ListItem>
            ))}
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
            fullWidth
            options={availableForAdd}
            getOptionLabel={(option) => option.name || option.speaker_name || ''}
            value={selectedSpeaker}
            onChange={(e, v) => setSelectedSpeaker(v)}
            renderInput={(params) => <TextField {...params} label="Select speaker" />}
            sx={{ mt: 2 }}
          />
          {availableForAdd.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              All available speakers are already assigned.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddSpeaker}
            variant="contained"
            disabled={!selectedSpeaker || isLoading}
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
