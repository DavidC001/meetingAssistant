import React from 'react';
import { Paper, Typography, Box, Chip, Button } from '@mui/material';
import {
  People as PeopleIcon,
  Folder as FolderIcon,
  LocalOffer as TagIcon,
  Event as MeetingIcon,
  VisibilityOff as HideIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';

const TYPE_ICONS = {
  meeting: MeetingIcon,
  person: PeopleIcon,
  folder: FolderIcon,
  tag: TagIcon,
};

/**
 * GraphNodeDetail — right-panel showing details of a clicked node.
 * @param {{ node: object, connectedCount: number, onOpenMeeting: Function, onHideNode: Function }} props
 */
export const GraphNodeDetail = ({ node, connectedCount, onOpenMeeting, onHideNode }) => {
  const Icon = TYPE_ICONS[node.type] || MeetingIcon;

  return (
    <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Details
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Chip icon={<Icon />} label={node.type} color="primary" size="small" />
      </Box>

      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'bold' }}>
        {node.label}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {node.type === 'meeting' && node.data && (
          <Button
            variant="contained"
            size="small"
            startIcon={<OpenIcon />}
            onClick={onOpenMeeting}
            fullWidth
          >
            Open Meeting
          </Button>
        )}
        <Button
          variant="outlined"
          size="small"
          color="warning"
          startIcon={<HideIcon />}
          onClick={onHideNode}
          fullWidth
        >
          Hide Node
        </Button>
      </Box>

      {node.type === 'meeting' && node.data && (
        <Box>
          {node.data.meeting_date && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Date:</strong> {new Date(node.data.meeting_date).toLocaleDateString()}
            </Typography>
          )}
          {node.data.folder && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Folder:</strong> {node.data.folder}
            </Typography>
          )}
          {node.data.tags && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Tags:</strong>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {node.data.tags.split(',').map((tag, idx) => (
                  <Chip key={idx} label={tag.trim()} size="small" />
                ))}
              </Box>
            </Box>
          )}
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Status:</strong> {node.data.status}
          </Typography>
        </Box>
      )}

      <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
        <strong>Connected to {connectedCount} nodes</strong>
      </Typography>

      {node.type === 'meeting' && node.data && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontSize: '0.85rem' }}>
          Tip: Add meeting references in notes using #meeting-{node.data.id} or [[{node.data.id}]]
        </Typography>
      )}
    </Paper>
  );
};

export default GraphNodeDetail;
