/**
 * MeetingDetailsContainer
 * Main container component that manages meeting details with hooks and presentational components
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Container,
  Typography,
  Snackbar,
} from '@mui/material';
import AudioPlayer from '../presentation/AudioPlayer';
import FloatingChat from '../containers/FloatingChatContainer';
import { useMeetingDetail, useSpeakers } from '../hooks';
import MeetingActionItemsContainer from './MeetingActionItemsContainer';
import {
  ProcessingStatus,
  MeetingOverview,
  NotesEditor,
  AttachmentsGrid,
  TranscriptViewer,
  SpeakersPanel,
  MeetingMetadata,
} from '../presentation';
import { FormDialog, ConfirmDialog } from '../../../common';
import { EmbeddingConfigService } from '../../../../services/settingsService';
import { Sync as SyncIcon } from '@mui/icons-material';

// TabPanel component
// IMPORTANT: children must always be rendered (not conditional) so that
// stateful containers (e.g. KanbanBoard) stay mounted when the user switches
// tabs and their local optimistic state is preserved.
const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`meeting-tabpanel-${index}`}
      aria-labelledby={`meeting-tab-${index}`}
      {...other}
    >
      <Box sx={{ py: 3 }}>{children}</Box>
    </div>
  );
};

/**
 * MeetingDetailsContainer Component
 * Manages all meeting details data and delegates rendering to presentational components
 */
