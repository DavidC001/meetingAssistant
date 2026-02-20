import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectService } from '../../../../services';

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

const useProjectSettings = () => {
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
      const response = await projectService.updateProject(projectId, {
        settings: settingsPayload,
      });
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

  return {
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
  };
};

export default useProjectSettings;
