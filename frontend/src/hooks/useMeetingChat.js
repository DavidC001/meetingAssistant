import { useState, useRef, useEffect, useCallback } from 'react';
import { MeetingChatService } from '../services';
import logger from '../utils/logger';

/**
 * Shared hook for meeting-scoped chat (used by both Chat and FloatingChat).
 *
 * Returns all state and handlers needed to render a chat interface
 * for a specific meeting. UI-only state (open/minimized/fullscreen) belongs
 * in the consuming container.
 *
 * @param {string|number} meetingId
 */
export function useMeetingChat(meetingId) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [topK, setTopK] = useState(5);
  const [expandedSources, setExpandedSources] = useState({});
  const [useFullTranscript, setUseFullTranscript] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadChatHistory = useCallback(async () => {
    if (historyLoaded || !meetingId) return;
    try {
      const response = await MeetingChatService.getHistory(meetingId, 50);
      if (response && response.history && response.history.length > 0) {
        const hydratedHistory = response.history.map((msg) => ({
          ...msg,
          sources: msg.sources || [],
        }));
        setMessages(hydratedHistory);
      }
      setHistoryLoaded(true);
    } catch (error) {
      logger.error('Error loading chat history:', error);
      setHistoryLoaded(true);
    }
  }, [meetingId, historyLoaded]);

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const messageText = input;
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = newMessages.slice(-6).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await MeetingChatService.sendMessage(meetingId, messageText, {
        chatHistory,
        topK,
        useFullTranscript,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.response,
          sources: response.sources || [],
          follow_up_suggestions: response.follow_up_suggestions || [],
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      logger.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I had trouble getting a response. Please try again.',
          sources: [],
          timestamp: new Date().toISOString(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, meetingId, topK, useFullTranscript]);

  const clearChatHistory = useCallback(async () => {
    try {
      await MeetingChatService.clearHistory(meetingId);
      setMessages([]);
      setExpandedSources({});
    } catch (error) {
      logger.error('Error clearing chat history:', error);
    }
  }, [meetingId]);

  const toggleSourcesExpanded = useCallback((index) => {
    setExpandedSources((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  return {
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
  };
}

export default useMeetingChat;
