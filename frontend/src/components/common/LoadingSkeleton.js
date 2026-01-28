/**
 * LoadingSkeleton Component
 *
 * Provides skeleton screens for different content types while loading.
 * Supports meeting cards, list items, and custom layouts.
 */

import React from 'react';
import { Box, Card, CardContent, Skeleton, Stack, Grid } from '@mui/material';

const LoadingSkeleton = ({
  variant = 'card', // 'card', 'list', 'compact', 'table'
  count = 3,
  animation = 'wave',
}) => {
  // Skeleton for grid card view
  if (variant === 'card') {
    return (
      <Grid container spacing={3}>
        {Array.from({ length: count }).map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Skeleton
                  variant="text"
                  width="80%"
                  height={32}
                  sx={{ mb: 1 }}
                  animation={animation}
                />
                <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
                  <Skeleton variant="text" width={80} height={20} animation={animation} />
                  <Skeleton variant="text" width={60} height={20} animation={animation} />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Skeleton variant="rounded" width={90} height={24} animation={animation} />
                  <Skeleton variant="rounded" width={70} height={24} animation={animation} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Skeleton variant="rounded" width={60} height={20} animation={animation} />
                  <Skeleton variant="rounded" width={50} height={20} animation={animation} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  // Skeleton for list view
  if (variant === 'list') {
    return (
      <Box>
        {Array.from({ length: count }).map((_, index) => (
          <Card key={index} sx={{ mb: 1, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="60%" height={28} animation={animation} />
                <Skeleton variant="text" width="40%" height={20} animation={animation} />
              </Box>
              <Skeleton variant="rounded" width={90} height={24} animation={animation} />
              <Skeleton variant="circular" width={32} height={32} animation={animation} />
            </Box>
          </Card>
        ))}
      </Box>
    );
  }

  // Skeleton for compact view (recent meetings)
  if (variant === 'compact') {
    return (
      <Box>
        {Array.from({ length: count }).map((_, index) => (
          <Card key={index} sx={{ p: 1.5, mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="70%" height={24} animation={animation} />
                <Skeleton variant="text" width="40%" height={16} animation={animation} />
              </Box>
              <Skeleton variant="rounded" width={90} height={24} animation={animation} />
            </Box>
          </Card>
        ))}
      </Box>
    );
  }

  // Skeleton for table view
  if (variant === 'table') {
    return (
      <Box>
        {Array.from({ length: count }).map((_, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Skeleton variant="rectangular" width={32} height={32} animation={animation} />
            <Skeleton variant="text" width="30%" height={24} animation={animation} />
            <Skeleton variant="text" width="15%" height={24} animation={animation} />
            <Skeleton variant="rounded" width={90} height={24} animation={animation} />
            <Skeleton variant="rounded" width={70} height={24} animation={animation} />
            <Box sx={{ flexGrow: 1 }} />
            <Skeleton variant="circular" width={32} height={32} animation={animation} />
          </Box>
        ))}
      </Box>
    );
  }

  // Default: Simple skeleton
  return (
    <Box>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rectangular"
          height={60}
          sx={{ mb: 2 }}
          animation={animation}
        />
      ))}
    </Box>
  );
};

export default LoadingSkeleton;
