import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';

const PRODUCTIVITY_OPTIONS = [
  { value: '1', label: '1 - Very Low' },
  { value: '2', label: '2 - Low' },
  { value: '3', label: '3 - Below Average' },
  { value: '4', label: '4 - Slightly Below Average' },
  { value: '5', label: '5 - Average' },
  { value: '6', label: '6 - Slightly Above Average' },
  { value: '7', label: '7 - Good' },
  { value: '8', label: '8 - Very Good' },
  { value: '9', label: '9 - Excellent' },
  { value: '10', label: '10 - Outstanding' },
];

/**
 * Markdown editor / preview panel with productivity selector and drag-drop support.
 */
const DiaryEditor = ({
  content,
  onContentChange,
  previewMode,
  onTogglePreview,
  isDragging,
  onContentDrop,
  onContentDragOver,
  productivity,
  onProductivityChange,
}) => (
  <Box mb={3}>
    <FormControl fullWidth sx={{ mb: 2 }}>
      <InputLabel>Productivity Level</InputLabel>
      <Select
        value={productivity}
        onChange={(e) => onProductivityChange(e.target.value)}
        label="Productivity Level"
      >
        <MenuItem value="">
          <em>Not rated</em>
        </MenuItem>
        {PRODUCTIVITY_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>

    <Box mb={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" color="text.secondary">
          Notes (Markdown supported) - Drag action items here
        </Typography>
        <Button size="small" onClick={onTogglePreview} variant="outlined">
          {previewMode ? 'Edit' : 'Preview'}
        </Button>
      </Box>

      {!previewMode ? (
        <TextField
          fullWidth
          multiline
          rows={15}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onDrop={onContentDrop}
          onDragOver={onContentDragOver}
          placeholder="Write your daily notes here... You can drag action items from the right panel to reference them."
          sx={{
            '& .MuiInputBase-root': {
              borderWidth: isDragging ? 3 : 2,
              borderStyle: 'dashed',
              borderColor: isDragging ? 'primary.main' : 'primary.light',
              backgroundColor: isDragging ? 'action.hover' : 'inherit',
              transition: 'all 0.2s ease',
            },
          }}
        />
      ) : (
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            minHeight: 400,
            maxHeight: 600,
            overflow: 'auto',
            bgcolor: 'background.paper',
            '& h1': { fontSize: '1.5rem', fontWeight: 600, mb: 2 },
            '& h2': { fontSize: '1.25rem', fontWeight: 600, mt: 3, mb: 1 },
            '& h3': { fontSize: '1.1rem', fontWeight: 600, mt: 2, mb: 1 },
            '& ul': { pl: 3 },
            '& li': { mb: 0.5 },
            '& input[type="checkbox"]': { mr: 1 },
            '& p': { mb: 1 },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </Box>
      )}
    </Box>
  </Box>
);

export default DiaryEditor;
