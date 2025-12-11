import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Stack,
  Fade
} from '@mui/material';
import {
  Search as SearchIcon,
  Description as DescriptionIcon,
  Summarize as SummarizeIcon,
  Assignment as AssignmentIcon,
  Note as NoteIcon,
  Title as TitleIcon,
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import api from '../api';

const CONTENT_TYPE_ICONS = {
  transcript: <DescriptionIcon color="primary" />,
  summary: <SummarizeIcon color="secondary" />,
  action_item: <AssignmentIcon color="success" />,
  note: <NoteIcon color="warning" />,
  title: <TitleIcon color="info" />
};

const CONTENT_TYPE_LABELS = {
  transcript: 'Transcript',
  summary: 'Summary',
  action_item: 'Action Item',
  note: 'Note',
  title: 'Title'
};

const GlobalSearch = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchIn, setSearchIn] = useState(['transcripts', 'summaries', 'action_items', 'notes']);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/v1/search/', {
        query: searchQuery,
        search_in: searchIn,
        limit: 20
      });
      setResults(response.data.results || []);
      setTotal(response.data.total || 0);
      setSearchTime(response.data.search_time_ms || 0);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchIn]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleResultClick(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleResultClick = (result) => {
    onClose();
    navigate(`/meetings/${result.meeting_id}`);
  };

  const toggleSearchFilter = (filter) => {
    setSearchIn(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Search Input */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            fullWidth
            placeholder="Search meetings, transcripts, action items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? <CircularProgress size={20} /> : <SearchIcon />}
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Press Esc to close">
                    <IconButton onClick={onClose} size="small">
                      <CloseIcon />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
              sx: {
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                fontSize: '1.1rem'
              }
            }}
            autoComplete="off"
          />
          
          {/* Search Filters */}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {['transcripts', 'summaries', 'action_items', 'notes'].map(filter => (
              <Chip
                key={filter}
                label={filter.replace('_', ' ')}
                size="small"
                variant={searchIn.includes(filter) ? 'filled' : 'outlined'}
                color={searchIn.includes(filter) ? 'primary' : 'default'}
                onClick={() => toggleSearchFilter(filter)}
                sx={{ textTransform: 'capitalize' }}
              />
            ))}
          </Stack>
        </Box>

        {/* Results */}
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {results.length === 0 && query && !loading && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No results found for "{query}"
              </Typography>
            </Box>
          )}

          {results.length === 0 && !query && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Start typing to search across all your meetings
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                <Chip icon={<KeyboardIcon />} label="↑↓ Navigate" size="small" variant="outlined" />
                <Chip icon={<KeyboardIcon />} label="Enter Select" size="small" variant="outlined" />
                <Chip icon={<KeyboardIcon />} label="Esc Close" size="small" variant="outlined" />
              </Stack>
            </Box>
          )}

          <List sx={{ py: 0 }}>
            {results.map((result, index) => (
              <ListItem
                key={`${result.meeting_id}-${result.content_type}-${index}`}
                button
                selected={index === selectedIndex}
                onClick={() => handleResultClick(result)}
                sx={{
                  py: 1.5,
                  '&.Mui-selected': {
                    bgcolor: 'action.selected'
                  },
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemIcon>
                  {CONTENT_TYPE_ICONS[result.content_type]}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" noWrap sx={{ maxWidth: 300 }}>
                        {result.meeting_title}
                      </Typography>
                      <Chip 
                        label={CONTENT_TYPE_LABELS[result.content_type]} 
                        size="small" 
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      {result.folder && (
                        <Chip 
                          icon={<FolderIcon sx={{ fontSize: 14 }} />}
                          label={result.folder} 
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        mt: 0.5
                      }}
                    >
                      {result.snippet}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Footer */}
        {results.length > 0 && (
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">
              Found {total} results in {searchTime.toFixed(1)}ms
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;
