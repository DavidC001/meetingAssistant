/**
 * FormDialog Component
 *
 * Generic dialog wrapper for forms.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const FormDialog = ({
  open,
  onClose,
  onSubmit,
  title,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  maxWidth = 'sm',
  isLoading = false,
  isSubmitDisabled = false,
  showCloseButton = true,
  fullWidth = true,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            {title}
            {showCloseButton && !isLoading && (
              <IconButton onClick={onClose} size="small" aria-label="close">
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </DialogTitle>

        <DialogContent dividers>{children}</DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isLoading} color="inherit">
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || isSubmitDisabled}
            startIcon={isLoading ? <CircularProgress size={16} /> : null}
          >
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default FormDialog;
