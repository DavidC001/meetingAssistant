/**
 * ErrorState Component
 *
 * Reusable error state component with retry functionality.
 */

import React from 'react';
import { Box, Card, CardContent, Typography, Button, Alert } from '@mui/material';
import { Refresh as RefreshIcon, Error as ErrorIcon } from '@mui/icons-material';

const ErrorState = ({
  message = 'An error occurred',
  onRetry,
  actionLabel = 'Try Again',
  severity = 'error',
  showIcon = true,
}) => {
  return (
    <Card>
      <CardContent>
        <Box textAlign="center" py={4}>
          {showIcon && <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2, opacity: 0.6 }} />}

          <Alert severity={severity} sx={{ mb: 2 }}>
            <Typography variant="body1">{message}</Typography>
          </Alert>

          {onRetry && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={onRetry}
              sx={{ mt: 2 }}
            >
              {actionLabel}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ErrorState;
