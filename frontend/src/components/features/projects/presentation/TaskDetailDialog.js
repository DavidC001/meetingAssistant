import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { formatTooltipDate } from '../hooks/useProjectGantt';

/**
 * Dialog that shows read-only details for a selected Gantt task.
 */
const TaskDetailDialog = ({ open, onClose, selectedTaskDetails }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ pr: 5 }}>
      {selectedTaskDetails?.title || 'Item details'}
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{ position: 'absolute', right: 8, top: 8 }}
      >
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {selectedTaskDetails ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {selectedTaskDetails.typeLabel}
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Dates</Typography>
            <Typography variant="body2">
              Start: {formatTooltipDate(selectedTaskDetails.start)}
            </Typography>
            <Typography variant="body2">
              End: {formatTooltipDate(selectedTaskDetails.end)}
            </Typography>
          </Stack>
          {selectedTaskDetails.priority && (
            <Typography variant="body2">Priority: {selectedTaskDetails.priority}</Typography>
          )}
          {selectedTaskDetails.status && (
            <Typography variant="body2">Status: {selectedTaskDetails.status}</Typography>
          )}
          {selectedTaskDetails.owner && (
            <Typography variant="body2">Owner: {selectedTaskDetails.owner}</Typography>
          )}
          {selectedTaskDetails.notes && (
            <Typography variant="body2">Notes: {selectedTaskDetails.notes}</Typography>
          )}
          {selectedTaskDetails.meetingId && (
            <Typography variant="body2">
              Meeting:{' '}
              <Link href={`/meetings/${selectedTaskDetails.meetingId}`} underline="hover">
                {selectedTaskDetails.meetingTitle}
              </Link>
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No details available.
        </Typography>
      )}
    </DialogContent>
  </Dialog>
);

export default TaskDetailDialog;
