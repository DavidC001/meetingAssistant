import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Paper,
  Stack,
  Chip,
  Autocomplete,
  TextField,
} from '@mui/material';
import { Label as LabelIcon } from '@mui/icons-material';

/**
 * Filter dialog for constraining the chat assistant to specific folders or tags.
 * Fully controlled via props.
 */
export function ChatFilterDialog({
  open,
  onClose,
  // Active session info for displaying current filters
  activeSession,
  // Available options
  availableFolders,
  availableFilterTags,
  // Temp filter state (controlled)
  tempFilterFolder,
  onFolderChange,
  tempFilterTags,
  onTagsChange,
  // Actions
  onApply,
  onClearFilters,
}) {
  const hasActiveFilters = activeSession?.filter_folder || activeSession?.filter_tags;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Filter Meetings</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Constrain the AI to use only meetings matching these filters. Leave blank to search all
          meetings.
        </Typography>

        {/* Active filters display */}
        {hasActiveFilters && (
          <Paper
            sx={{
              p: 2,
              mb: 2,
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.200',
            }}
          >
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
              Active Filters:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {activeSession.filter_folder && (
                <Chip
                  label={`Folder: ${activeSession.filter_folder}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {activeSession.filter_tags &&
                activeSession.filter_tags
                  .split(',')
                  .map((tag, idx) => (
                    <Chip
                      key={idx}
                      label={`Tag: ${tag.trim()}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      icon={<LabelIcon />}
                    />
                  ))}
            </Stack>
          </Paper>
        )}

        {/* Folder filter */}
        <Autocomplete
          options={availableFolders}
          value={tempFilterFolder}
          onChange={(event, newValue) => onFolderChange(newValue || '')}
          freeSolo
          renderInput={(params) => (
            <TextField
              {...params}
              label="Filter by Folder"
              placeholder="Select or type folder name"
              helperText="Only include meetings from this folder"
              variant="outlined"
              margin="dense"
            />
          )}
          sx={{ mb: 2 }}
        />

        {/* Tags filter */}
        <Autocomplete
          multiple
          freeSolo
          options={availableFilterTags}
          value={tempFilterTags}
          onChange={(event, newValue) => onTagsChange(newValue)}
          filterOptions={(options, params) => {
            const filtered = options.filter((option) =>
              option.toLowerCase().includes(params.inputValue.toLowerCase())
            );
            if (params.inputValue !== '' && !filtered.includes(params.inputValue)) {
              filtered.push(params.inputValue);
            }
            return filtered;
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                icon={<LabelIcon />}
                label={option}
                {...getTagProps({ index })}
                size="small"
                color="primary"
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Filter by Tags"
              placeholder="Select or type tags..."
              helperText="Only include meetings with these tags (OR logic)"
              variant="outlined"
              margin="dense"
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClearFilters} color="warning">
          Clear All Filters
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onApply} variant="contained">
          Apply Filters
        </Button>
      </DialogActions>
    </Dialog>
  );
}
