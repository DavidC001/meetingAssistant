/**
 * MeetingMetadata Component
 * Displays and manages meeting tags and folder
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Autocomplete,
  TextField,
  Chip,
  Button,
  Stack,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon, Close as CloseIcon } from '@mui/icons-material';

/**
 * MeetingMetadata Component
 * @param {Object} props
 * @param {Array} props.tags - Current tags
 * @param {string} props.folder - Current folder
 * @param {Array} props.availableTags - Available tags for autocomplete
 * @param {Array} props.availableFolders - Available folders for autocomplete
 * @param {Function} props.onSave - Callback when metadata is saved (tags, folder) => Promise<void>
 * @param {boolean} props.isUpdating - Whether save is in progress
 */
export const MeetingMetadata = ({
  tags = [],
  folder = '',
  availableTags = [],
  availableFolders = [],
  onSave,
  isUpdating = false,
}) => {
  const [editingTags, setEditingTags] = useState(tags);
  const [editingFolder, setEditingFolder] = useState(folder);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditingTags(tags);
    setEditingFolder(folder);
    setHasChanges(false);
  }, [tags, folder]);

  const handleTagsChange = (event, newValue) => {
    setEditingTags(newValue);
    setHasChanges(true);
  };

  const handleFolderChange = (event, newValue) => {
    setEditingFolder(newValue || '');
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (onSave) {
      const success = await onSave(editingTags, editingFolder);
      if (success !== false) {
        setIsEditing(false);
        setHasChanges(false);
      }
    }
  };

  const handleCancel = () => {
    setEditingTags(tags);
    setEditingFolder(folder);
    setIsEditing(false);
    setHasChanges(false);
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
            Organization
          </Typography>
          {!isEditing && (
            <Button size="small" onClick={() => setIsEditing(true)} disabled={isUpdating}>
              Edit
            </Button>
          )}
        </Box>

        {!isEditing ? (
          <Stack spacing={2}>
            {/* Folder Display */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                Folder
              </Typography>
              {folder ? (
                <Chip label={folder} variant="outlined" onDelete={undefined} />
              ) : (
                <Typography variant="body2" color="textDisabled">
                  No folder assigned
                </Typography>
              )}
            </Box>

            {/* Tags Display */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                Tags ({tags.length})
              </Typography>
              {tags.length > 0 ? (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {tags.map((tag) => (
                    <Chip key={tag} label={tag} variant="outlined" size="small" />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="textDisabled">
                  No tags assigned
                </Typography>
              )}
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {/* Folder Edit */}
            <Autocomplete
              freeSolo
              options={availableFolders}
              value={editingFolder}
              onChange={handleFolderChange}
              onInputChange={(e, v) => {
                setEditingFolder(v);
                setHasChanges(true);
              }}
              disabled={isUpdating}
              renderInput={(params) => <TextField {...params} label="Folder" size="small" />}
            />

            {/* Tags Edit */}
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={editingTags}
              onChange={handleTagsChange}
              disabled={isUpdating}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label="Tags"
                  placeholder="Add tags"
                  size="small"
                />
              )}
            />

            {/* Action Buttons */}
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button startIcon={<CloseIcon />} onClick={handleCancel} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={isUpdating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={!hasChanges || isUpdating}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default MeetingMetadata;
