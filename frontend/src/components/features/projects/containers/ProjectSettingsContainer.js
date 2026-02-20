import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import useProjectSettings from '../hooks/useProjectSettings';

const ProjectSettingsContainer = () => {
  const {
    projectId,
    project,
    settings,
    loading,
    saving,
    error,
    success,
    handleToggle,
    handleChange,
    handleSave,
    handleReset,
    navigate,
  } = useProjectSettings();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/projects/${projectId}`)}>
          Back to Project
        </Button>
        <Box>
          <Typography variant="h4">{project?.name} - Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure project preferences and defaults
          </Typography>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Team & Action Items
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(settings.auto_sync_members)}
                  onChange={handleToggle(['auto_sync_members'])}
                />
              }
              label="Auto-sync members from meeting speakers"
            />
            <TextField
              fullWidth
              margin="normal"
              label="Default action item owner"
              value={settings.default_action_item_owner || ''}
              onChange={handleChange(['default_action_item_owner'])}
              placeholder="Leave empty to assign manually"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notifications
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Daily summary sends a brief recap of project activity each day. Milestone reminders
              notify you when due dates are approaching or missed.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(settings.notification_preferences.milestone_reminders)}
                  onChange={handleToggle(['notification_preferences', 'milestone_reminders'])}
                />
              }
              label="Milestone reminders"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(settings.notification_preferences.daily_summary)}
                  onChange={handleToggle(['notification_preferences', 'daily_summary'])}
                />
              }
              label="Daily summary"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Chat Preferences
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              label="System prompt override"
              value={settings.chat_preferences.system_prompt_override || ''}
              onChange={handleChange(['chat_preferences', 'system_prompt_override'])}
              placeholder="Optional: customize the project chat system prompt"
              multiline
              minRows={3}
            />
          </CardContent>
        </Card>

        <Divider />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={handleReset} disabled={saving}>
            Reset to defaults
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default ProjectSettingsContainer;
