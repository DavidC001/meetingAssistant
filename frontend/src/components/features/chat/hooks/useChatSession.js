import { useState, useEffect, useCallback, useMemo } from 'react';
import { GlobalChatService, MeetingService } from '../../../../services';

/**
 * Manages all GlobalChat state: sessions CRUD, messaging, rename / filter dialogs.
 *
 * Returns a flat interface consumed by GlobalChatContainer and its presentational children.
 */
export function useChatSession() {
  // ── Session list ───────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [initialising, setInitialising] = useState(true);

  // ── Messages / send ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Search / topK / sources expansion ─────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [expandedSources, setExpandedSources] = useState({});

  // ── Tags ───────────────────────────────────────────────────────────────────
  const [allTags, setAllTags] = useState([]);

  // ── Rename dialog ──────────────────────────────────────────────────────────
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionTags, setNewSessionTags] = useState([]);

  // ── Filter dialog ──────────────────────────────────────────────────────────
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [availableFolders, setAvailableFolders] = useState([]);
  const [availableFilterTags, setAvailableFilterTags] = useState([]);
  const [tempFilterFolder, setTempFilterFolder] = useState('');
  const [tempFilterTags, setTempFilterTags] = useState([]);

  // ── Derived / memoized ─────────────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (session) =>
        session.title?.toLowerCase().includes(query) || session.tags?.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  const availableTags = useMemo(() => {
    const tagsSet = new Set(allTags);
    sessions.forEach((session) => {
      if (session.tags) {
        session.tags.split(',').forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) tagsSet.add(trimmed);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [sessions, allTags]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadSession = useCallback(async (sessionId) => {
    setLoading(true);
    try {
      const response = await GlobalChatService.getSession(sessionId);
      const history =
        response.messages?.map((message) => ({
          ...message,
          sources: message.sources || [],
        })) || [];
      setMessages(history);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setInitialising(true);
    try {
      const response = await GlobalChatService.listSessions();
      const sessionList = response || [];
      setSessions(sessionList);
      if (sessionList.length > 0) {
        const sessionId = sessionList[0].id;
        setActiveSessionId(sessionId);
        await loadSession(sessionId);
      }
    } catch {
      // silent
    } finally {
      setInitialising(false);
    }
  }, [loadSession]);

  const loadAllTags = useCallback(async () => {
    try {
      const response = await MeetingService.getAllTags();
      setAllTags(response || []);
    } catch {
      // silent
    }
  }, []);

  const loadFilterOptions = useCallback(async () => {
    try {
      const [foldersRes, tagsRes] = await Promise.all([
        GlobalChatService.getAvailableFolders(),
        GlobalChatService.getAvailableTags(),
      ]);
      setAvailableFolders(foldersRes || []);
      setAvailableFilterTags(tagsRes || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadAllTags();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session CRUD ───────────────────────────────────────────────────────────
  const handleCreateSession = useCallback(async () => {
    try {
      const response = await GlobalChatService.createSession({ title: '' });
      await loadSessions();
      setActiveSessionId(response.id);
      await loadSession(response.id);
    } catch {
      // silent
    }
  }, [loadSessions, loadSession]);

  const handleDeleteSession = useCallback(
    async (sessionId) => {
      try {
        await GlobalChatService.deleteSession(sessionId);
        if (sessionId === activeSessionId) {
          setMessages([]);
          setActiveSessionId(null);
        }
        await loadSessions();
      } catch {
        // silent
      }
    },
    [activeSessionId, loadSessions]
  );

  const handleSelectSession = useCallback(
    (sessionId) => {
      setActiveSessionId(sessionId);
      loadSession(sessionId);
    },
    [loadSession]
  );

  // ── Rename dialog ──────────────────────────────────────────────────────────
  const handleOpenRenameDialog = useCallback(
    (sessionId) => {
      const session = sessions.find((s) => s.id === sessionId);
      setRenameSessionId(sessionId);
      setNewSessionName(session?.title || '');
      const tagsArray = session?.tags
        ? session.tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t)
        : [];
      setNewSessionTags(tagsArray);
      setRenameDialogOpen(true);
    },
    [sessions]
  );

  const handleRenameConfirm = useCallback(async () => {
    if (!newSessionName.trim()) return;
    try {
      const tagsString = Array.isArray(newSessionTags)
        ? newSessionTags.filter((t) => t && t.trim()).join(', ')
        : '';
      await GlobalChatService.updateSession(renameSessionId, {
        title: newSessionName.trim(),
        tags: tagsString,
      });
      await loadSessions();
      await loadAllTags();
      setRenameDialogOpen(false);
      setRenameSessionId(null);
      setNewSessionName('');
      setNewSessionTags([]);
    } catch {
      // silent
    }
  }, [newSessionName, newSessionTags, renameSessionId, loadSessions, loadAllTags]);

  // ── Filter dialog ──────────────────────────────────────────────────────────
  const handleOpenFilterDialog = useCallback(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (session) {
      setTempFilterFolder(session.filter_folder || '');
      const filterTagsArray = session.filter_tags
        ? session.filter_tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t)
        : [];
      setTempFilterTags(filterTagsArray);
    }
    loadFilterOptions();
    setFilterDialogOpen(true);
  }, [sessions, activeSessionId, loadFilterOptions]);

  const handleApplyFilters = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const session = sessions.find((s) => s.id === activeSessionId);
      const filterTagsString = Array.isArray(tempFilterTags)
        ? tempFilterTags.filter((t) => t && t.trim()).join(', ')
        : '';
      await GlobalChatService.updateSession(activeSessionId, {
        title: session?.title,
        tags: session?.tags,
        filterFolder: tempFilterFolder || null,
        filterTags: filterTagsString || null,
      });
      await loadSessions();
      setFilterDialogOpen(false);
    } catch {
      // silent
    }
  }, [activeSessionId, sessions, tempFilterFolder, tempFilterTags, loadSessions]);

  const handleClearFilters = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const session = sessions.find((s) => s.id === activeSessionId);
      await GlobalChatService.updateSession(activeSessionId, {
        title: session?.title,
        tags: session?.tags,
        filterFolder: null,
        filterTags: null,
      });
      setTempFilterFolder('');
      setTempFilterTags([]);
      await loadSessions();
      setFilterDialogOpen(false);
    } catch {
      // silent
    }
  }, [activeSessionId, sessions, loadSessions]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    const question = input;
    setInput('');
    let sessionId = activeSessionId;
    let activeSession = sessions.find((session) => session.id === sessionId);
    const shouldAutoCreate = !sessionId;
    let shouldRefreshSessions = !activeSession || activeSession.title === 'New chat';

    try {
      const chatHistory = newMessages.slice(-6).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      if (shouldAutoCreate) {
        const created = await GlobalChatService.createSession({ title: 'New chat' });
        sessionId = created.id;
        setActiveSessionId(sessionId);
        activeSession = created;
        shouldRefreshSessions = true;
      }

      const response = await GlobalChatService.sendMessage(sessionId, question, {
        chatHistory,
        topK,
      });
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.content,
          sources: response.sources || [],
          follow_up_suggestions: response.follow_up_suggestions || [],
        },
      ]);
      if (shouldRefreshSessions) {
        await loadSessions();
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, I was unable to fetch a response.', sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, activeSessionId, sessions, topK, loadSessions]);

  // ── Sources expansion ──────────────────────────────────────────────────────
  const toggleSourcesExpanded = useCallback((index) => {
    setExpandedSources((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  return {
    // Session list
    sessions,
    filteredSessions,
    activeSessionId,
    initialising,
    searchQuery,
    setSearchQuery,
    handleCreateSession,
    handleDeleteSession,
    handleSelectSession,
    // Messages / send
    messages,
    input,
    setInput,
    loading,
    topK,
    setTopK,
    handleSend,
    // Sources
    expandedSources,
    toggleSourcesExpanded,
    // Tags
    availableTags,
    // Rename dialog
    renameDialogOpen,
    setRenameDialogOpen,
    newSessionName,
    setNewSessionName,
    newSessionTags,
    setNewSessionTags,
    handleOpenRenameDialog,
    handleRenameConfirm,
    // Filter dialog
    filterDialogOpen,
    setFilterDialogOpen,
    availableFolders,
    availableFilterTags,
    tempFilterFolder,
    setTempFilterFolder,
    tempFilterTags,
    setTempFilterTags,
    handleOpenFilterDialog,
    handleApplyFilters,
    handleClearFilters,
  };
}
