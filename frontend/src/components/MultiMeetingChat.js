import React, { useEffect, useRef, useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  Send as SendIcon,
  Assistant as AssistantIcon,
  Person as PersonIcon,
  ClearAll as ClearAllIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';
import './Chat.css';

const MAX_CONTEXT_PREVIEW = 600;

const MultiMeetingChat = () => {
  const [availableMeetings, setAvailableMeetings] = useState([]);
  const [selectedMeetings, setSelectedMeetings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [topK, setTopK] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const loadMeetings = async () => {
      try {
        const response = await api.get('/api/v1/meetings/');
        const meetings = response.data || [];
        setAvailableMeetings(meetings);
      } catch (err) {
        setError('Unable to load meetings.');
      }
    };

    loadMeetings();
  }, []);

  const handleClearConversation = () => {
    setMessages([]);
    setError(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) {
      return;
    }

    const query = input.trim();
    const userMessage = { role: 'user', content: query };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const chatHistory = newMessages.slice(-6).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const payload = {
        query,
        chat_history: chatHistory,
      };

      if (selectedMeetings.length > 0) {
        payload.meeting_ids = selectedMeetings.map((meeting) => meeting.id);
      }

      if (topK) {
        payload.top_k = topK;
      }

      const response = await api.chatAcrossMeetings(payload);
      const assistantMessage = {
        role: 'assistant',
        content: response.data?.response || 'No response received.',
        contexts: response.data?.contexts || [],
      };
      setMessages([...newMessages, assistantMessage]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I could not retrieve an answer. Please try again.',
        },
      ]);
      const detail = err.response?.data?.detail || err.message;
      setError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopKChange = (event) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      setTopK(5);
      return;
    }
    const clamped = Math.min(Math.max(value, 1), 10);
    setTopK(clamped);
  };

  return (
    <Paper
      elevation={3}
      className="chat-container"
      sx={{
        mb: 4,
        minHeight: 520,
        height: { xs: 'auto', md: '65vh' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box className="chat-header">
        <Box>
          <Typography variant="h5">Cross-Meeting Chat</Typography>
          <Typography variant="body2" color="text.secondary">
            Ask questions across any meeting using retrieval-augmented responses.
          </Typography>
        </Box>
        <Tooltip title="Clear conversation">
          <span>
            <IconButton onClick={handleClearConversation} disabled={messages.length === 0 || isLoading}>
              <ClearAllIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ px: 2, py: 1 }}>
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }}>
          <Autocomplete
            multiple
            options={availableMeetings}
            value={selectedMeetings}
            disableCloseOnSelect
            getOptionLabel={(option) => option.filename || `Meeting ${option.id}`}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.filename || `Meeting ${option.id}`}
                />
              ))
            }
            onChange={(_, newValue) => setSelectedMeetings(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Filter meetings"
                placeholder="Select meetings or leave empty for all"
              />
            )}
            sx={{ flexGrow: 1, minWidth: 240 }}
          />
          <TextField
            label="Max context sections"
            type="number"
            value={topK}
            onChange={handleTopKChange}
            inputProps={{ min: 1, max: 10 }}
            sx={{ width: { xs: '100%', md: 200 } }}
          />
        </Stack>
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
        <Divider sx={{ mt: 2 }} />
      </Box>

      <Box className="chat-messages">
        <List>
          {messages.map((msg, index) => (
            <ListItem key={index} className={`message ${msg.role}`} alignItems="flex-start">
              <Avatar className={`avatar ${msg.role}`}>
                {msg.role === 'user' ? <PersonIcon /> : <AssistantIcon />}
              </Avatar>
              <ListItemText
                primary={
                  <Box>
                    {msg.role === 'assistant' ? (
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
                                  backgroundColor: '#f5f5f5',
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
                                  backgroundColor: '#f5f5f5',
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
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                    {msg.role === 'assistant' && msg.contexts && msg.contexts.length > 0 && (
                      <Box className="rag-context">
                        <Typography variant="subtitle2" color="primary">
                          Context used
                        </Typography>
                        {msg.contexts.map((ctx, ctxIndex) => {
                          const typeLabel = ctx.type
                            ? ctx.type.replace(/_/g, ' ')
                            : 'Context';
                          const detailParts = [typeLabel];
                          if (ctx.chunk_index) {
                            detailParts.push(`Chunk ${ctx.chunk_index}`);
                          }
                          const detailLabel = detailParts.filter(Boolean).join(' · ');
                          const contextPreview = ctx.content && ctx.content.length > MAX_CONTEXT_PREVIEW
                            ? `${ctx.content.slice(0, MAX_CONTEXT_PREVIEW)}…`
                            : ctx.content;
                          const scoreText =
                            typeof ctx.score === 'number' && !Number.isNaN(ctx.score)
                              ? ctx.score.toFixed(2)
                              : 'n/a';

                          return (
                            <Box key={`${ctx.meeting_id || ctxIndex}-${ctxIndex}`} className="rag-context-item">
                              <Typography variant="body2" fontWeight={600}>
                                {ctx.meeting_filename || `Meeting ${ctx.meeting_id || 'N/A'}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {detailLabel} · Relevance: {scoreText}
                              </Typography>
                              {contextPreview && (
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                  {contextPreview}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                }
                className="message-text"
              />
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      <Box className="chat-input-container">
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask a question about your meetings..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isLoading}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          disabled={isLoading}
          className="send-button"
        >
          {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
        </Button>
      </Box>
    </Paper>
  );
};

export default MultiMeetingChat;
