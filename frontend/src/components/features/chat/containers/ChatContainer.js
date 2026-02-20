import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Assistant as AssistantIcon,
  ClearAll as ClearAllIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import QuickActions from '../../../common/QuickActions';
import useMeetingChat from '../../../../hooks/useMeetingChat';
import '../Chat.css';

const ChatContainer = ({ meetingId }) => {
  const {
    messages,
    input,
    setInput,
    isLoading,
    topK,
    setTopK,
    expandedSources,
    useFullTranscript,
    setUseFullTranscript,
    messagesEndRef,
    handleSend,
    clearChatHistory,
    toggleSourcesExpanded,
  } = useMeetingChat(meetingId);

  const renderFollowUpSuggestions = (suggestions, isLastAssistantMessage) => {
    if (!suggestions || suggestions.length === 0 || !isLastAssistantMessage || isLoading)
      return null;

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
      <Box className="source-container" sx={{ mt: 2 }}>
        <Button
          size="small"
          onClick={() => toggleSourcesExpanded(messageIndex)}
          endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mb: 1 }}
        >
          {isExpanded ? 'Hide' : 'Show'} Sources ({sources.length})
        </Button>
        <Collapse in={isExpanded}>
          <Stack spacing={1} className="source-stack">
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
              return (
                <Paper key={index} variant="outlined" className="source-card" sx={{ p: 1.5 }}>
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
                  {source.metadata && source.metadata.attachment_name && (
                    <Chip
                      size="small"
                      label={`Attachment: ${source.metadata.attachment_name}`}
                      sx={{ mt: 1 }}
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

  return (
    <Paper elevation={3} className="chat-container" sx={{ height: '100%' }}>
      <Box className="chat-header">
        <Typography variant="h5">💬 Ask Questions About This Meeting</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Use full transcript instead of RAG retrieval (still uses RAG for documents)">
            <FormControlLabel
              control={
                <Switch
                  checked={useFullTranscript}
                  onChange={(e) => setUseFullTranscript(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: 'white' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: 'white',
                    },
                  }}
                />
              }
              label="Full Transcript"
              sx={{
                color: 'white',
                m: 0,
                '& .MuiFormControlLabel-label': { fontSize: '0.875rem' },
              }}
            />
          </Tooltip>
          <Tooltip title="Number of sources to retrieve for each question (RAG mode only)">
            <FormControl size="small" sx={{ minWidth: 120 }} disabled={useFullTranscript}>
              <InputLabel sx={{ color: 'white' }}>Top-K</InputLabel>
              <Select
                value={topK}
                label="Top-K"
                onChange={(e) => setTopK(e.target.value)}
                sx={{
                  color: 'white',
                  '.MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                  '.MuiSvgIcon-root': { color: 'white' },
                }}
              >
                <MenuItem value={3}>3 Sources</MenuItem>
                <MenuItem value={5}>5 Sources</MenuItem>
                <MenuItem value={7}>7 Sources</MenuItem>
                <MenuItem value={10}>10 Sources</MenuItem>
              </Select>
            </FormControl>
          </Tooltip>
          <Tooltip title="Clear chat history">
            <IconButton
              onClick={clearChatHistory}
              sx={{ color: 'white' }}
              disabled={isLoading || messages.length === 0}
            >
              <ClearAllIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box className="chat-messages">
        <List>
          {messages.map((msg, index) => (
            <ListItem key={index} className={`message ${msg.role}`}>
              <Avatar className={`avatar ${msg.role}`}>
                {msg.role === 'user' ? <PersonIcon /> : <AssistantIcon />}
              </Avatar>
              <ListItemText
                className="message-text"
                primary={
                  msg.role === 'assistant' ? (
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
                          blockquote: ({ children }) => (
                            <blockquote
                              style={{
                                borderLeft: '4px solid #ddd',
                                margin: '16px 0',
                                paddingLeft: '16px',
                                fontStyle: 'italic',
                                color: '#666',
                              }}
                            >
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {renderSources(msg.sources, index)}
                      {renderFollowUpSuggestions(
                        msg.follow_up_suggestions,
                        index === messages.length - 1 && msg.role === 'assistant'
                      )}
                    </>
                  ) : (
                    msg.content
                  )
                }
              />
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      <Box className="chat-input-container">
        {messages.length === 0 && !isLoading && (
          <QuickActions onSelectPrompt={(prompt) => setInput(prompt)} />
        )}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask a question about the meeting..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={isLoading}
          multiline
          maxRows={4}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              backgroundColor: 'action.hover',
            },
          }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="send-button"
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
            },
          }}
        >
          {isLoading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <SendIcon />}
        </Button>
      </Box>
    </Paper>
  );
};

export default ChatContainer;
