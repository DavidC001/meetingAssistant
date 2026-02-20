import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Assistant as AssistantIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useProjectChat from '../hooks/useProjectChat';
import QuickActions from '../../../common/QuickActions';

const ProjectChatContainer = ({ projectId: projectIdProp }) => {
  const {
    projectId,
    sessions,
    activeSessionId,
    messages,
    input,
    setInput,
    loading,
    loadingSessions,
    error,
    expandedSources,
    renameDialogOpen,
    setRenameDialogOpen,
    renameTitle,
    setRenameTitle,
    messagesEndRef,
    hasSessions,
    handleSelectSession,
    handleCreateSession,
    handleOpenRename,
    handleRenameConfirm,
    handleDeleteSession,
    handleSendMessage,
    toggleSourcesExpanded,
  } = useProjectChat({ projectIdProp });

  if (!projectId) return null;

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
        {/* Sessions sidebar */}
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

        {/* Chat area */}
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

      {/* Rename dialog */}
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

export default ProjectChatContainer;
