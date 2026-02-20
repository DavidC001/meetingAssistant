import React, { useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Memory as MemoryIcon,
  Tune as TuneIcon,
  Key as KeyIcon,
  Storage as StorageIcon,
  CloudQueue as CloudQueueIcon,
  Backup as BackupIcon,
} from '@mui/icons-material';
import useAppSettings from '../hooks/useAppSettings';
import useEmbeddingConfig from '../hooks/useEmbeddingConfig';
import useWorkerConfig from '../hooks/useWorkerConfig';
import GeneralSettingsTab from '../presentation/GeneralSettingsTab';
import EmbeddingTab from '../presentation/EmbeddingTab';
import ModelConfigurations from '../ModelConfigurations';
import APIKeyManagement from '../APIKeyManagement';
import OllamaManager from '../OllamaManager';
import GoogleDriveSync from '../GoogleDriveSync';
import DataBackup from '../DataBackup';

const TabPanel = ({ children, value, index }) => (
  <div hidden={value !== index}>{value === index && <Box sx={{ p: 0 }}>{children}</Box>}</div>
);

const SettingsContainer = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [systemStatus, setSystemStatus] = useState({
    transcriptionService: 'operational',
    aiService: 'operational',
    storageService: 'operational',
    queueStatus: 'healthy',
  });

  const {
    settings,
    isLoading,
    isSaving,
    snackbar,
    handleSettingChange,
    handleSaveSettings,
    showSnackbar,
    closeSnackbar,
  } = useAppSettings();

  const {
    embeddingConfigs,
    activeEmbeddingId,
    embeddingForm,
    modelValidation,
    embeddingLoading,
    handleEmbeddingFormChange,
    handleCreateEmbeddingConfig,
    handleValidateModel,
    handleActivateEmbeddingConfig,
    handleDeleteEmbeddingConfig,
    handleRecomputeEmbeddings,
  } = useEmbeddingConfig(showSnackbar);

  const { workerConfig, setWorkerConfig, workerSaving, handleWorkerSave } =
    useWorkerConfig(showSnackbar);

  const fetchSystemStatus = () => {
    setSystemStatus({
      transcriptionService: 'operational',
      aiService: 'operational',
      storageService: 'operational',
      queueStatus: 'healthy',
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" fontWeight={700} gutterBottom>
          ⚙️ Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your Meeting Assistant preferences and integrations
        </Typography>
      </Box>

      <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 2, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            onChange={(e, newValue) => setCurrentTab(newValue)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': { py: 2, fontSize: '1rem', fontWeight: 600 },
            }}
          >
            <Tab label="General" icon={<SettingsIcon />} iconPosition="start" />
            <Tab label="RAG & Embeddings" icon={<MemoryIcon />} iconPosition="start" />
            <Tab label="AI Models" icon={<TuneIcon />} iconPosition="start" />
            <Tab label="API Keys" icon={<KeyIcon />} iconPosition="start" />
            <Tab label="Ollama" icon={<StorageIcon />} iconPosition="start" />
            <Tab label="Google Drive" icon={<CloudQueueIcon />} iconPosition="start" />
            <Tab label="Backup" icon={<BackupIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          <GeneralSettingsTab
            systemStatus={systemStatus}
            onRefreshStatus={fetchSystemStatus}
            settings={settings}
            onSettingChange={handleSettingChange}
            isSaving={isSaving}
            onSave={handleSaveSettings}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <EmbeddingTab
            embeddingConfigs={embeddingConfigs}
            activeEmbeddingId={activeEmbeddingId}
            embeddingForm={embeddingForm}
            modelValidation={modelValidation}
            embeddingLoading={embeddingLoading}
            onEmbeddingFormChange={handleEmbeddingFormChange}
            onCreateEmbeddingConfig={handleCreateEmbeddingConfig}
            onValidateModel={handleValidateModel}
            onActivateConfig={handleActivateEmbeddingConfig}
            onDeleteConfig={handleDeleteEmbeddingConfig}
            onRecomputeEmbeddings={handleRecomputeEmbeddings}
            workerConfig={workerConfig}
            setWorkerConfig={setWorkerConfig}
            workerSaving={workerSaving}
            onWorkerSave={handleWorkerSave}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <ModelConfigurations />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <APIKeyManagement />
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          <OllamaManager />
        </TabPanel>

        <TabPanel value={currentTab} index={5}>
          <GoogleDriveSync />
        </TabPanel>

        <TabPanel value={currentTab} index={6}>
          <DataBackup />
        </TabPanel>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={closeSnackbar}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SettingsContainer;
