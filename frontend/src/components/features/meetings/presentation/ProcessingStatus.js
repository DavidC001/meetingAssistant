/**
 * ProcessingStatus Component
 * Displays meeting processing status with progress bar and action buttons
 */

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
  Button,
  Alert,
  styled,
} from '@mui/material';
import { Refresh as RefreshIcon, RestartAlt as RestartAltIcon } from '@mui/icons-material';

const ProcessingCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  color: 'white',
  '& .MuiLinearProgress-root': {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: 'white',
    },
  },
}));

/**
 * ProcessingStatus Component
 * @param {Object} props
 * @param {Object} props.meeting - Meeting data
 * @param {boolean} props.isUpdating - Whether an update is in progress
 * @param {Function} props.onRefresh - Callback for manual refresh
 * @param {Function} props.onRestartProcessing - Callback for restarting processing
 */
export const ProcessingStatus = ({ meeting, isUpdating, onRefresh, onRestartProcessing }) => {
  if (!meeting) return null;

  const isProcessing = meeting.status === 'processing' || meeting.status === 'pending';
  const isFailed = meeting.status === 'failed';

  if (!isProcessing && !isFailed) return null;

  return (
    <>
      {/* Failed Status Alert */}
      {isFailed && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={onRestartProcessing}
              disabled={isUpdating}
            >
              Restart Processing
            </Button>
          }
        >
          Processing failed. {meeting.error_message || 'An error occurred during processing.'}
        </Alert>
      )}

      {/* Processing Status Card */}
      {isProcessing && (
        <ProcessingCard elevation={3} sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CircularProgress size={24} sx={{ color: 'white', mr: 2 }} />
              <Typography variant="h6">Processing in Progress...</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                startIcon={<RefreshIcon />}
                onClick={onRefresh}
                sx={{ color: 'white', borderColor: 'white' }}
                variant="outlined"
                size="small"
              >
                Refresh
              </Button>
            </Box>
            <LinearProgress
              variant="determinate"
              value={meeting.overall_progress || 0}
              sx={{ height: 10, borderRadius: 5, mb: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Overall Progress: {meeting.overall_progress || 0}%
            </Typography>
          </CardContent>
        </ProcessingCard>
      )}
    </>
  );
};

export default ProcessingStatus;
