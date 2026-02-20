import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { projectService } from '../../../../services/projectService';
import { downloadBlob } from '../../../../services';

const emptyFormState = {
  title: '',
  content: '',
  pinned: false,
};

const useProjectNotes = ({ projectIdProp } = {}) => {
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

  // ConfirmDialog state — note delete
  const [deleteNoteConfirmOpen, setDeleteNoteConfirmOpen] = useState(false);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState(null);

  // ConfirmDialog state — attachment delete
  const [deleteAttachmentConfirm, setDeleteAttachmentConfirm] = useState({
    open: false,
    noteId: null,
    attachmentId: null,
  });

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

  const handleDeleteRequest = (noteId) => {
    setPendingDeleteNoteId(noteId);
    setDeleteNoteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteNoteId) return;
    setDeleteNoteConfirmOpen(false);
    try {
      await projectService.deleteNote(projectId, pendingDeleteNoteId);
      setNotes((prev) => prev.filter((note) => note.id !== pendingDeleteNoteId));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete note');
    } finally {
      setPendingDeleteNoteId(null);
    }
  };

  const handleDeleteNoteCancel = () => {
    setDeleteNoteConfirmOpen(false);
    setPendingDeleteNoteId(null);
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

  const handleDeleteAttachmentRequest = (noteId, attachmentId) => {
    setDeleteAttachmentConfirm({ open: true, noteId, attachmentId });
  };

  const handleDeleteAttachmentConfirm = async () => {
    const { noteId, attachmentId } = deleteAttachmentConfirm;
    setDeleteAttachmentConfirm({ open: false, noteId: null, attachmentId: null });
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

  const handleDeleteAttachmentCancel = () => {
    setDeleteAttachmentConfirm({ open: false, noteId: null, attachmentId: null });
  };

  return {
    projectId,
    notes,
    loading,
    error,
    setError,
    editorOpen,
    setEditorOpen,
    isSaving,
    activeNote,
    formState,
    setFormState,
    attachmentsByNoteId,
    attachmentsLoading,
    uploadingNoteId,
    sortedNotes,
    deleteNoteConfirmOpen,
    deleteAttachmentConfirm,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteNoteCancel,
    handleTogglePin,
    handleUploadAttachment,
    handleDownloadAttachment,
    handleDeleteAttachmentRequest,
    handleDeleteAttachmentConfirm,
    handleDeleteAttachmentCancel,
  };
};

export default useProjectNotes;
