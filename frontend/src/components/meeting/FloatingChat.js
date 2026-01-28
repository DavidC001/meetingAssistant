/**
 * FloatingChat Component
 *
 * Floating chat panel that slides in from the right for meeting-specific chat.
 * Persists across tab switches and can be minimized.
 */

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  TextField,
  Button,
  Fab,
  Collapse,
  Stack,
  Avatar,
  CircularProgress,
  Tooltip,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Minimize as MinimizeIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  DeleteSweep as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../../api';

const FloatingChat = ({ meetingId, meetingTitle }) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [useFullTranscript, setUseFullTranscript] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  // Load existing chat history for this meeting
  useEffect(() => {
    if (open && !historyLoaded && meetingId) {
      fetchChatHistory();
    }
  }, [open, meetingId, historyLoaded]);

  const fetchChatHistory = async () => {
    try {
      // Get chat history for this specific meeting
      const response = await api.get(`/api/v1/meetings/${meetingId}/chat/history?limit=50`);
      if (response.data && response.data.history) {
        const formattedMessages = response.data.history.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
        }));
        setMessages(formattedMessages);
      }
      setHistoryLoaded(true);
    } catch (err) {
      console.error('Error fetching chat history:', err);
      setHistoryLoaded(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const messageText = input;
    setInput('');
    setIsLoading(true);

    try {
      // Build chat history for context (last 6 messages)
      const chatHistory = newMessages.slice(-6).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Send message to meeting-specific chat endpoint
      const response = await api.post(`/api/v1/meetings/${meetingId}/chat`, {
        query: messageText,
        chat_history: chatHistory,
        top_k: 5,
        use_full_transcript: useFullTranscript,
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        sources: response.data.sources || [],
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.delete(`/api/v1/meetings/${meetingId}/chat/history`);
      setMessages([]);
      setExpandedSources({});
    } catch (err) {
      console.error('Error clearing chat history:', err);
    }
  };

  const toggleSourcesExpanded = (index) => {
    setExpandedSources((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const renderSources = (sources, messageIndex) => {
    if (!sources || sources.length === 0) {
      return null;
    }

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
            {sources.map((source, index) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{
                  p: 1,
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="caption" color="primary" fontWeight="medium">
                  {source.content_type?.replace('_', ' ') || 'transcript'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  similarity: {(source.similarity || 0).toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                  {source.snippet?.substring(0, 200)}
                  {source.snippet?.length > 200 ? '...' : ''}
                </Typography>
                {source.metadata?.attachment_name && (
                  <Chip
                    size="small"
                    label={`📎 ${source.metadata.attachment_name}`}
                    sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Paper>
            ))}
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
            onClick={handleClearHistory}
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

export default FloatingChat;
