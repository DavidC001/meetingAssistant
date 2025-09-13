import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, Button, Paper, Typography, CircularProgress, List, ListItem, ListItemText, Avatar } from '@mui/material';
import { Send as SendIcon, Assistant as AssistantIcon, Person as PersonIcon } from '@mui/icons-material';
import api from '../api';
import './Chat.css';

const Chat = ({ meetingId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

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
        <Paper elevation={3} className="chat-container">
            <Typography variant="h5" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                Chat with Meeting
            </Typography>
            <Box className="chat-messages">
                <List>
                    {messages.map((msg, index) => (
                        <ListItem key={index} className={`message ${msg.role}`}>
                            <Avatar className={`avatar ${msg.role}`}>
                                {msg.role === 'user' ? <PersonIcon /> : <AssistantIcon />}
                            </Avatar>
                            <ListItemText
                                primary={msg.content}
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
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
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

export default Chat;
