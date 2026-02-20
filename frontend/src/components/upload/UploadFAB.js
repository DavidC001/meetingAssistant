/**
 * UploadFAB Component
 *
 * Floating Action Button for triggering file upload.
 * Shows processing count badge and pulsing animation when files are being processed.
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Fab,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Zoom,
  useTheme,
  useMediaQuery,
  Box,
  Tooltip,
  keyframes,
} from '@mui/material';
import { Upload as UploadIcon, Close as CloseIcon } from '@mui/icons-material';
import UploadForm from './UploadForm';

// Pulsing animation for FAB when processing
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(25, 118, 210, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0);
  }
`;

const UploadFAB = ({ processingCount = 0, onUploadComplete }) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleUploadSuccess = () => {
    if (onUploadComplete) {
      onUploadComplete();
    }
    // Keep dialog open so user can upload more files if needed
  };

  return ReactDOM.createPortal(
    <>
      {/* Floating Action Button */}
      <Tooltip title="Upload Meeting" placement="left">
        <Zoom in={true}>
          <Fab
            color="primary"
            aria-label="upload"
            onClick={handleOpen}
            sx={{
              position: 'fixed',
              bottom: { xs: 80, sm: 24 },
              right: { xs: 16, sm: 24 },
              zIndex: 1400,
              animation: processingCount > 0 ? `${pulse} 2s infinite` : 'none',
            }}
          >
            <Badge
              badgeContent={processingCount}
              color="secondary"
              max={99}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.75rem',
                  height: 20,
                  minWidth: 20,
                },
              }}
            >
              <UploadIcon />
            </Badge>
          </Fab>
        </Zoom>
      </Tooltip>

      {/* Upload Dialog */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            minHeight: isMobile ? '100vh' : '600px',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 2,
          }}
        >
          <Box>
            Upload Meeting
            {processingCount > 0 && (
              <Box
                component="span"
                sx={{
                  ml: 2,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  backgroundColor: 'warning.light',
                  color: 'warning.contrastText',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {processingCount} processing
              </Box>
            )}
          </Box>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <UploadForm onUploadSuccess={handleUploadSuccess} />
        </DialogContent>
      </Dialog>
    </>,
    document.body
  );
};

export default UploadFAB;
