import React, { useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useSwipeable } from 'react-swipeable';

/**
 * SwipeableCard Component
 *
 * Wraps content to make it swipeable on mobile devices.
 * Reveals action buttons when swiped left.
 */
const SwipeableCard = ({
  children,
  actions = [], // Array of { icon, label, color, onClick }
  enabled = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const actionWidth = 80;
  const maxSwipe = actions.length * actionWidth;

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!enabled || !isMobile) return;

      setIsSwiping(true);
      const newOffset = Math.max(-maxSwipe, Math.min(0, eventData.deltaX));
      setOffset(newOffset);
    },
    onSwiped: () => {
      if (!enabled || !isMobile) return;

      setIsSwiping(false);
      // Snap to open or closed based on swipe distance
      if (offset < -maxSwipe / 2) {
        setOffset(-maxSwipe);
      } else {
        setOffset(0);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  if (!enabled || !isMobile) {
    return <>{children}</>;
  }

  return (
    <Box
      {...handlers}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'pan-y', // Allow vertical scrolling
      }}
    >
      {/* Action Buttons (revealed on swipe) */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          width: maxSwipe,
        }}
      >
        {actions.map((action, index) => (
          <Box
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
              setOffset(0); // Close after action
            }}
            sx={{
              width: actionWidth,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: action.color || 'error.main',
              color: 'white',
              cursor: 'pointer',
              gap: 0.5,
              '&:active': {
                opacity: 0.8,
              },
            }}
          >
            {action.icon}
            <Box sx={{ fontSize: '0.75rem' }}>{action.label}</Box>
          </Box>
        ))}
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          transform: `translateX(${offset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          willChange: 'transform',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default SwipeableCard;
