import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Button,
  TextField,
  CircularProgress,
  Stack,
  IconButton,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Assistant as AssistantIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Tune as TuneIcon,
  Search as SearchIcon,
  Label as LabelIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../../api';
import './GlobalChat.css';

const GlobalChat = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionTags, setNewSessionTags] = useState([]); // Changed to array for better Autocomplete handling
  const [searchQuery, setSearchQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [expandedSources, setExpandedSources] = useState({});
  const navigate = useNavigate();

  const [allTags, setAllTags] = useState([]);

  // Filter states
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [availableFolders, setAvailableFolders] = useState([]);
  const [availableFilterTags, setAvailableFilterTags] = useState([]);
  const [tempFilterFolder, setTempFilterFolder] = useState('');
  const [tempFilterTags, setTempFilterTags] = useState([]);

  const loadSessions = async () => {
    setInitialising(true);
    try {
      const response = await api.globalChat.listSessions();
      const sessionList = response.data || [];
      setSessions(sessionList);
      if (sessionList.length > 0) {
        const sessionId = sessionList[0].id;
        setActiveSessionId(sessionId);
        await loadSession(sessionId);
      }
    } catch (error) {
      console.error('Failed to load chat sessions', error);
    } finally {
      setInitialising(false);
    }
  };

  const loadAllTags = async () => {
    try {
      const response = await api.getAllTags();
      setAllTags(response.data || []);
    } catch (error) {
      console.error('Failed to load tags', error);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [foldersRes, tagsRes] = await Promise.all([
        api.globalChat.getAvailableFolders(),
        api.globalChat.getAvailableFilterTags(),
      ]);
      setAvailableFolders(foldersRes.data || []);
      setAvailableFilterTags(tagsRes.data || []);
    } catch (error) {
      console.error('Failed to load filter options', error);
    }
  };

  const handleOpenFilterDialog = () => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session) {
      setTempFilterFolder(session.filter_folder || '');
      const filterTagsArray = session.filter_tags
        ? session.filter_tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t)
        : [];
      setTempFilterTags(filterTagsArray);
    }
    loadFilterOptions();
    setFilterDialogOpen(true);
  };

  const handleApplyFilters = async () => {
    if (!activeSessionId) return;

    try {
      const session = sessions.find((s) => s.id === activeSessionId);
      const filterTagsString = Array.isArray(tempFilterTags)
        ? tempFilterTags.filter((t) => t && t.trim()).join(', ')
        : '';

      await api.globalChat.updateSession(
        activeSessionId,
        session?.title,
        session?.tags,
        tempFilterFolder || null,
        filterTagsString || null
      );
      await loadSessions();
      setFilterDialogOpen(false);
    } catch (error) {
      console.error('Failed to apply filters', error);
    }
  };

  const handleClearFilters = async () => {
    if (!activeSessionId) return;

    try {
      const session = sessions.find((s) => s.id === activeSessionId);
      await api.globalChat.updateSession(
        activeSessionId,
        session?.title,
        session?.tags,
        null,
        null
      );
      setTempFilterFolder('');
      setTempFilterTags([]);
      await loadSessions();
      setFilterDialogOpen(false);
    } catch (error) {
      console.error('Failed to clear filters', error);
    }
  };

  const loadSession = async (sessionId) => {
    setLoading(true);
    try {
      const response = await api.globalChat.getSession(sessionId);
      const history =
        response.data.messages?.map((message) => ({
          ...message,
          sources: message.sources || [],
        })) || [];
      setMessages(history);
    } catch (error) {
      console.error('Failed to load session', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadAllTags();
  }, []);

  const handleCreateSession = async () => {
    try {
      const response = await api.globalChat.createSession('');
      await loadSessions();
      setActiveSessionId(response.data.id);
      await loadSession(response.data.id);
    } catch (error) {
      console.error('Failed to create session', error);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await api.globalChat.deleteSession(sessionId);
      if (sessionId === activeSessionId) {
        setMessages([]);
        setActiveSessionId(null);
      }
      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session', error);
    }
  };

  const handleRenameSession = (sessionId) => {
    const session = sessions.find((s) => s.id === sessionId);
    setRenameSessionId(sessionId);
    setNewSessionName(session?.title || '');
    // Convert tags string to array for Autocomplete
    const tagsArray = session?.tags
      ? session.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t)
      : [];
    setNewSessionTags(tagsArray);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!newSessionName.trim()) return;

    try {
      // Convert tags array to comma-separated string
      const tagsString = Array.isArray(newSessionTags)
        ? newSessionTags.filter((t) => t && t.trim()).join(', ')
        : '';

      console.log('Saving tags:', { array: newSessionTags, string: tagsString });

      await api.globalChat.updateSession(renameSessionId, newSessionName.trim(), tagsString);
      await loadSessions();
      await loadAllTags(); // Refresh tags list
      setRenameDialogOpen(false);
      setRenameSessionId(null);
      setNewSessionName('');
      setNewSessionTags([]);
    } catch (error) {
      console.error('Failed to update session', error);
    }
  };

  const toggleSourcesExpanded = (index) => {
    setExpandedSources((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Filter sessions by search query
  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (session) =>
        session.title?.toLowerCase().includes(query) || session.tags?.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  // Get all available tags (from API and current sessions)
  const availableTags = React.useMemo(() => {
    const tagsSet = new Set(allTags);
    sessions.forEach((session) => {
      if (session.tags) {
        session.tags.split(',').forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) tagsSet.add(trimmed);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [sessions, allTags]);

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId) {
      return;
    }
    setLoading(true);
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    const question = input;
    setInput('');

    try {
      const chatHistory = newMessages.slice(-6).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      const response = await api.globalChat.sendMessage(
        activeSessionId,
        question,
        chatHistory,
        topK
      );
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.data.content,
          sources: response.data.sources || [],
        },
      ]);
    } catch (error) {
      console.error('Failed to send message', error);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I was unable to fetch a response.',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderSources = (sources, messageIndex) => {
    if (!sources || sources.length === 0) {
      return null;
    }

    const isExpanded = expandedSources[messageIndex];

    return (
      <Box className="global-source-container" sx={{ mt: 2 }}>
        <Button
          size="small"
          onClick={() => toggleSourcesExpanded(messageIndex)}
          endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mb: 1 }}
        >
          {isExpanded ? 'Hide' : 'Show'} Sources ({sources.length})
        </Button>
        <Collapse in={isExpanded}>
          <Stack spacing={1} className="global-source-stack">
            {sources.map((source, index) => (
              <Paper
                key={index}
                variant="outlined"
                className="global-source-card"
                onClick={() => navigate(`/meetings/${source.meeting_id}`)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  p: 1.5,
                }}
              >
                <Typography variant="subtitle2" color="primary">
                  {source.meeting_name || `Meeting ${source.meeting_id}`}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {source.content_type.replace('_', ' ')} • similarity{' '}
                  {(source.similarity || 0).toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {source.snippet}
                </Typography>
                {source.metadata && source.metadata.attachment_name && (
                  <Chip
                    size="small"
                    label={`Attachment: ${source.metadata.attachment_name}`}
                    sx={{ mt: 1 }}
                  />
                )}
              </Paper>
            ))}
          </Stack>
        </Collapse>
      </Box>
    );
  };

  return (
    <Box className="global-chat-page">
      <Paper className="global-chat-container" elevation={3}>
        <Box className="global-chat-sidebar">
          <Box className="global-chat-sidebar-header">
            <Typography variant="h6">Sessions</Typography>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={handleCreateSession}
              size="small"
            >
              New
            </Button>
          </Box>
          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="🔍 Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 1, px: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
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
                    onClick={() => {
                      setActiveSessionId(session.id);
                      loadSession(session.id);
                    }}
                    className="global-chat-session-item"
                  >
                    <ListItemText
                      primary={session.title || `Session ${session.id}`}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {new Date(session.updated_at).toLocaleString()}
                          </Typography>
                          {session.tags && (
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
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
                          handleRenameSession(session.id);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteSession(session.id);
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
        <Divider orientation="vertical" flexItem />
        <Box className="global-chat-content">
          <Box className="global-chat-header">
            <Typography variant="h5">AI Meeting Assistant</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Tooltip title="Filter meetings by folder or tags">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TuneIcon />}
                  onClick={handleOpenFilterDialog}
                  disabled={!activeSessionId}
                  color={
                    (activeSessionId &&
                      sessions.find((s) => s.id === activeSessionId)?.filter_folder) ||
                    sessions.find((s) => s.id === activeSessionId)?.filter_tags
                      ? 'primary'
                      : 'inherit'
                  }
                >
                  Filters
                  {activeSessionId &&
                    (sessions.find((s) => s.id === activeSessionId)?.filter_folder ||
                      sessions.find((s) => s.id === activeSessionId)?.filter_tags) && (
                      <Chip
                        size="small"
                        label="ON"
                        sx={{ ml: 1, height: 16, fontSize: '0.65rem' }}
                        color="primary"
                      />
                    )}
                </Button>
              </Tooltip>
              <Tooltip title="Number of sources to retrieve for each question">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Top-K Sources</InputLabel>
                  <Select
                    value={topK}
                    label="Top-K Sources"
                    onChange={(e) => setTopK(e.target.value)}
                  >
                    <MenuItem value={3}>3 Sources</MenuItem>
                    <MenuItem value={5}>5 Sources</MenuItem>
                    <MenuItem value={7}>7 Sources</MenuItem>
                    <MenuItem value={10}>10 Sources</MenuItem>
                  </Select>
                </FormControl>
              </Tooltip>
              {loading && <CircularProgress size={24} />}
            </Box>
          </Box>
          <Box className="global-chat-messages">
            {messages.map((message, index) => (
              <Box key={index} className={`global-chat-message ${message.role}`}>
                <Box className="global-chat-avatar">
                  {message.role === 'user' ? <PersonIcon /> : <AssistantIcon />}
                </Box>
                <Paper className="global-chat-message-content" elevation={0}>
                  {message.role === 'assistant' ? (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p style={{ margin: '8px 0' }}>{children}</p>,
                          ul: ({ children }) => <ul style={{ marginLeft: '20px' }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ marginLeft: '20px' }}>{children}</ol>,
                          code: ({ inline, children, ...props }) =>
                            inline ? (
                              <code
                                style={{
                                  backgroundColor: 'action.hover',
                                  padding: '2px 4px',
                                  borderRadius: '3px',
                                  fontSize: '0.9em',
                                }}
                              >
                                {children}
                              </code>
                            ) : (
                              <pre
                                style={{
                                  backgroundColor: 'action.hover',
                                  padding: '12px',
                                  borderRadius: '5px',
                                  overflow: 'auto',
                                  fontSize: '0.9em',
                                }}
                              >
                                <code {...props}>{children}</code>
                              </pre>
                            ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      {renderSources(message.sources, index)}
                    </>
                  ) : (
                    <Typography>{message.content}</Typography>
                  )}
                </Paper>
              </Box>
            ))}
          </Box>
          <Box className="global-chat-input">
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Ask the assistant about any meeting..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyPress={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              variant="contained"
              endIcon={<SendIcon />}
              onClick={handleSend}
              disabled={loading || !input.trim() || !activeSessionId}
            >
              Send
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Edit Session Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Chat Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Name"
            fullWidth
            variant="outlined"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            freeSolo
            options={availableTags}
            value={newSessionTags}
            onChange={(event, newValue) => {
              console.log('Autocomplete onChange:', newValue);
              // newValue is an array of strings (both selected and newly typed)
              setNewSessionTags(newValue);
            }}
            filterOptions={(options, params) => {
              const filtered = options.filter((option) =>
                option.toLowerCase().includes(params.inputValue.toLowerCase())
              );

              // Suggest the creation of a new value
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
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tags"
                placeholder="Add tags..."
                helperText="Select existing tags or type new ones. Press Enter to add."
                variant="outlined"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRenameConfirm}
            variant="contained"
            disabled={!newSessionName.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Filter Meetings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Constrain the AI to use only meetings matching these filters. Leave blank to search all
            meetings.
          </Typography>

          {/* Active Filters Display */}
          {activeSessionId &&
            (() => {
              const session = sessions.find((s) => s.id === activeSessionId);
              const hasFilters = session?.filter_folder || session?.filter_tags;
              return hasFilters ? (
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
                    {session.filter_folder && (
                      <Chip
                        label={`Folder: ${session.filter_folder}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    {session.filter_tags &&
                      session.filter_tags
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
              ) : null;
            })()}

          <Autocomplete
            options={availableFolders}
            value={tempFilterFolder}
            onChange={(event, newValue) => setTempFilterFolder(newValue || '')}
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

          <Autocomplete
            multiple
            freeSolo
            options={availableFilterTags}
            value={tempFilterTags}
            onChange={(event, newValue) => setTempFilterTags(newValue)}
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
          <Button onClick={handleClearFilters} color="warning">
            Clear All Filters
          </Button>
          <Button onClick={() => setFilterDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleApplyFilters} variant="contained">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GlobalChat;
