import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudDownload as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  UploadFile as UploadFileIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import { projectService } from '../../../services/projectService';
import { downloadBlob } from '../../../services';

const emptyFormState = {
  title: '',
  content: '',
  pinned: false,
};

const ProjectNotes = ({ projectId: projectIdProp, embedded = false }) => {
  const params = useParams();
  const projectId = projectIdProp || params.projectId;
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeNote, setActiveNote] = useState(null);
  const [formState, setFormState] = useState(emptyFormState);
  const [attachmentsByNoteId, setAttachmentsByNoteId] = useState({});
  const [attachmentsLoading, setAttachmentsLoading] = useState({});
  const [uploadingNoteId, setUploadingNoteId] = useState(null);

  const sortedNotes = useMemo(() => {
    if (!Array.isArray(notes)) return [];
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
  }, [notes]);

  useEffect(() => {
    if (!projectId) return;
    const loadNotes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await projectService.getNotes(projectId);
        setNotes(response.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to load notes');
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [projectId]);

  useEffect(() => {
    const loadAllAttachments = async () => {
      if (!notes.length) return;
      const updated = {};
      for (const note of notes) {
        try {
          setAttachmentsLoading((prev) => ({ ...prev, [note.id]: true }));
          const response = await projectService.getNoteAttachments(projectId, note.id);
          updated[note.id] = response.data || [];
        } catch (err) {
          updated[note.id] = [];
        } finally {
          setAttachmentsLoading((prev) => ({ ...prev, [note.id]: false }));
        }
      }
      setAttachmentsByNoteId((prev) => ({ ...prev, ...updated }));
    };

    if (projectId) {
      loadAllAttachments();
    }
  }, [notes, projectId]);

  const openCreateDialog = () => {
    setActiveNote(null);
    setFormState(emptyFormState);
    setEditorOpen(true);
  };

  const openEditDialog = (note) => {
    setActiveNote(note);
    setFormState({
      title: note.title || '',
      content: note.content || '',
      pinned: Boolean(note.pinned),
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formState.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      if (activeNote) {
        const response = await projectService.updateNote(projectId, activeNote.id, formState);
        setNotes((prev) => prev.map((note) => (note.id === activeNote.id ? response.data : note)));
      } else {
        const response = await projectService.createNote(projectId, formState);
        setNotes((prev) => [response.data, ...prev]);
      }
      setEditorOpen(false);
      setActiveNote(null);
      setFormState(emptyFormState);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    const confirmed = window.confirm('Delete this note? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await projectService.deleteNote(projectId, noteId);
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete note');
    }
  };

  const handleTogglePin = async (note) => {
    try {
      const response = await projectService.updateNote(projectId, note.id, {
        pinned: !note.pinned,
      });
      setNotes((prev) => prev.map((item) => (item.id === note.id ? response.data : item)));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to update note');
    }
  };

  const handleUploadAttachment = async (noteId, file) => {
    if (!file) return;
    try {
      setUploadingNoteId(noteId);
      const response = await projectService.uploadNoteAttachment(projectId, noteId, file);
      const created = response.data;
      setAttachmentsByNoteId((prev) => ({
        ...prev,
        [noteId]: [created, ...(prev[noteId] || [])],
      }));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to upload attachment');
    } finally {
      setUploadingNoteId(null);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const response = await projectService.downloadNoteAttachment(attachment.id);
      downloadBlob(response.data, attachment.filename || 'attachment');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to download attachment');
    }
  };

  const handleDeleteAttachment = async (noteId, attachmentId) => {
    const confirmed = window.confirm('Delete this attachment?');
    if (!confirmed) return;
    try {
      await projectService.deleteNoteAttachment(attachmentId);
      setAttachmentsByNoteId((prev) => ({
        ...prev,
        [noteId]: (prev[noteId] || []).filter((item) => item.id !== attachmentId),
      }));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete attachment');
    }
  };

  const containerProps = embedded ? { sx: { width: '100%' } } : { maxWidth: 'xl', sx: { py: 2 } };

  return (
    <Box {...containerProps}>
      {!embedded && (
        <Box
          mb={3}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
        >
          <Box>
            <Typography variant="h4" gutterBottom>
              Project Notes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Capture project documentation, decisions, and context in Markdown.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            New Note
          </Button>
        </Box>
      )}

      {embedded && (
        <Box
          mb={2}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
        >
          <Typography variant="h6">Project Notes</Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreateDialog}>
            New Note
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Alert severity="info">Loading notes…</Alert>
      ) : sortedNotes.length === 0 ? (
        <Alert severity="info">No project notes yet. Create the first one.</Alert>
      ) : (
        <Grid container spacing={3}>
          {sortedNotes.map((note) => (
            <Grid item xs={12} md={6} key={note.id}>
              <Card
                variant="outlined"
                sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <CardHeader
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6">{note.title}</Typography>
                      {note.pinned && <Chip label="Pinned" size="small" color="primary" />}
                    </Stack>
                  }
                  subheader={
                    note.updated_at
                      ? `Updated ${format(new Date(note.updated_at), 'MMM dd, yyyy HH:mm')}`
                      : 'Draft'
                  }
                  action={
                    <Stack direction="row" spacing={1}>
                      <Tooltip title={note.pinned ? 'Unpin note' : 'Pin note'}>
                        <IconButton onClick={() => handleTogglePin(note)} size="small">
                          {note.pinned ? (
                            <PinIcon fontSize="small" />
                          ) : (
                            <PinOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit note">
                        <IconButton onClick={() => openEditDialog(note)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete note">
                        <IconButton
                          onClick={() => handleDelete(note.id)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                />
                <Divider />
                <CardContent sx={{ flexGrow: 1 }}>
                  {note.content ? (
                    <Box
                      sx={{
                        maxHeight: 200,
                        overflow: 'hidden',
                        position: 'relative',
                        '&:after': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 40,
                          background: 'linear-gradient(transparent, rgba(255,255,255,0.9))',
                          pointerEvents: 'none',
                        },
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No content yet. Add details to document project context.
                    </Typography>
                  )}
                  <Box mt={2}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      mb={1}
                    >
                      <Typography variant="subtitle2">Attachments</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<UploadFileIcon />}
                        component="label"
                        disabled={uploadingNoteId === note.id}
                      >
                        {uploadingNoteId === note.id ? 'Uploading…' : 'Upload'}
                        <input
                          type="file"
                          hidden
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            handleUploadAttachment(note.id, file);
                          }}
                        />
                      </Button>
                    </Stack>
                    {attachmentsLoading[note.id] ? (
                      <Typography variant="body2" color="text.secondary">
                        Loading attachments…
                      </Typography>
                    ) : (attachmentsByNoteId[note.id] || []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No attachments yet.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {(attachmentsByNoteId[note.id] || []).map((attachment) => (
                          <Box
                            key={attachment.id}
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                            }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {attachment.filename}
                              </Typography>
                              {attachment.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {attachment.description}
                                </Typography>
                              )}
                            </Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Tooltip title="Preview">
                                <IconButton
                                  size="small"
                                  component="a"
                                  href={projectService.previewNoteAttachment(attachment.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <PreviewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownloadAttachment(attachment)}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteAttachment(note.id, attachment.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{activeNote ? 'Edit Note' : 'New Note'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={formState.title}
              onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
              required
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.pinned}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, pinned: event.target.checked }))
                  }
                />
              }
              label="Pin this note"
            />
            <TextField
              label="Content (Markdown supported)"
              value={formState.content}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, content: event.target.value }))
              }
              multiline
              minRows={8}
              fullWidth
              placeholder="Write project notes here..."
            />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="subtitle2">Attachments</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadFileIcon />}
                  component="label"
                  disabled={!activeNote || uploadingNoteId === activeNote?.id}
                >
                  {uploadingNoteId === activeNote?.id ? 'Uploading…' : 'Upload file'}
                  <input
                    type="file"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (activeNote) {
                        handleUploadAttachment(activeNote.id, file);
                      }
                    }}
                  />
                </Button>
              </Stack>
              {!activeNote ? (
                <Typography variant="caption" color="text.secondary">
                  Save the note first to upload attachments.
                </Typography>
              ) : (attachmentsByNoteId[activeNote.id] || []).length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No attachments yet for this note.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {(attachmentsByNoteId[activeNote.id] || []).map((attachment) => (
                    <Box
                      key={attachment.id}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {attachment.filename}
                        </Typography>
                        {attachment.description && (
                          <Typography variant="caption" color="text.secondary">
                            {attachment.description}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="Preview">
                          <IconButton
                            size="small"
                            component="a"
                            href={projectService.previewNoteAttachment(attachment.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <PreviewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadAttachment(attachment)}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAttachment(activeNote.id, attachment.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Preview
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {formState.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{formState.content}</ReactMarkdown>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Start typing to see a preview.
                  </Typography>
                )}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Note'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectNotes;
