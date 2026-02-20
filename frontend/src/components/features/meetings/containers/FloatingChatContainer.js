import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Fab,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  DeleteSweep as ClearIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Minimize as MinimizeIcon,
  Person as PersonIcon,
  Send as SendIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import useMeetingChat from '../../../../hooks/useMeetingChat';

const FloatingChatContainer = ({ meetingId }) => {
  // UI-only state stays in container
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const {
    messages,
    input,
    setInput,
    isLoading,
    expandedSources,
    useFullTranscript,
    setUseFullTranscript,
    messagesEndRef,
    handleSend,
    clearChatHistory,
    toggleSourcesExpanded,
  } = useMeetingChat(open ? meetingId : null);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderSources = (sources, messageIndex) => {
    if (!sources || sources.length === 0) return null;
    const isExpanded = expandedSources[messageIndex];

    return (
      <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <Button
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            toggleSourcesExpanded(messageIndex);
          }}
          endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ py: 0, minHeight: 24, fontSize: '0.75rem' }}
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
              const title =
                source.meeting_name ||
                (source.note_title && `Note: ${source.note_title}`) ||
                (source.attachment_name && `Attachment: ${source.attachment_name}`) ||
                (isToolResult ? toolLabel : null) ||
                (source.meeting_id ? `Meeting ${source.meeting_id}` : null) ||
                'Source';
              const snippetText = source.snippet || '';
              const displaySnippet =
                snippetText.length > 200 ? snippetText.substring(0, 200) + '...' : snippetText;
              return (
                <Paper key={index} variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                  <Typography variant="caption" color="primary" fontWeight="medium">
                    {title}
                  </Typography>
                  {!isToolResult && source.similarity != null && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {(source.content_type || 'transcript').replace('_', ' ')} • similarity:{' '}
                      {source.similarity.toFixed(2)}
                    </Typography>
                  )}
                  {isToolResult && toolLabel && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {toolLabel}
                      {source.metadata?.query ? ` — "${source.metadata.query}"` : ''}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, fontSize: '0.75rem', whiteSpace: 'pre-line' }}
                  >
                    {displaySnippet}
                  </Typography>
                  {source.metadata?.attachment_name && (
                    <Chip
                      size="small"
                      label={`📎 ${source.metadata.attachment_name}`}
                      sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }}
                    />
                  )}
                </Paper>
              );
            })}
          </Stack>
        </Collapse>
      </Box>
    );
  };

  if (!open) {
    return ReactDOM.createPortal(
      <Tooltip title="Chat about this meeting" placement="left">
        <Fab
          color="primary"
          aria-label="chat"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            bottom: { xs: 80, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 1000,
          }}
        >
          <ChatIcon />
        </Fab>
      </Tooltip>,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: fullscreen ? 0 : { xs: 0, sm: 16 },
        bottom: fullscreen ? 0 : { xs: 0, sm: 16 },
        top: fullscreen ? 0 : 'auto',
        left: fullscreen ? 0 : 'auto',
        width: fullscreen ? '100vw' : { xs: '100%', sm: 400 },
        height: minimized ? 'auto' : fullscreen ? '100vh' : { xs: '100vh', sm: 600 },
        maxWidth: fullscreen ? '100vw' : { xs: '100%', sm: 400 },
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1300,
        transition: 'all 0.3s ease',
        borderRadius: fullscreen ? 0 : undefined,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <ChatIcon />
        <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '1rem' }}>
          Meeting Chat
        </Typography>
        <Tooltip title="Clear chat history">
          <IconButton
            size="small"
            onClick={clearChatHistory}
            sx={{ color: 'inherit' }}
            disabled={messages.length === 0}
          >
            <ClearIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          <IconButton
            size="small"
            onClick={() => setFullscreen(!fullscreen)}
            sx={{ color: 'inherit' }}
          >
            {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
        <IconButton
          size="small"
          onClick={() => setMinimized(!minimized)}
          sx={{ color: 'inherit' }}
          disabled={fullscreen}
        >
          <MinimizeIcon />
        </IconButton>
        <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'inherit' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Collapse in={!minimized}>
        {/* Messages */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            height: fullscreen ? 'calc(100vh - 180px)' : { xs: 'calc(100vh - 220px)', sm: 400 },
          }}
        >
          {messages.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <BotIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Ask me anything about this meeting!
              </Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {['Summarize key points', 'What are the action items?', 'Who attended?'].map(
                  (suggestion, i) => (
                    <Chip
                      key={i}
                      label={suggestion}
                      size="small"
                      onClick={() => setInput(suggestion)}
                      sx={{ cursor: 'pointer' }}
                    />
                  )
                )}
              </Stack>
            </Box>
          ) : (
            messages.map((message, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-start',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                  }}
                >
                  {message.role === 'user' ? <PersonIcon /> : <BotIcon />}
                </Avatar>
                <Paper
                  sx={{
                    p: fullscreen ? 2 : 1.5,
                    maxWidth: fullscreen ? '800px' : '75%',
                    bgcolor:
                      message.role === 'user'
                        ? 'primary.main'
                        : message.isError
                          ? 'error.light'
                          : 'background.paper',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  }}
                  elevation={1}
                >
                  {message.role === 'assistant' ? (
                    <Box
                      sx={{
                        '& p': { my: 0.5 },
                        '& ul, & ol': { my: 0.5, pl: 2 },
                        '& code': {
                          bgcolor: 'action.hover',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontSize: '0.875em',
                        },
                        '& pre': {
                          bgcolor: 'action.hover',
                          p: 1,
                          borderRadius: 1,
                          overflow: 'auto',
                        },
                      }}
                    >
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                      {renderSources(message.sources, index)}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                  )}
                </Paper>
              </Box>
            ))
          )}

          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                <BotIcon />
              </Avatar>
              <Paper sx={{ p: 1.5 }} elevation={1}>
                <CircularProgress size={20} />
              </Paper>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <FormControlLabel
            control={
              <Switch
                checked={useFullTranscript}
                onChange={(e) => setUseFullTranscript(e.target.checked)}
                size="small"
              />
            }
            label={<Typography variant="caption">Use full transcript</Typography>}
            sx={{ mb: 1 }}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask about this meeting..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              multiline
              maxRows={3}
            />
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              sx={{ minWidth: 48 }}
            >
              <SendIcon />
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>,
    document.body
  );
};

export default FloatingChatContainer;
