import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import {
  Mic as MicIcon,
  Psychology as PsychologyIcon,
  Storage as StorageIcon,
  CloudQueue as CloudQueueIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const getStatusColor = (status) => {
  switch (status) {
    case 'operational':
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'offline':
    case 'unhealthy':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'operational':
    case 'healthy':
      return <CheckCircleIcon color="success" />;
    case 'degraded':
      return <ErrorIcon color="warning" />;
    case 'offline':
    case 'unhealthy':
      return <ErrorIcon color="error" />;
    default:
      return <CircularProgress size={20} />;
  }
};

const SERVICE_CARDS = [
  { key: 'transcriptionService', label: 'Transcription', Icon: MicIcon },
  { key: 'aiService', label: 'AI Analysis', Icon: PsychologyIcon },
  { key: 'storageService', label: 'Storage', Icon: StorageIcon },
  { key: 'queueStatus', label: 'Queue', Icon: CloudQueueIcon },
];

/**
 * Displays system health status cards for all services.
 */
const SystemStatusCards = ({ systemStatus, onRefresh }) => (
  <Card elevation={2} sx={{ borderRadius: 3 }}>
    <CardContent sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CloudQueueIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
        <Typography variant="h5" fontWeight="600">
          System Health
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          sx={{ ml: 'auto', borderRadius: 2 }}
          size="medium"
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Monitor the status of all system services
      </Typography>

      <Grid container spacing={3}>
        {SERVICE_CARDS.map(({ key, label, Icon }) => (
          <Grid item xs={12} sm={6} md={3} key={key}>
            <Paper
              elevation={2}
              sx={{
                p: 3,
                textAlign: 'center',
                borderRadius: 3,
                border: '2px solid',
                borderColor: `${getStatusColor(systemStatus[key])}.light`,
              }}
            >
              <Icon sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" fontWeight="600" gutterBottom>
                {label}
              </Typography>
              <Box sx={{ mt: 2 }}>{getStatusIcon(systemStatus[key])}</Box>
              <Chip
                label={systemStatus[key]}
                color={getStatusColor(systemStatus[key])}
                size="medium"
                sx={{ mt: 2, fontWeight: 600 }}
              />
            </Paper>
          </Grid>
        ))}
      </Grid>
    </CardContent>
  </Card>
);

export default SystemStatusCards;
