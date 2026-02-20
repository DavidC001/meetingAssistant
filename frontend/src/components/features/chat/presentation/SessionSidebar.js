import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Chip,
  Stack,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Label as LabelIcon,
} from '@mui/icons-material';

/**
 * Left-hand sidebar: session list, search, add button, per-session edit/delete actions.
 * Fully controlled via props — no service calls.
 */
export function SessionSidebar({
  filteredSessions,
  activeSessionId,
  initialising,
  searchQuery,
  onSearchChange,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}) {
  return (
    <Box className="global-chat-sidebar">
      {/* Header */}
      <Box className="global-chat-sidebar-header">
        <Typography variant="h6">Sessions</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={onCreateSession} size="small">
          New
        </Button>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search sessions..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ mb: 1, px: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Session list */}
      {initialising ? (
        <Box className="global-chat-loading">
          <CircularProgress />
        </Box>
      ) : (
        <List className="global-chat-session-list">
          {filteredSessions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 2, px: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {searchQuery ? 'No sessions match your search' : 'No sessions yet'}
              </Typography>
            </Box>
          ) : (
            filteredSessions.map((session) => (
              <ListItemButton
                key={session.id}
                selected={session.id === activeSessionId}
                onClick={() => onSelectSession(session.id)}
                className="global-chat-session-item"
              >
                <ListItemText
                  primary={session.title || `Session ${session.id}`}
                  secondary={
                    <Box component="span">
                      <Typography variant="caption" display="block">
                        {new Date(session.updated_at).toLocaleString()}
                      </Typography>
                      {session.tags && (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          sx={{ mt: 0.5, flexWrap: 'wrap' }}
                          component="span"
                        >
                          {session.tags
                            .split(',')
                            .slice(0, 2)
                            .map((tag, i) => (
                              <Chip
                                key={i}
                                icon={<LabelIcon />}
                                label={tag.trim()}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            ))}
                          {session.tags.split(',').length > 2 && (
                            <Chip
                              label={`+${session.tags.split(',').length - 2}`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Stack>
                      )}
                    </Box>
                  }
                />
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRenameSession(session.id);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </ListItemButton>
            ))
          )}
        </List>
      )}
    </Box>
  );
}
