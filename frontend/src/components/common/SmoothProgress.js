import React, { useState, useEffect } from 'react';
import { Box, LinearProgress, CircularProgress, Typography } from '@mui/material';

/**
 * SmoothProgress Component
 *
 * Shows a smooth progress indicator for async actions.
 * Automatically handles minimum display time to avoid flickering.
 */
const SmoothProgress = ({
  visible = false,
  variant = 'linear', // 'linear', 'circular'
  message,
  minDisplayTime = 500, // Minimum ms to show before hiding
}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [showTime, setShowTime] = useState(null);

  useEffect(() => {
    if (visible) {
      setShouldShow(true);
      setShowTime(Date.now());
    } else if (shouldShow && showTime) {
      const elapsed = Date.now() - showTime;
      if (elapsed < minDisplayTime) {
        // Wait for minimum display time
        const timeout = setTimeout(() => {
          setShouldShow(false);
          setShowTime(null);
        }, minDisplayTime - elapsed);
        return () => clearTimeout(timeout);
      } else {
        setShouldShow(false);
        setShowTime(null);
      }
    }
  }, [visible, shouldShow, showTime, minDisplayTime]);

  if (!shouldShow) return null;

  if (variant === 'circular') {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          zIndex: 9999,
          bgcolor: 'background.paper',
          p: 3,
          borderRadius: 2,
          boxShadow: 3,
          animation: 'fadeIn 0.2s ease-out',
          '@keyframes fadeIn': {
            from: { opacity: 0, transform: 'translate(-50%, -50%) scale(0.9)' },
            to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
          },
        }}
      >
        <CircularProgress />
        {message && (
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  // Linear variant
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        animation: 'slideDown 0.2s ease-out',
        '@keyframes slideDown': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
      }}
    >
      <LinearProgress />
      {message && (
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            px: 2,
            py: 0.5,
            textAlign: 'center',
          }}
        >
          <Typography variant="caption">{message}</Typography>
        </Box>
      )}
    </Box>
  );
};

export default SmoothProgress;
