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
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../../api';

const FloatingChat = ({ meetingId, meetingTitle }) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [useFullTranscript, setUseFullTranscript] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  // Load existing session or create new one
  useEffect(() => {
    if (open && !sessionId) {
      // Try to get existing session for this meeting
      fetchSession();
    }
  }, [open]);

  const fetchSession = async () => {
    try {
      // Get sessions filtered by this meeting
      const response = await api.get('/api/v1/chat/sessions');
      const sessions = response.data;
      
      // Find session for this meeting (you might need to adjust based on your API)
      const meetingSession = sessions.find(s => 
        s.filter_meeting_ids && s.filter_meeting_ids.includes(meetingId)
      );
      
      if (meetingSession) {
        setSessionId(meetingSession.id);
        // Load messages
        const messagesResponse = await api.get(`/api/v1/chat/sessions/${meetingSession.id}/messages`);
        setMessages(messagesResponse.data);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    setIsLoading(true);

    try {
      // Create session if it doesn't exist
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const sessionResponse = await api.post('/api/v1/chat/sessions', {
          title: `Chat about ${meetingTitle}`,
          filter_meeting_ids: [meetingId],
        });
        currentSessionId = sessionResponse.data.id;
        setSessionId(currentSessionId);
      }

      // Send message with use_full_transcript parameter
      const response = await api.post(`/api/v1/chat/sessions/${currentSessionId}/messages`, {
        message: messageText,
        filter_meeting_ids: [meetingId],
        use_full_transcript: useFullTranscript,
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        sources: response.data.sources,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
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
        right: { xs: 0, sm: 16 },
        bottom: { xs: 0, sm: 16 },
        width: { xs: '100%', sm: 400 },
        height: minimized ? 'auto' : { xs: '100vh', sm: 600 },
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1300,
        transition: 'height 0.3s ease',
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
        <IconButton
          size="small"
          onClick={() => setMinimized(!minimized)}
          sx={{ color: 'inherit' }}
        >
          <MinimizeIcon />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => setOpen(false)}
          sx={{ color: 'inherit' }}
        >
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
            height: { xs: 'calc(100vh - 220px)', sm: 400 },
          }}
        >
          {messages.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <BotIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Ask me anything about this meeting!
              </Typography>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {['Summarize key points', 'What are the action items?', 'Who attended?'].map((suggestion, i) => (
                  <Chip
                    key={i}
                    label={suggestion}
                    size="small"
                    onClick={() => setInput(suggestion)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
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
                    p: 1.5,
                    maxWidth: '75%',
                    bgcolor: message.role === 'user' 
                      ? 'primary.main' 
                      : message.isError 
                      ? 'error.light'
                      : 'background.paper',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  }}
                  elevation={1}
                >
                  {message.role === 'assistant' ? (
                    <Box sx={{ 
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
                    }}>
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                  )}
                  
                  {message.sources && message.sources.length > 0 && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary">
                        Sources: {message.sources.length} segment(s)
                      </Typography>
                    </Box>
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
            label={
              <Typography variant="caption">
                Use full transcript
              </Typography>
            }
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
