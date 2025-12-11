import React, { useState, useRef, useEffect } from 'react';
import { 
    Box, 
    TextField, 
    Button, 
    Paper, 
    Typography, 
    CircularProgress, 
    List,
    ListItem,
    ListItemText,
    Avatar,
    IconButton,
    Tooltip,
    Chip,
    Stack,
    Divider,
    Collapse,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel
} from '@mui/material';
import { 
    Send as SendIcon, 
    Assistant as AssistantIcon, 
    Person as PersonIcon,
    ClearAll as ClearAllIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';
import QuickActions from './QuickActions';
import './Chat.css';

const Chat = ({ meetingId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [topK, setTopK] = useState(5);
    const [expandedSources, setExpandedSources] = useState({});
    const [useFullTranscript, setUseFullTranscript] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Load chat history when component mounts
    useEffect(() => {
        const loadChatHistory = async () => {
            if (historyLoaded) return;
            
            try {
                const response = await api.get(`/api/v1/meetings/${meetingId}/chat/history`);
                if (response.data.history && response.data.history.length > 0) {
                    const hydratedHistory = response.data.history.map(msg => ({
                        ...msg,
                        sources: msg.sources || []
                    }));
                    setMessages(hydratedHistory);
                }
                setHistoryLoaded(true);
            } catch (error) {
                console.error('Error loading chat history:', error);
                setHistoryLoaded(true);
            }
        };

        if (meetingId) {
            loadChatHistory();
        }
    }, [meetingId, historyLoaded]);

    const clearChatHistory = async () => {
        try {
            await api.delete(`/api/v1/meetings/${meetingId}/chat/history`);
            setMessages([]);
        } catch (error) {
            console.error('Error clearing chat history:', error);
        }
    };

    const toggleSourcesExpanded = (index) => {
        setExpandedSources(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const handleSend = async () => {
        if (input.trim() && !isLoading) {
            const newMessages = [...messages, { role: 'user', content: input }];
            setMessages(newMessages);
            setInput('');
            setIsLoading(true);

            try {
                const chat_history = newMessages.slice(-6).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                const response = await api.post(`/api/v1/meetings/${meetingId}/chat`, {
                    query: input,
                    chat_history: chat_history,
                    top_k: topK,
                    use_full_transcript: useFullTranscript
                });

                setMessages([...newMessages, { role: 'assistant', content: response.data.response, sources: response.data.sources || [] }]);
            } catch (error) {
                console.error('Error sending message:', error);
                setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble getting a response. Please try again.', sources: [] }]);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const renderSources = (sources, messageIndex) => {
        if (!sources || sources.length === 0) {
            return null;
        }

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
                        {sources.map((source, index) => (
                            <Paper key={index} variant="outlined" className="source-card" sx={{ p: 1.5 }}>
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
                </Collapse>
            </Box>
        );
    };

    return (
        <Paper elevation={3} className="chat-container" sx={{ height: '100%' }}>
            <Box className="chat-header">
                <Typography variant="h5">
                    💬 Ask Questions About This Meeting
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Tooltip title="Use full transcript instead of RAG retrieval (still uses RAG for documents)">
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={useFullTranscript}
                                    onChange={(e) => setUseFullTranscript(e.target.checked)}
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: 'white',
                                        },
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
                                '& .MuiFormControlLabel-label': {
                                    fontSize: '0.875rem'
                                }
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
                                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                                    '.MuiSvgIcon-root': { color: 'white' }
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
                            <ListItemText className="message-text"
                                primary={
                                    msg.role === 'assistant' ? (
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
                                                                backgroundColor: 'action.hover',
                                                                padding: '2px 4px',
                                                                borderRadius: '3px',
                                                                fontSize: '0.9em'
                                                            }}>{children}</code>
                                                        ) : (
                                                            <pre style={{
                                                                backgroundColor: 'action.hover',
                                                                padding: '12px',
                                                                borderRadius: '5px',
                                                                overflow: 'auto',
                                                                fontSize: '0.9em'
                                                            }}>
                                                                <code {...props}>{children}</code>
                                                            </pre>
                                                        )
                                                    ),
                                                    blockquote: ({ children }) => (
                                                        <blockquote style={{
                                                            borderLeft: '4px solid #ddd',
                                                            margin: '16px 0',
                                                            paddingLeft: '16px',
                                                            fontStyle: 'italic',
                                                            color: '#666'
                                                        }}>
                                                            {children}
                                                        </blockquote>
                                                    )
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                            {renderSources(msg.sources, index)}
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
                {/* Quick Actions - show only when no messages and not loading */}
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
                            backgroundColor: 'action.hover'
                        }
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
                        }
                    }}
                >
                    {isLoading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <SendIcon />}
                </Button>
            </Box>
        </Paper>
    );
};

export default Chat;
