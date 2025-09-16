/**
 * MeetingsList Component
 * 
 * Displays a list of meetings with status indicators, actions, and real-time updates.
 * Features smart polling for processing meetings and optimized re-renders.
 */

import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  List,
  Alert,
  Box
} from '@mui/material';

import { useMeetings } from '../hooks';
import { MEETING_STATUS, SUCCESS_MESSAGES } from '../constants';
import LoadingState from './common/LoadingState';
import ErrorState from './common/ErrorState';
import MeetingListItem from './meetings/MeetingListItem';
import MeetingActionsDialog from './meetings/MeetingActionsDialog';
import ConfirmDialog from './common/ConfirmDialog';
import { useSnackbar } from '../contexts/SnackbarContext';
import api from '../api';

const MeetingsList = ({ refreshKey, onMeetingUpdate }) => {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const { meetings, isLoading, error, refreshMeetings } = useMeetings(refreshKey);

  // Dialog states
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Handlers
  const handleMeetingClick = useCallback((meetingId) => {
    navigate(`/meetings/${meetingId}`);
  }, [navigate]);

  const handleActionsClick = useCallback((meeting, event) => {
    event.stopPropagation();
    setSelectedMeeting(meeting);
    setActionDialogOpen(true);
  }, []);

  const handleRename = useCallback(async (meetingId, newName) => {
    try {
      await api.put(`/api/v1/meetings/${meetingId}`, { filename: newName });
      showSnackbar(SUCCESS_MESSAGES.MEETING_UPDATED, 'success');
      refreshMeetings();
      onMeetingUpdate?.();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to rename meeting';
      showSnackbar(message, 'error');
    }
  }, [refreshMeetings, onMeetingUpdate, showSnackbar]);

  const handleDelete = useCallback(async () => {
    if (!selectedMeeting) return;

    try {
      await api.delete(`/api/v1/meetings/${selectedMeeting.id}`);
      showSnackbar(SUCCESS_MESSAGES.MEETING_DELETED, 'success');
      refreshMeetings();
      onMeetingUpdate?.();
      setDeleteDialogOpen(false);
      setSelectedMeeting(null);
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to delete meeting';
      showSnackbar(message, 'error');
    }
  }, [selectedMeeting, refreshMeetings, onMeetingUpdate, showSnackbar]);

  const handleRestartProcessing = useCallback(async (meetingId) => {
    try {
      await api.post(`/api/v1/meetings/${meetingId}/restart-processing`);
      showSnackbar(SUCCESS_MESSAGES.PROCESSING_RESTARTED, 'success');
      refreshMeetings();
      onMeetingUpdate?.();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to restart processing';
      showSnackbar(message, 'error');
    }
  }, [refreshMeetings, onMeetingUpdate, showSnackbar]);

  const handleTagsAndFolderUpdate = useCallback(async (meetingId, tags, folder) => {
    try {
      await api.put(`/api/v1/meetings/${meetingId}/tags-folder`, { tags, folder });
      showSnackbar(SUCCESS_MESSAGES.MEETING_UPDATED, 'success');
      refreshMeetings();
      onMeetingUpdate?.();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update meeting';
      showSnackbar(message, 'error');
    }
  }, [refreshMeetings, onMeetingUpdate, showSnackbar]);

  // Render states
  if (isLoading) {
    return <LoadingState message="Loading meetings..." />;
  }

  if (error) {
    return (
      <ErrorState 
        message={error} 
        onRetry={refreshMeetings}
        actionLabel="Retry"
      />
    );
  }

  if (meetings.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No meetings found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Upload your first meeting file to get started.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const processingCount = meetings.filter(
    m => m.status === MEETING_STATUS.PROCESSING || m.status === MEETING_STATUS.PENDING
  ).length;

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Meetings ({meetings.length})
            </Typography>
            {processingCount > 0 && (
              <Alert severity="info" variant="outlined">
                {processingCount} meeting{processingCount > 1 ? 's' : ''} processing
              </Alert>
            )}
          </Box>

          <List disablePadding>
            {meetings.map((meeting, index) => (
              <MeetingListItem
                key={meeting.id}
                meeting={meeting}
                isLast={index === meetings.length - 1}
                onMeetingClick={handleMeetingClick}
                onActionsClick={handleActionsClick}
              />
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Actions Dialog */}
      <MeetingActionsDialog
        open={actionDialogOpen}
        meeting={selectedMeeting}
        onClose={() => {
          setActionDialogOpen(false);
          setSelectedMeeting(null);
        }}
        onRename={handleRename}
        onDelete={() => {
          setActionDialogOpen(false);
          setDeleteDialogOpen(true);
        }}
        onRestartProcessing={handleRestartProcessing}
        onTagsAndFolderUpdate={handleTagsAndFolderUpdate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Meeting"
        message={`Are you sure you want to delete "${selectedMeeting?.filename}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSelectedMeeting(null);
        }}
      />
    </>
  );
};

export default MeetingsList;