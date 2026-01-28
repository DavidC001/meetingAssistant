/**
 * LoadingState Component
 *
 * Reusable loading state component with skeleton loaders.
 */

import React from 'react';
import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';

const LoadingState = ({ message = 'Loading...', showSkeleton = true, itemCount = 3 }) => {
  if (!showSkeleton) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <Typography variant="h6" color="textSecondary">
              {message}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <Skeleton width="40%" />
        </Typography>

        {Array.from({ length: itemCount }).map((_, index) => (
          <Box key={index} mb={2}>
            <Box display="flex" alignItems="center" mb={1}>
              <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
              <Box flexGrow={1}>
                <Skeleton width="60%" height={24} />
                <Skeleton width="40%" height={16} />
              </Box>
              <Skeleton variant="rectangular" width={80} height={24} />
            </Box>
            <Skeleton width="100%" height={4} variant="rectangular" />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
};

export default LoadingState;
