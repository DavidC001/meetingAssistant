import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Mic as MicIcon,
  Psychology as PsychologyIcon,
  Language as LanguageIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import SystemStatusCards from './SystemStatusCards';

const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
];

/**
 * Content for the General Settings tab (tab index 0).
 * Includes system health cards, processing settings and storage/system settings.
 */
const GeneralSettingsTab = ({
  systemStatus,
  onRefreshStatus,
  settings,
  onSettingChange,
  isSaving,
  onSave,
}) => (
  <Box sx={{ p: 4 }}>
    <Grid container spacing={4}>
      {/* System Status */}
      <Grid item xs={12}>
        <SystemStatusCards systemStatus={systemStatus} onRefresh={onRefreshStatus} />
      </Grid>

      {/* Processing Settings */}
      <Grid item xs={12} md={6}>
        <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <MicIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="600" gutterBottom>
                  Processing
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Audio transcription and analysis settings
                </Typography>
              </Box>
            </Box>

            <List sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
              <ListItem>
                <ListItemIcon>
                  <LanguageIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Transcription Language"
                  secondary="Default language for speech recognition"
                />
                <ListItemSecondaryAction>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={settings.transcriptionLanguage}
                      onChange={(e) => onSettingChange('transcriptionLanguage', e.target.value)}
                    >
                      {LANGUAGES.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </ListItemSecondaryAction>
              </ListItem>

              <Divider sx={{ my: 1 }} />

              <ListItem>
                <ListItemIcon>
                  <MicIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Speaker Diarization"
                  secondary="Identify different speakers"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.enableSpeakerDiarization}
                    onChange={(e) => onSettingChange('enableSpeakerDiarization', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <Divider sx={{ my: 1 }} />

              <ListItem>
                <ListItemIcon>
                  <PsychologyIcon />
                </ListItemIcon>
                <ListItemText
                  primary="AI Analysis"
                  secondary="Generate summaries and action items"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.aiAnalysisEnabled}
                    onChange={(e) => onSettingChange('aiAnalysisEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Storage & System Settings */}
      <Grid item xs={12} md={6}>
        <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <SecurityIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="600" gutterBottom>
                  Storage & System
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage storage and preferences
                </Typography>
              </Box>
            </Box>

            <List sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
              <ListItem>
                <ListItemIcon>
                  <NotificationsIcon />
                </ListItemIcon>
                <ListItemText primary="Notifications" secondary="Email when processing completes" />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.notificationsEnabled}
                    onChange={(e) => onSettingChange('notificationsEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <Divider sx={{ my: 1 }} />

              <ListItem>
                <ListItemText
                  primary="Auto-delete recordings"
                  secondary="Delete recordings after specified days"
                />
              </ListItem>
              <ListItem>
                <TextField
                  type="number"
                  label="Days"
                  value={settings.autoDeleteAfterDays}
                  onChange={(e) => onSettingChange('autoDeleteAfterDays', parseInt(e.target.value))}
                  size="small"
                  sx={{ width: 100 }}
                  inputProps={{ min: 1, max: 365 }}
                />
              </ListItem>

              <Divider sx={{ my: 1 }} />

              <ListItem>
                <ListItemText
                  primary="Maximum file size"
                  secondary={`Max upload size: ${settings.maxFileSize}MB (${(
                    settings.maxFileSize / 1000
                  ).toFixed(1)}GB)`}
                />
              </ListItem>
              <ListItem>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TextField
                    type="number"
                    label="MB"
                    value={settings.maxFileSize}
                    onChange={(e) => onSettingChange('maxFileSize', parseInt(e.target.value))}
                    size="small"
                    sx={{ width: 120 }}
                    inputProps={{ min: 100, max: 5000 }}
                    helperText="100MB - 5GB"
                  />
                  <Typography variant="body2" color="text.secondary">
                    = {(settings.maxFileSize / 1000).toFixed(1)} GB
                  </Typography>
                </Box>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Save Button */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={onSave}
            disabled={isSaving}
            sx={{ borderRadius: 2, px: 4, py: 1.5, fontSize: '1.1rem' }}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Grid>
    </Grid>
  </Box>
);

export default GeneralSettingsTab;
