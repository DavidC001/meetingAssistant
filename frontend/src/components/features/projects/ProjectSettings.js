import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { projectService } from '../../../services';

const DEFAULT_SETTINGS = {
  auto_sync_members: true,
  default_action_item_owner: '',
  notification_preferences: {
    milestone_reminders: true,
    daily_summary: false,
  },
  chat_preferences: {
    system_prompt_override: '',
  },
};

const mergeSettings = (incoming) => {
  const settings = incoming || {};
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    notification_preferences: {
      ...DEFAULT_SETTINGS.notification_preferences,
      ...(settings.notification_preferences || {}),
    },
    chat_preferences: {
      ...DEFAULT_SETTINGS.chat_preferences,
      ...(settings.chat_preferences || {}),
    },
  };
};

const ProjectSettings = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const settingsPayload = useMemo(() => ({ ...settings }), [settings]);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      try {
        setLoading(true);
        setError(null);
        const response = await projectService.getProject(projectId);
        const projectData = response.data;
        setProject(projectData);
        setSettings(mergeSettings(projectData?.settings));
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load project settings');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  const handleToggle = (path) => (event) => {
    const value = event.target.checked;
    setSettings((prev) => {
      const updated = { ...prev };
      let target = updated;
      for (let i = 0; i < path.length - 1; i += 1) {
        target[path[i]] = { ...target[path[i]] };
        target = target[path[i]];
      }
      target[path[path.length - 1]] = value;
      return updated;
    });
  };

  const handleChange = (path) => (event) => {
    const value = event.target.value;
    setSettings((prev) => {
      const updated = { ...prev };
      let target = updated;
      for (let i = 0; i < path.length - 1; i += 1) {
        target[path[i]] = { ...target[path[i]] };
        target = target[path[i]];
      }
      target[path[path.length - 1]] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!projectId) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const response = await projectService.updateProject(projectId, { settings: settingsPayload });
      setProject(response.data);
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(mergeSettings(null));
    setSuccess(null);
  };

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

export default ProjectSettings;
