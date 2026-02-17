import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Assistant as AssistantIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ProjectChatService } from '../../../services';
import QuickActions from '../../QuickActions';

const ProjectChat = ({ projectId: projectIdProp }) => {
  const { projectId: routeProjectId } = useParams();
  const projectId = projectIdProp || routeProjectId;
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState('');
  const [expandedSources, setExpandedSources] = useState({});
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const messagesEndRef = useRef(null);

  const hasSessions = useMemo(() => sessions.length > 0, [sessions]);

  useEffect(() => {
    if (!projectId) return;
    setActiveSessionId(null);
    setMessages([]);
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadSessions = async () => {
    if (!projectId) return;
    setLoadingSessions(true);
    setError('');
    try {
      const response = await ProjectChatService.listSessions(projectId);
      const sessionList = response || [];
      setSessions(sessionList);
      if (sessionList.length > 0) {
        const firstSessionId = sessionList[0].id;
        setActiveSessionId(firstSessionId);
        await loadMessages(firstSessionId);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      setError('Failed to load chat sessions.');
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadMessages = async (sessionId) => {
    if (!projectId || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      const response = await ProjectChatService.getMessages(projectId, sessionId);
      const history = response || [];
      const hydrated = history.map((message) => ({
        ...message,
        sources: Array.isArray(message.sources) ? message.sources : [],
      }));
      setMessages(hydrated);
    } catch (err) {
      setError('Failed to load chat messages.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = async (sessionId) => {
    if (!sessionId || sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    await loadMessages(sessionId);
  };

  const handleCreateSession = async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const response = await ProjectChatService.createSession(projectId, 'New chat');
      const newSession = response;
      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch (err) {
      setError('Failed to create a new chat.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRename = (session) => {
    setRenameSessionId(session.id);
    setRenameTitle(session.title || '');
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!projectId || !renameSessionId || !renameTitle.trim()) return;
    setLoading(true);
    setError('');
    try {
      await ProjectChatService.updateSession(projectId, renameSessionId, renameTitle.trim());
      await loadSessions();
      setRenameDialogOpen(false);
      setRenameSessionId(null);
      setRenameTitle('');
    } catch (err) {
      setError('Failed to rename the chat session.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!projectId || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      await ProjectChatService.deleteSession(projectId, sessionId);
      const remainingSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(remainingSessions);
      if (sessionId === activeSessionId) {
        const nextSession = remainingSessions[0];
        if (nextSession) {
          setActiveSessionId(nextSession.id);
          await loadMessages(nextSession.id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      setError('Failed to delete the chat session.');
    } finally {
      setLoading(false);
    }
  };

  const ensureSession = async () => {
    if (activeSessionId) return activeSessionId;
    const response = await ProjectChatService.createSession(projectId, 'New chat');
    const newSession = response;
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    return newSession.id;
  };

  const handleSendMessage = async () => {
    if (!projectId || !input.trim() || loading) return;
    setError('');
    const messageText = input.trim();
    setInput('');

    const optimistic = [...messages, { role: 'user', content: messageText }];
    setMessages(optimistic);
    setLoading(true);
    const activeSession = sessions.find((session) => session.id === activeSessionId);
    const shouldRefreshSessions = !activeSession || activeSession.title === 'New chat';

    try {
      const sessionId = await ensureSession();
      const response = await ProjectChatService.sendMessage(projectId, messageText, sessionId);
      const responseData = response;
      const assistantMessage = {
        role: 'assistant',
        content: responseData.message,
        sources: Array.isArray(responseData.sources) ? responseData.sources : [],
        follow_up_suggestions: Array.isArray(responseData.follow_up_suggestions)
          ? responseData.follow_up_suggestions
          : [],
      };
      setMessages([...optimistic, assistantMessage]);
      setActiveSessionId(responseData.session_id || sessionId);
      if (shouldRefreshSessions) {
        await loadSessions();
      }
    } catch (err) {
      setMessages([
        ...optimistic,
        {
          role: 'assistant',
          content: 'Sorry, I had trouble getting a response. Please try again.',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSourcesExpanded = (index) => {
    setExpandedSources((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const renderFollowUpSuggestions = (suggestions, isLastAssistantMessage) => {
    if (!suggestions || suggestions.length === 0 || !isLastAssistantMessage || loading) return null;

    return (
      <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {suggestions.map((suggestion, idx) => (
          <Chip
            key={idx}
            label={suggestion}
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => setInput(suggestion)}
            sx={{
              cursor: 'pointer',
              fontSize: '0.8rem',
              '&:hover': { backgroundColor: 'primary.main', color: 'primary.contrastText' },
            }}
          />
        ))}
      </Box>
    );
  };

  const renderSources = (sources, messageIndex) => {
    if (!sources || sources.length === 0) return null;
    const isExpanded = expandedSources[messageIndex];

    return (
      <Box sx={{ mt: 2 }}>
        <Button
          size="small"
          onClick={() => toggleSourcesExpanded(messageIndex)}
          endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          {isExpanded ? 'Hide' : 'Show'} Sources ({sources.length})
        </Button>
        <Collapse in={isExpanded}>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {sources.map((source, index) => {
              const isToolResult =
                source.content_type === 'tool_result' || source.content_type === 'tool_search';
              const toolLabel =
                source.metadata?.tool_label || source.metadata?.tool?.replace('_', ' ');
              const title = source.note_title
                ? `Note: ${source.note_title}`
                : source.attachment_name
                  ? `Attachment: ${source.attachment_name}`
                  : source.meeting_name
                    ? source.meeting_name
                    : isToolResult
                      ? toolLabel
                      : source.meeting_id
                        ? `Meeting ${source.meeting_id}`
                        : 'Project Source';
              return (
                <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" color="primary">
                    {title}
                  </Typography>
                  {!isToolResult && source.similarity != null && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {(source.content_type || 'transcript').replace('_', ' ')} • similarity{' '}
                      {source.similarity.toFixed(2)}
                    </Typography>
                  )}
                  {isToolResult && toolLabel && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {toolLabel}
                      {source.metadata?.query ? ` — "${source.metadata.query}"` : ''}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                    {source.snippet}
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </Collapse>
      </Box>
    );
  };

  if (!projectId) {
    return null;
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, height: { xs: 'auto', md: '70vh' } }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          height: '100%',
        }}
      >
        <Box
          sx={{
            width: { xs: '100%', md: 260 },
            borderRight: { xs: 'none', md: '1px solid' },
            borderColor: 'divider',
            pr: { xs: 0, md: 2 },
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">Project Chats</Typography>
            <Tooltip title="New chat">
              <IconButton size="small" onClick={handleCreateSession} disabled={loading}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {loadingSessions ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : !hasSessions ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary" mb={2}>
                No chats yet
              </Typography>
              <Button variant="outlined" onClick={handleCreateSession} startIcon={<AddIcon />}>
                New chat
              </Button>
            </Box>
          ) : (
            <List dense>
              {sessions.map((session) => (
                <ListItemButton
                  key={session.id}
                  selected={session.id === activeSessionId}
                  onClick={() => handleSelectSession(session.id)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemText
                    primary={session.title || 'New chat'}
                    secondary={`${session.message_count || 0} messages`}
                  />
                  <Tooltip title="Rename">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenRename(session);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Box>
              <Typography variant="h6">Chat with Project</Typography>
              <Typography variant="body2" color="text.secondary">
                Ask questions across all meetings in this project.
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ mb: 2 }} />

          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              mb: 2,
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
            }}
          >
            {error && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'error.main' }}>
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              </Paper>
            )}
            {messages.length === 0 && !loading ? (
              <Box textAlign="center" py={4}>
                <AssistantIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary" gutterBottom>
                  Start a conversation about your project
                </Typography>
                <Box sx={{ mt: 2, maxWidth: 500, mx: 'auto' }}>
                  <QuickActions onSelectPrompt={(prompt) => setInput(prompt)} isProject />
                </Box>
              </Box>
            ) : (
              messages.map((message, index) => (
                <Box
                  key={`${message.role}-${index}`}
                  sx={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    mb: 2,
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '75%',
                      bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                      color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      {message.role === 'user' ? (
                        <PersonIcon fontSize="small" />
                      ) : (
                        <AssistantIcon fontSize="small" />
                      )}
                      <Typography variant="subtitle2">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </Typography>
                    </Stack>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    {message.role !== 'user' && renderSources(message.sources, index)}
                    {message.role !== 'user' &&
                      renderFollowUpSuggestions(
                        message.follow_up_suggestions,
                        index === messages.length - 1
                      )}
                  </Paper>
                </Box>
              ))
            )}
            {loading && (
              <Box display="flex" justifyContent="flex-start" mb={2}>
                <Paper sx={{ p: 2 }}>
                  <CircularProgress size={20} />
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              placeholder="Ask a question about your project..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyPress={(event) => {
                if (event.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              disabled={loading}
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!input.trim() || loading}
            >
              <SendIcon />
            </Button>
          </Stack>
        </Box>
      </Box>

      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rename chat</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRenameConfirm}
            disabled={!renameTitle.trim() || loading}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProjectChat;