export const MeetingDetailsContainer = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  // Hooks for data management
  const meetingDetail = useMeetingDetail(meetingId);
  const speakers = useSpeakers(meetingId);

  // Local UI state
  const [activeTab, setActiveTab] = useState(0);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [reembedConfirmOpen, setReembedConfirmOpen] = useState(false);
  const [isReembedding, setIsReembedding] = useState(false);
  // Keep a ref to the latest fetchMeetingDetails so handleActionItemsChanged
  // can be a stable (empty-dep) callback. This prevents KanbanBoardContainer
  // from receiving a new onActionItemsChanged prop on every render, which was
  // causing stale-closure issues in useActionItems callbacks.
  const fetchMeetingDetailsRef = useRef(meetingDetail.fetchMeetingDetails);
  fetchMeetingDetailsRef.current = meetingDetail.fetchMeetingDetails;
  const handleActionItemsChanged = useCallback(() => {
    fetchMeetingDetailsRef.current?.();
  }, []); // stable — never re-created

  // Always track the latest action_items from the meeting cache so that
  // on a fresh mount (tab switch back) the kanban is seeded with fresh data.
  const actionItems = useMemo(
    () => meetingDetail.meeting?.transcription?.action_items ?? [],
    [meetingDetail.meeting?.transcription?.action_items]
  );

  // Derive all speaker names for autocomplete
  const allSpeakerNames = useMemo(
    () => [
      ...new Set(
        speakers.allSpeakers
          .map((s) => (typeof s === 'string' ? s : s.name || s.speaker_name))
          .filter(Boolean)
      ),
    ],
    [speakers.allSpeakers]
  );

  // Parse full_text into segments and keep them in state so they can be
  // updated optimistically after a speaker rename without a full refetch.
  const parseSegments = useCallback((fullText) => {
    if (!fullText) return [];
    return fullText
      .split('\n')
      .filter((line) => line.trim())
      .map((line, idx) => {
        const speakerMatch = line.match(/^([^:]{1,50}):\s*(.*)/);
        if (speakerMatch) {
          return { id: idx, speaker: speakerMatch[1].trim(), text: speakerMatch[2] };
        }
        return { id: idx, speaker: null, text: line };
      });
  }, []);

  const [segments, setSegments] = useState(() =>
    parseSegments(meetingDetail.meeting?.transcription?.full_text)
  );

  // Keep segments in sync whenever the meeting data refreshes
  useEffect(() => {
    setSegments(parseSegments(meetingDetail.meeting?.transcription?.full_text));
  }, [meetingDetail.meeting?.transcription?.full_text, parseSegments]);

  // Handle speaker rename from TranscriptViewer chips
  const handleSpeakerRenamed = useCallback(
    async (oldName, newName) => {
      // Optimistically update the transcript segments
      setSegments((prev) =>
        prev.map((seg) => (seg.speaker === oldName ? { ...seg, speaker: newName } : seg))
      );

      // Persist the rename via existing speakers hook
      const speakerObj = speakers.speakers.find((s) => (s.name || s.speaker_name) === oldName);
      if (speakerObj) {
        await speakers.updateSpeaker({ ...speakerObj, name: newName });
        // Refresh meeting cache so action item owners reflect the new name
        meetingDetail.fetchMeetingDetails();
      }

      // Trigger re-embedding in the background
      try {
        await EmbeddingConfigService.recomputeMeeting(meetingId);
        setSnackbarMessage('Speaker renamed. Search index is being updated.');
      } catch (e) {
        // non-critical: silently ignore recompute errors
      }
    },
    [speakers, meetingId, meetingDetail]
  );

  // Re-embed handler (called from confirm dialog and inline rename)
  const handleReembed = useCallback(async () => {
    setIsReembedding(true);
    try {
      await EmbeddingConfigService.recomputeMeeting(meetingId);
      setSnackbarMessage('Search index is being updated.');
    } catch (e) {
      setSnackbarMessage('Failed to trigger re-embedding.');
    } finally {
      setIsReembedding(false);
      setReembedConfirmOpen(false);
    }
  }, [meetingId]);

  // Wrap updateSpeaker so that a rename from the Speakers tab also patches
  // the transcript segments in memory (same as inline rename from TranscriptViewer).
  const handleSpeakerUpdateFromPanel = useCallback(
    async (speaker) => {
      const oldSpeakerObj = speakers.speakers.find((s) => s.id === speaker.id);
      const oldName = oldSpeakerObj?.name || oldSpeakerObj?.speaker_name;
      const newName = speaker.name;
      const success = await speakers.updateSpeaker(speaker);
      if (success && oldName && newName && oldName !== newName) {
        setSegments((prev) =>
          prev.map((seg) => (seg.speaker === oldName ? { ...seg, speaker: newName } : seg))
        );
        // Refresh meeting cache so action item owners reflect the new name
        meetingDetail.fetchMeetingDetails();
      }
      return success;
    },
    [speakers, meetingDetail]
  );

  if (meetingDetail.isLoading) {
    return (
      <Container
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
      </Container>
    );
  }

  if (!meetingDetail.meeting) {
    return (
      <Container>
        <Alert severity="error">Meeting not found.</Alert>
      </Container>
    );
  }

  const { meeting, isUpdating, error } = meetingDetail;

  // Handlers
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    const success = await meetingDetail.rename(newName.trim());
    if (success) {
      setRenameDialogOpen(false);
      setNewName('');
    }
  };

  const handleDelete = async () => {
    const success = await meetingDetail.deleteMeeting();
    if (success) {
      setDeleteDialogOpen(false);
      navigate('/');
    }
  };

  const handleDownloadMeeting = (format) => meetingDetail.download(format);

  const handleUpdateNotes = async (newNotes) => {
    return await meetingDetail.updateNotes(newNotes);
  };

  const handleUpdateMetadata = async (newTags, newFolder) => {
    return await meetingDetail.updateTagsFolder(newTags, newFolder);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => {}} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Processing Status */}
      <ProcessingStatus
        meeting={meeting}
        isUpdating={isUpdating}
        onRefresh={meetingDetail.refresh}
        onRestartProcessing={meetingDetail.restartProcessing}
      />

      {/* Meeting Overview */}
      <MeetingOverview
        meeting={meeting}
        isUpdating={isUpdating}
        onRename={() => {
          setNewName(meeting.filename);
          setRenameDialogOpen(true);
        }}
        onDelete={() => setDeleteDialogOpen(true)}
        onDownload={handleDownloadMeeting}
      />

      {/* Re-embed Search Index — shown for completed meetings with a transcription */}
      {meeting.status === 'completed' && meeting.transcription && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SyncIcon />}
            disabled={isReembedding}
            onClick={() => setReembedConfirmOpen(true)}
          >
            {isReembedding ? 'Re-indexing…' : 'Re-embed Search Index'}
          </Button>
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="meeting details tabs">
          <Tab label="Overview" id="meeting-tab-0" aria-controls="meeting-tabpanel-0" />
          <Tab label="Transcript" id="meeting-tab-1" aria-controls="meeting-tabpanel-1" />
          <Tab
            label="Action Items"
            id="meeting-tab-2"
            aria-controls="meeting-tabpanel-2"
            disabled={!meeting.transcription?.id}
          />
          <Tab label="Speakers" id="meeting-tab-3" aria-controls="meeting-tabpanel-3" />
          <Tab label="Attachments" id="meeting-tab-4" aria-controls="meeting-tabpanel-4" />
        </Tabs>
      </Box>

      {/* Tab Panels */}

      {/* Overview Tab */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
          {/* Left Column */}
          <Box>
            {meeting.audio_filepath && (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    Audio Recording
                  </Typography>
                  <AudioPlayer
                    src={`/api/v1/meetings/${meeting.id}/audio`}
                    title={meeting.filename}
                  />
                </CardContent>
              </Card>
            )}

            {meeting.status === 'completed' && !meeting.audio_filepath && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Audio playback is being generated for this meeting. Please refresh in a few moments.
                <Button size="small" onClick={meetingDetail.refresh} sx={{ ml: 2 }}>
                  Refresh Now
                </Button>
              </Alert>
            )}

            {meeting.transcription?.summary && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <h3>Executive Summary</h3>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                  {meeting.transcription.summary}
                </p>
              </Box>
            )}
            <NotesEditor
              notes={meetingDetail.notes}
              isUpdating={isUpdating}
              onSave={handleUpdateNotes}
            />
          </Box>

          {/* Right Column */}
          <Box>
            <MeetingMetadata
              tags={meetingDetail.tags}
              folder={meetingDetail.folder}
              availableTags={meetingDetail.availableTags}
              availableFolders={meetingDetail.availableFolders}
              onSave={handleUpdateMetadata}
              isUpdating={isUpdating}
            />
          </Box>
        </Box>
      </TabPanel>

      {/* Transcript Tab */}
      <TabPanel value={activeTab} index={1}>
        <TranscriptViewer
          segments={segments}
          isLoading={meetingDetail.isLoading}
          speakers={speakers.speakers}
          allSpeakerNames={allSpeakerNames}
          onSpeakerRenamed={handleSpeakerRenamed}
        />
      </TabPanel>

      {/* Action Items Tab */}
      <TabPanel value={activeTab} index={2}>
        <MeetingActionItemsContainer
          transcriptionId={meeting.transcription?.id}
          initialItems={actionItems}
          onActionItemsChanged={handleActionItemsChanged}
        />
      </TabPanel>

      {/* Speakers Tab */}
      <TabPanel value={activeTab} index={3}>
        <SpeakersPanel
          speakers={speakers.speakers}
          allSpeakers={speakers.allSpeakers}
          onUpdate={handleSpeakerUpdateFromPanel}
          onDelete={speakers.deleteSpeaker}
          onAdd={speakers.addSpeaker}
        />
      </TabPanel>

      {/* Attachments Tab */}
      <TabPanel value={activeTab} index={4}>
        <AttachmentsGrid
          attachments={meetingDetail.attachments}
          isLoading={meetingDetail.isLoading}
          onDownload={meetingDetail.downloadAttachment}
          onDelete={meetingDetail.deleteAttachment}
          onUpload={meetingDetail.uploadAttachment}
        />
      </TabPanel>

      {/* Rename Dialog */}
      <FormDialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        onSubmit={handleRename}
        title="Rename Meeting"
        submitLabel="Rename"
        isLoading={isUpdating}
        isSubmitDisabled={!newName.trim() || isUpdating}
      >
        <TextField
          autoFocus
          fullWidth
          label="New name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
          }}
          sx={{ mt: 1 }}
        />
      </FormDialog>

      {/* Re-embed Confirm Dialog */}
      <ConfirmDialog
        open={reembedConfirmOpen}
        title="Re-embed Search Index"
        message="This will recompute the vector embeddings for this meeting so the search index reflects the latest transcript and speaker names. It runs in the background and may take a moment."
        confirmLabel="Re-embed"
        onConfirm={handleReembed}
        onCancel={() => setReembedConfirmOpen(false)}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Meeting"
        message="Are you sure you want to delete this meeting? This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />

      {/* Floating Chat */}
      {meeting && meeting.transcription && (
        <FloatingChat
          meetingId={meetingId}
          meetingTitle={meeting.filename || meeting.title || 'Meeting'}
        />
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default MeetingDetailsContainer;
