/**
 * DiaryReminder Component
 *
 * Modal dialog that appears when user hasn't filled in their diary
 * for the previous work day. Shows action items summary and provides
 * options to fill in diary, remind later, or skip.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as InProgressIcon,
  AddCircle as NewIcon,
  EventNote as DiaryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import diaryService from '../../../services/diaryService';

import logger from '../../../utils/logger';
const DiaryReminder = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reminderData, setReminderData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkReminder();
  }, []);

  const checkReminder = async () => {
    try {
      setLoading(true);
      const response = await diaryService.checkReminder();

      if (response.should_show_reminder) {
        setReminderData(response);
        setOpen(true);
      }
    } catch (err) {
      logger.error('Error checking diary reminder:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillNow = () => {
    setOpen(false);
    navigate(`/diary?date=${reminderData.missing_date}`);
  };

  const handleRemindLater = () => {
    setOpen(false);
    // Don't dismiss - will show again on next app load
  };

  const handleSkipDay = async () => {
    try {
      await diaryService.dismissReminder(reminderData.missing_date);
      setOpen(false);
    } catch (err) {
      logger.error('Error dismissing reminder:', err);
      setError(err.message);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading || !reminderData) {
    return null;
  }

  const summary = reminderData.action_items_summary;

  return (
    <Dialog
      open={open}
      onClose={handleRemindLater}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 3,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <DiaryIcon color="primary" />
          <Typography variant="h6" component="div">
            Daily Diary Reminder
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" gutterBottom>
          You haven't filled in your diary for{' '}
          <strong>{formatDate(reminderData.missing_date)}</strong>
        </Typography>

        {summary && (
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Quick Summary for that day:
            </Typography>

            {summary.completed_items && summary.completed_items.length > 0 && (
              <Box mb={2}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="subtitle2" color="success.main">
                    Completed ({summary.completed_items.length})
                  </Typography>
                </Box>
                <List dense>
                  {summary.completed_items.slice(0, 5).map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText
                        primary={item.task}
                        secondary={item.owner ? `Owner: ${item.owner}` : null}
                      />
                    </ListItem>
                  ))}
                  {summary.completed_items.length > 5 && (
                    <ListItem>
                      <ListItemText
                        secondary={`... and ${summary.completed_items.length - 5} more`}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}

            {summary.in_progress_items && summary.in_progress_items.length > 0 && (
              <Box mb={2}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <InProgressIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" color="primary">
                    In Progress ({summary.in_progress_items.length})
                  </Typography>
                </Box>
                <List dense>
                  {summary.in_progress_items.slice(0, 3).map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText
                        primary={item.task}
                        secondary={item.owner ? `Owner: ${item.owner}` : null}
                      />
                    </ListItem>
                  ))}
                  {summary.in_progress_items.length > 3 && (
                    <ListItem>
                      <ListItemText
                        secondary={`... and ${summary.in_progress_items.length - 3} more`}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}

            {summary.created_items && summary.created_items.length > 0 && (
              <Box mb={2}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <NewIcon color="info" fontSize="small" />
                  <Typography variant="subtitle2" color="info.main">
                    New Items Created ({summary.created_items.length})
                  </Typography>
                </Box>
                <List dense>
                  {summary.created_items.slice(0, 3).map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText
                        primary={item.task}
                        secondary={item.owner ? `Owner: ${item.owner}` : null}
                      />
                    </ListItem>
                  ))}
                  {summary.created_items.length > 3 && (
                    <ListItem>
                      <ListItemText
                        secondary={`... and ${summary.created_items.length - 3} more`}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}

            {(!summary.completed_items || summary.completed_items.length === 0) &&
              (!summary.in_progress_items || summary.in_progress_items.length === 0) &&
              (!summary.created_items || summary.created_items.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No action items activity recorded for this day.
                </Typography>
              )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary">
          Would you like to fill in your diary now?
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleSkipDay} color="inherit">
          Skip This Day
        </Button>
        <Button onClick={handleRemindLater} color="primary">
          Remind Me Later
        </Button>
        <Button
          onClick={handleFillNow}
          variant="contained"
          color="primary"
          startIcon={<DiaryIcon />}
        >
          Fill In Now
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DiaryReminder;
