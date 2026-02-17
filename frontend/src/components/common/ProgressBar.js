/**
 * ProgressBar Component
 *
 * Enhanced progress bar with labels and animation.
 */

import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

const ProgressBar = ({
  value = 0,
  label = null,
  showPercentage = true,
  size = 'medium',
  color = 'primary',
  animated = true,
  variant = 'determinate',
}) => {
  const heights = {
    small: 4,
    medium: 8,
    large: 12,
  };

  const height = heights[size] || heights.medium;
  const displayValue = Math.min(100, Math.max(0, value));

  return (
    <Box width="100%">
      {(label || showPercentage) && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
          {label && (
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          )}
          {showPercentage && variant === 'determinate' && (
            <Typography variant="body2" color="text.secondary">
              {Math.round(displayValue)}%
            </Typography>
          )}
        </Box>
      )}

      <LinearProgress
        variant={variant}
        value={displayValue}
        color={color}
        sx={{
          height,
          borderRadius: height / 2,
          '& .MuiLinearProgress-bar': {
            borderRadius: height / 2,
            transition: animated ? 'transform 0.3s ease' : 'none',
          },
        }}
      />
    </Box>
  );
};

export default ProgressBar;
