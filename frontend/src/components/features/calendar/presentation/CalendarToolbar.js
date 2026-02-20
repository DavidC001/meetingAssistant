import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
} from '@mui/material';
import { Sync as SyncIcon, Google as GoogleIcon } from '@mui/icons-material';

/**
 * Calendar page header: Google Calendar connection status, user filter controls, and legend.
 */
export function CalendarToolbar({
  googleConnected,
  googleEmail,
  onGoogleConnect,
  onGoogleDisconnect,
  onOpenSyncDialog,
  filterUserName,
  onFilterNameChange,
  showOnlyMyTasks,
  onToggleShowOnlyMine,
  syncOnlyMyTasks,
  onToggleSyncOnlyMine,
}) {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* Title + Google Calendar controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Action Items Calendar
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {googleConnected ? (
            <>
              <Chip
                icon={<GoogleIcon />}
                label={`Connected: ${googleEmail}`}
                color="success"
                onDelete={onGoogleDisconnect}
              />
              <Button variant="contained" startIcon={<SyncIcon />} onClick={onOpenSyncDialog}>
                Sync All
              </Button>
            </>
          ) : (
            <Button variant="contained" startIcon={<GoogleIcon />} onClick={onGoogleConnect}>
              Connect Google Calendar
            </Button>
          )}
        </Box>
      </Box>

      {/* User filter & sync settings */}
      <Card sx={{ mb: 2, bgcolor: 'action.hover' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            User Filter &amp; Sync Settings
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={7}>
              <TextField
                fullWidth
                size="small"
                label="My Name"
                placeholder="Enter your full name as it appears in meetings"
                value={filterUserName}
                onChange={(e) => onFilterNameChange(e.target.value)}
                helperText="Tasks assigned to this name will be filtered and synced"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showOnlyMyTasks}
                    onChange={(e) => onToggleShowOnlyMine(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show only my tasks"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={syncOnlyMyTasks}
                    onChange={(e) => onToggleSyncOnlyMine(e.target.checked)}
                    color="primary"
                  />
                }
                label="Sync only my tasks"
              />
            </Grid>
          </Grid>
          {showOnlyMyTasks && !filterUserName && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Enter your name to filter tasks
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Priority / status legend */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Chip label="High Priority" size="small" sx={{ bgcolor: 'error.main', color: 'white' }} />
        <Chip
          label="Medium Priority"
          size="small"
          sx={{ bgcolor: 'warning.main', color: 'white' }}
        />
        <Chip label="Low Priority" size="small" sx={{ bgcolor: 'success.main', color: 'white' }} />
        <Chip label="Completed" size="small" sx={{ bgcolor: 'grey.600', color: 'white' }} />
        <Chip
          label="Synced to Google"
          size="small"
          sx={{ border: '2px solid', borderColor: 'success.main' }}
          variant="outlined"
        />
        {filterUserName && (
          <Chip
            label="My Task (highlighted)"
            size="small"
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              fontWeight: 600,
              boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)',
            }}
          />
        )}
      </Box>
    </Paper>
  );
}
