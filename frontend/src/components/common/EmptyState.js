/**
 * EmptyState Component
 * 
 * Displays a friendly message when no data is available.
 */

import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Inbox as InboxIcon, Add as AddIcon } from '@mui/icons-material';

const EmptyState = ({
  icon: CustomIcon = InboxIcon,
  title = 'No items found',
  description = null,
  actionLabel = null,
  onAction = null,
  size = 'medium',
}) => {
  const iconSizes = {
    small: 48,
    medium: 64,
    large: 96,
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      py={size === 'small' ? 3 : 6}
      px={2}
    >
      <CustomIcon
        sx={{
          fontSize: iconSizes[size] || iconSizes.medium,
          color: 'text.disabled',
          mb: 2,
        }}
      />
      
      <Typography
        variant={size === 'small' ? 'body1' : 'h6'}
        color="text.secondary"
        gutterBottom
      >
        {title}
      </Typography>
      
      {description && (
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ mb: 2, maxWidth: 400 }}
        >
          {description}
        </Typography>
      )}
      
      {actionLabel && onAction && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAction}
          sx={{ mt: 1 }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
