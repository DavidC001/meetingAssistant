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
    Tooltip
} from '@mui/material';
import { 
    Send as SendIcon, 
    Assistant as AssistantIcon, 
    Person as PersonIcon,
    ClearAll as ClearAllIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api';
import './Chat.css';

const Chat = ({ meetingId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
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
                    setMessages(response.data.history);
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
                    chat_history: chat_history
                });

                setMessages([...newMessages, { role: 'assistant', content: response.data.response }]);
            } catch (error) {
                console.error('Error sending message:', error);
                setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble getting a response. Please try again.' }]);
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <Paper elevation={3} className="chat-container" sx={{ height: '100%' }}>
            <Box className="chat-header">
                <Typography variant="h5">
                    💬 Ask Questions About This Meeting
                </Typography>
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
            <Box className="chat-messages">
                <List>
                    {messages.map((msg, index) => (
                        <ListItem key={index} className={`message ${msg.role}`}>
                            <Avatar className={`avatar ${msg.role}`}>
                                {msg.role === 'user' ? <PersonIcon /> : <AssistantIcon />}
                            </Avatar>
                            <ListItemText
                                primary={
                                    msg.role === 'assistant' ? (
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
                                    ) : (
                                        msg.content
                                    )
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
                            backgroundColor: '#f8f9fa'
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
