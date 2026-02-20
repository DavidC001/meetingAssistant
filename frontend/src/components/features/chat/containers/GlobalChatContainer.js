import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Stack,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Autocomplete,
  Collapse,
} from '@mui/material';
import {
  Send as SendIcon,
  Assistant as AssistantIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Tune as TuneIcon,
  Label as LabelIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useChatSession } from '../hooks/useChatSession';
import { SessionSidebar } from '../presentation/SessionSidebar';
import { ChatFilterDialog } from '../presentation/ChatFilterDialog';
import QuickActions from '../../../common/QuickActions';
import '../GlobalChat.css';

const GlobalChatContainer = () => {
  const navigate = useNavigate();

  const {
    // Session list
    filteredSessions,
    activeSessionId,
    sessions,
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
  } = useChatSession();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const hasActiveFilters = activeSession?.filter_folder || activeSession?.filter_tags;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const renderFollowUpSuggestions = (suggestions, isLastAssistantMessage) => {
    if (!suggestions || suggestions.length === 0 || !isLastAssistantMessage || loading) return null;
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
      <Box className="global-source-container" sx={{ mt: 2 }}>
        <Button
          size="small"
          onClick={() => toggleSourcesExpanded(messageIndex)}
          endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mb: 1 }}
        >
          {isExpanded ? 'Hide' : 'Show'} Sources ({sources.length})
        </Button>
        <Collapse in={isExpanded}>
          <Stack spacing={1} className="global-source-stack">
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
              const isClickable = !!source.meeting_id;
              return (
                <Paper
                  key={index}
                  variant="outlined"
                  className="global-source-card"
                  onClick={
                    isClickable ? () => navigate(`/meetings/${source.meeting_id}`) : undefined
                  }
                  sx={{
                    cursor: isClickable ? 'pointer' : 'default',
                    '&:hover': isClickable ? { bgcolor: 'action.hover' } : {},
                    p: 1.5,
                  }}
                >
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
                  {source.metadata?.attachment_name && (
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box className="global-chat-page">
      <Paper className="global-chat-container" elevation={3}>
        {/* Sidebar */}
        <SessionSidebar
          filteredSessions={filteredSessions}
          activeSessionId={activeSessionId}
          initialising={initialising}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateSession={handleCreateSession}
          onSelectSession={handleSelectSession}
          onRenameSession={handleOpenRenameDialog}
          onDeleteSession={handleDeleteSession}
        />

        <Divider orientation="vertical" flexItem />

        {/* Main chat area */}
        <Box className="global-chat-content">
          {/* Header */}
          <Box className="global-chat-header">
            <Typography variant="h5">AI Meeting Assistant</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Tooltip title="Filter meetings by folder or tags">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TuneIcon />}
                  onClick={handleOpenFilterDialog}
                  disabled={!activeSessionId}
                  color={hasActiveFilters ? 'primary' : 'inherit'}
                >
                  Filters
                  {hasActiveFilters && (
                    <Chip
                      size="small"
                      label="ON"
                      sx={{ ml: 1, height: 16, fontSize: '0.65rem' }}
                      color="primary"
                    />
                  )}
                </Button>
              </Tooltip>
              <Tooltip title="Number of sources to retrieve for each question">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Top-K Sources</InputLabel>
                  <Select
                    value={topK}
                    label="Top-K Sources"
                    onChange={(e) => setTopK(e.target.value)}
                  >
                    <MenuItem value={3}>3 Sources</MenuItem>
                    <MenuItem value={5}>5 Sources</MenuItem>
                    <MenuItem value={7}>7 Sources</MenuItem>
                    <MenuItem value={10}>10 Sources</MenuItem>
                  </Select>
                </FormControl>
              </Tooltip>
              {loading && <CircularProgress size={24} />}
            </Box>
          </Box>

          {/* Messages */}
          <Box className="global-chat-messages">
            {messages.length === 0 && !loading && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  py: 6,
                }}
              >
                <AssistantIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Ask anything across all your meetings
                </Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
                  Search transcripts, manage tasks, and get insights.
                </Typography>
                <Box sx={{ maxWidth: 500 }}>
                  <QuickActions onSelectPrompt={(prompt) => setInput(prompt)} isGlobal />
                </Box>
              </Box>
            )}
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
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      {renderSources(message.sources, index)}
                      {renderFollowUpSuggestions(
                        message.follow_up_suggestions,
                        index === messages.length - 1 && message.role === 'assistant'
                      )}
                    </>
                  ) : (
                    <Typography>{message.content}</Typography>
                  )}
                </Paper>
              </Box>
            ))}
          </Box>

          {/* Input */}
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

      {/* Session Edit (Rename) Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Chat Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Session Name"
            fullWidth
            variant="outlined"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Autocomplete
            multiple
            freeSolo
            options={availableTags}
            value={newSessionTags}
            onChange={(event, newValue) => setNewSessionTags(newValue)}
            filterOptions={(options, params) => {
              const filtered = options.filter((option) =>
                option.toLowerCase().includes(params.inputValue.toLowerCase())
              );
              if (params.inputValue !== '' && !filtered.includes(params.inputValue)) {
                filtered.push(params.inputValue);
              }
              return filtered;
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  icon={<LabelIcon />}
                  label={option}
                  {...getTagProps({ index })}
                  size="small"
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tags"
                placeholder="Add tags..."
                helperText="Select existing tags or type new ones. Press Enter to add."
                variant="outlined"
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRenameConfirm}
            variant="contained"
            disabled={!newSessionName.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Filter Dialog */}
      <ChatFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        activeSession={activeSession}
        availableFolders={availableFolders}
        availableFilterTags={availableFilterTags}
        tempFilterFolder={tempFilterFolder}
        onFolderChange={setTempFilterFolder}
        tempFilterTags={tempFilterTags}
        onTagsChange={setTempFilterTags}
        onApply={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />
    </Box>
  );
};

export default GlobalChatContainer;
