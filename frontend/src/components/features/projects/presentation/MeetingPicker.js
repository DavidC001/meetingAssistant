import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import { VideoCall as VideoCallIcon } from '@mui/icons-material';
import { MeetingService } from '../../../../services';
import { format } from 'date-fns';

const MeetingPicker = ({ selectedMeetings, onSelectionChange, maxHeight = '400px' }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await MeetingService.getAll({ skip: 0, limit: 100 });
      const completedMeetings = response.filter((m) => m.status === 'completed');
      setMeetings(completedMeetings);
    } catch (err) {
      setError('Failed to load meetings: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const filteredMeetings = meetings.filter((meeting) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (meeting.filename && meeting.filename.toLowerCase().includes(searchLower)) ||
      (meeting.folder && meeting.folder.toLowerCase().includes(searchLower))
    );
  });

  const toggleMeeting = (meetingId) => {
    if (selectedMeetings.includes(meetingId)) {
      onSelectionChange(selectedMeetings.filter((id) => id !== meetingId));
    } else {
      onSelectionChange([...selectedMeetings, meetingId]);
    }
  };

  const formatMeetingDate = (date) => {
    if (!date) return 'No date';
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={maxHeight}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        label="Search meetings"
        placeholder="By filename or folder..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {selectedMeetings.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {selectedMeetings.map((id) => {
            const meeting = meetings.find((m) => m.id === id);
            return meeting ? (
              <Chip
                key={id}
                label={meeting.filename}
                onDelete={() => toggleMeeting(id)}
                size="small"
              />
            ) : null;
          })}
        </Stack>
      )}

      <Paper variant="outlined" sx={{ maxHeight, overflow: 'auto' }}>
        {filteredMeetings.length === 0 ? (
          <Box p={2}>
            <Typography variant="body2" color="text.secondary" align="center">
              {meetings.length === 0 ? 'No meetings available' : 'No meetings match your search'}
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredMeetings.map((meeting) => (
              <ListItem key={meeting.id} disablePadding>
                <ListItemButton dense onClick={() => toggleMeeting(meeting.id)} sx={{ py: 0.5 }}>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedMeetings.includes(meeting.id)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <VideoCallIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={meeting.filename}
                    secondary={
                      <>
                        {meeting.folder && <span>{meeting.folder}</span>}
                        {meeting.meeting_date && (
                          <span> · {formatMeetingDate(meeting.meeting_date)}</span>
                        )}
                      </>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
};

export default MeetingPicker;
