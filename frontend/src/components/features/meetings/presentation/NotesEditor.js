/**
 * NotesEditor Component
 * Displays and edits meeting notes with inline editing and markdown rendering
 * Supports referencing other meetings with # syntax
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Popper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMeetingSuggestions } from '../hooks/useMeetingSuggestions';

/**
 * NotesEditor Component
 * @param {Object} props
 * @param {string} props.notes - Current notes text
 * @param {boolean} props.isUpdating - Whether update is in progress
 * @param {Function} props.onSave - Callback when notes are saved (newNotes) => Promise<boolean>
 */
export const NotesEditor = ({ notes = '', isUpdating = false, onSave }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes || '');
  const [cursorPosition, setCursorPosition] = useState(0);
  const notesRef = useRef(null);

  const {
    allMeetingsRef,
    suggestions: meetingSuggestions,
    showSuggestions: showMeetingSuggestions,
    query: suggestionQuery,
    update: updateSuggestions,
    clear: clearSuggestions,
  } = useMeetingSuggestions();

  // Update editedNotes when notes prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditedNotes(notes || '');
    }
  }, [notes, isEditing]);

  const handleNotesChange = (e) => {
    const value = e.target.value;
    setEditedNotes(value);
    const selectionStart = e.target.selectionStart;
    setCursorPosition(selectionStart);
    updateSuggestions(value, selectionStart);
  };

  const insertMeetingReference = (meeting) => {
    const textBefore = editedNotes.substring(0, cursorPosition);
    const lastHash = textBefore.lastIndexOf('#');

    if (lastHash !== -1) {
      // Replace the # and text after it with the meeting reference
      const newNotes =
        editedNotes.substring(0, lastHash) +
        `#meeting-${meeting.id} ` +
        editedNotes.substring(cursorPosition);

      setEditedNotes(newNotes);
      clearSuggestions();

      // Move cursor after the inserted reference
      setTimeout(() => {
        if (notesRef.current) {
          const newPosition = lastHash + `#meeting-${meeting.id} `.length;
          notesRef.current.setSelectionRange(newPosition, newPosition);
          notesRef.current.focus();
        }
      }, 0);
    }
  };

  const handleSave = async () => {
    if (onSave) {
      const success = await onSave(editedNotes);
      if (success !== false) {
        setIsEditing(false);
        clearSuggestions();
      }
    }
  };

  const handleCancel = () => {
    setEditedNotes(notes || '');
    setIsEditing(false);
    clearSuggestions();
  };

  const renderTextWithMeetingRefs = (text, keyPrefix) => {
    const parts = [];
    const regex = /#meeting-(\d+)/g;
    let lastIndex = 0;
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`${keyPrefix}-text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      const meetingId = match[1];
      const meeting = allMeetingsRef.current.find((m) => m.id.toString() === meetingId);

      parts.push(
        <Chip
          key={`${keyPrefix}-meeting-${meetingId}-${match.index}`}
          label={meeting ? meeting.filename : `Meeting #${meetingId}`}
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/meetings/${meetingId}`);
          }}
          size="small"
          variant="outlined"
          color="primary"
          sx={{
            mx: 0.5,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'primary.lighter',
              borderColor: 'primary.dark',
            },
          }}
        />
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : [text];
  };

  // Custom component to render meeting references as chips
  const MeetingRefRenderer = ({ children }) => {
    const parsedChildren = React.Children.toArray(children).flatMap((child, index) => {
      if (typeof child === 'string') {
        return renderTextWithMeetingRefs(child, `node-${index}`);
      }
      return [child];
    });

    return <p>{parsedChildren}</p>;
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          Personal Notes
        </Typography>
        {isEditing ? (
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={handleCancel} disabled={isUpdating}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleSave} disabled={isUpdating}>
              Save
            </Button>
          </Stack>
        ) : (
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={() => setIsEditing(true)}
            disabled={isUpdating}
          >
            Edit
          </Button>
        )}
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          minHeight: 300,
          bgcolor: isEditing ? 'action.hover' : 'background.default',
          cursor: 'default',
          transition: 'all 0.2s ease',
          '&:hover': isEditing ? {} : { borderColor: 'primary.light' },
        }}
      >
        {isEditing ? (
          <Box position="relative">
            <TextField
              fullWidth
              multiline
              minRows={12}
              value={editedNotes}
              onChange={handleNotesChange}
              inputRef={notesRef}
              placeholder="Type # to reference other meetings..."
              onClick={(e) => e.stopPropagation()}
              disabled={isUpdating}
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                },
              }}
            />
            <Popper
              open={showMeetingSuggestions && isEditing}
              anchorEl={notesRef.current}
              placement="bottom-start"
              style={{ zIndex: 1300 }}
            >
              <Paper
                elevation={8}
                sx={{
                  width: 350,
                  maxHeight: 250,
                  overflow: 'auto',
                  mt: 1,
                  borderRadius: 1,
                }}
              >
                {meetingSuggestions.length > 0 ? (
                  <List dense sx={{ py: 0 }}>
                    {meetingSuggestions.map((meeting) => (
                      <ListItemButton
                        key={meeting.id}
                        onClick={() => insertMeetingReference(meeting)}
                        sx={{
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" noWrap fontWeight={500}>
                              {meeting.filename}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              ID: {meeting.id}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    ))}
                  </List>
                ) : (
                  <List dense sx={{ py: 0 }}>
                    <ListItem disabled>
                      <ListItemText
                        primary={
                          <Typography variant="body2" color="text.secondary">
                            {suggestionQuery
                              ? 'No meetings found'
                              : 'Start typing to find meetings...'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </List>
                )}
              </Paper>
            </Popper>
          </Box>
        ) : (
          <Box
            sx={{
              '& h1, & h2, & h3, & h4, & h5, & h6': {
                marginTop: '16px',
                marginBottom: '8px',
                fontWeight: 600,
              },
              '& p': {
                marginBottom: '8px',
              },
              '& ul, & ol': {
                marginLeft: '20px',
                marginBottom: '8px',
              },
              '& code': {
                bgcolor: 'action.hover',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: '0.9em',
                fontFamily: 'monospace',
              },
              '& pre': {
                bgcolor: 'action.hover',
                p: 1.5,
                borderRadius: 1,
                overflow: 'auto',
                marginBottom: '8px',
              },
              '& blockquote': {
                borderLeft: '4px solid',
                borderColor: 'primary.main',
                pl: 2,
                ml: 0,
                my: 1,
                color: 'text.secondary',
              },
              '& a': {
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              },
            }}
          >
            {editedNotes ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: MeetingRefRenderer }}>
                {editedNotes}
              </ReactMarkdown>
            ) : (
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontStyle: 'italic',
                }}
              >
                Use the Edit button to add notes...
              </Typography>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default NotesEditor;
