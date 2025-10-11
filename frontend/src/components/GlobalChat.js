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
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Assistant as AssistantIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';
import './GlobalChat.css';

const GlobalChat = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);
  const navigate = useNavigate();

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

  const loadSession = async (sessionId) => {
    setLoading(true);
    try {
      const response = await api.globalChat.getSession(sessionId);
      const history = response.data.messages?.map(message => ({
        ...message,
        sources: message.sources || []
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
      const chatHistory = newMessages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      const response = await api.globalChat.sendMessage(activeSessionId, question, chatHistory);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.data.content,
          sources: response.data.sources || []
        }
      ]);
    } catch (error) {
      console.error('Failed to send message', error);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I was unable to fetch a response.',
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderSources = (sources) => {
    if (!sources || sources.length === 0) {
      return null;
    }
    return (
      <Box className="global-source-container">
        <Divider textAlign="left" sx={{ mt: 1, mb: 1 }}>Sources</Divider>
        <Stack spacing={1} className="global-source-stack">
          {sources.map((source, index) => (
            <Paper
              key={index}
              variant="outlined"
              className="global-source-card"
              onClick={() => navigate(`/meetings/${source.meeting_id}`)}
            >
              <Typography variant="subtitle2" color="primary">
                {source.meeting_name || `Meeting ${source.meeting_id}`}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {source.content_type.replace('_', ' ')} • similarity {(source.similarity || 0).toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {source.snippet}
              </Typography>
              {source.metadata && source.metadata.attachment_name && (
                <Chip size="small" label={`Attachment: ${source.metadata.attachment_name}`} sx={{ mt: 1 }} />
              )}
            </Paper>
          ))}
        </Stack>
      </Box>
    );
  };

  return (
    <Box className="global-chat-page">
      <Paper className="global-chat-container" elevation={3}>
        <Box className="global-chat-sidebar">
          <Box className="global-chat-sidebar-header">
            <Typography variant="h6">Sessions</Typography>
            <Button startIcon={<AddIcon />} variant="contained" onClick={handleCreateSession} size="small">
              New
            </Button>
          </Box>
          {initialising ? (
            <Box className="global-chat-loading">
              <CircularProgress />
            </Box>
          ) : (
            <List className="global-chat-session-list">
              {sessions.map((session) => (
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
                    secondary={new Date(session.updated_at).toLocaleString()}
                  />
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box className="global-chat-content">
          <Box className="global-chat-header">
            <Typography variant="h5">AI Meeting Assistant</Typography>
            {loading && <CircularProgress size={24} />}
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
                          code: ({ inline, children, ...props }) => (
                            inline ? (
                              <code style={{
                                backgroundColor: '#f5f5f5',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                fontSize: '0.9em'
                              }}>{children}</code>
                            ) : (
                              <pre style={{
                                backgroundColor: '#f5f5f5',
                                padding: '12px',
                                borderRadius: '5px',
                                overflow: 'auto',
                                fontSize: '0.9em'
                              }}>
                                <code {...props}>{children}</code>
                              </pre>
                            )
                          )
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      {renderSources(message.sources)}
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
    </Box>
  );
};

export default GlobalChat;

