import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProjectChatService } from '../../../../services';

const useProjectChat = ({ projectIdProp } = {}) => {
  const { projectId: routeProjectId } = useParams();
  const projectId = projectIdProp || routeProjectId;

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState('');
  const [expandedSources, setExpandedSources] = useState({});
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const messagesEndRef = useRef(null);

  const hasSessions = useMemo(() => sessions.length > 0, [sessions]);

  useEffect(() => {
    if (!projectId) return;
    setActiveSessionId(null);
    setMessages([]);
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadSessions = async () => {
    if (!projectId) return;
    setLoadingSessions(true);
    setError('');
    try {
      const response = await ProjectChatService.listSessions(projectId);
      const sessionList = response || [];
      setSessions(sessionList);
      if (sessionList.length > 0) {
        const firstSessionId = sessionList[0].id;
        setActiveSessionId(firstSessionId);
        await loadMessages(firstSessionId);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      setError('Failed to load chat sessions.');
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadMessages = async (sessionId) => {
    if (!projectId || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      const response = await ProjectChatService.getMessages(projectId, sessionId);
      const history = response || [];
      const hydrated = history.map((message) => ({
        ...message,
        sources: Array.isArray(message.sources) ? message.sources : [],
      }));
      setMessages(hydrated);
    } catch (err) {
      setError('Failed to load chat messages.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = async (sessionId) => {
    if (!sessionId || sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    await loadMessages(sessionId);
  };

  const handleCreateSession = async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const response = await ProjectChatService.createSession(projectId, 'New chat');
      const newSession = response;
      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch (err) {
      setError('Failed to create a new chat.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRename = (session) => {
    setRenameSessionId(session.id);
    setRenameTitle(session.title || '');
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!projectId || !renameSessionId || !renameTitle.trim()) return;
    setLoading(true);
    setError('');
    try {
      await ProjectChatService.updateSession(projectId, renameSessionId, renameTitle.trim());
      await loadSessions();
      setRenameDialogOpen(false);
      setRenameSessionId(null);
      setRenameTitle('');
    } catch (err) {
      setError('Failed to rename the chat session.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!projectId || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      await ProjectChatService.deleteSession(projectId, sessionId);
      const remainingSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(remainingSessions);
      if (sessionId === activeSessionId) {
        const nextSession = remainingSessions[0];
        if (nextSession) {
          setActiveSessionId(nextSession.id);
          await loadMessages(nextSession.id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      setError('Failed to delete the chat session.');
    } finally {
      setLoading(false);
    }
  };

  const ensureSession = async () => {
    if (activeSessionId) return activeSessionId;
    const response = await ProjectChatService.createSession(projectId, 'New chat');
    const newSession = response;
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    return newSession.id;
  };

  const handleSendMessage = async () => {
    if (!projectId || !input.trim() || loading) return;
    setError('');
    const messageText = input.trim();
    setInput('');

    const optimistic = [...messages, { role: 'user', content: messageText }];
    setMessages(optimistic);
    setLoading(true);
    const activeSession = sessions.find((session) => session.id === activeSessionId);
    const shouldRefreshSessions = !activeSession || activeSession.title === 'New chat';

    try {
      const sessionId = await ensureSession();
      const response = await ProjectChatService.sendMessage(projectId, messageText, sessionId);
      const responseData = response;
      const assistantMessage = {
        role: 'assistant',
        content: responseData.message,
        sources: Array.isArray(responseData.sources) ? responseData.sources : [],
        follow_up_suggestions: Array.isArray(responseData.follow_up_suggestions)
          ? responseData.follow_up_suggestions
          : [],
      };
      setMessages([...optimistic, assistantMessage]);
      setActiveSessionId(responseData.session_id || sessionId);
      if (shouldRefreshSessions) {
        await loadSessions();
      }
    } catch (err) {
      setMessages([
        ...optimistic,
        {
          role: 'assistant',
          content: 'Sorry, I had trouble getting a response. Please try again.',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSourcesExpanded = (index) => {
    setExpandedSources((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return {
    projectId,
    sessions,
    activeSessionId,
    messages,
    input,
    setInput,
    loading,
    loadingSessions,
    error,
    expandedSources,
    renameDialogOpen,
    setRenameDialogOpen,
    renameSessionId,
    renameTitle,
    setRenameTitle,
    messagesEndRef,
    hasSessions,
    handleSelectSession,
    handleCreateSession,
    handleOpenRename,
    handleRenameConfirm,
    handleDeleteSession,
    handleSendMessage,
    toggleSourcesExpanded,
  };
};

export default useProjectChat;
