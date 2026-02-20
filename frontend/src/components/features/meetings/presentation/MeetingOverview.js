/**
 * MeetingOverview Component
 * Displays basic meeting information (title, date, status, metadata)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  Folder as FolderIcon,
  AccessTime as AccessTimeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { getStatusColor } from '../../../../utils/statusHelpers';

/**
 * MeetingOverview Component
 * @param {Object} props
 * @param {Object} props.meeting - Meeting data
 * @param {boolean} props.isUpdating - Whether an update is in progress
 * @param {Function} props.onRename - Callback for rename action
 * @param {Function} props.onDelete - Callback for delete action
 * @param {Function} props.onDownload - Callback for download action
 */
export const MeetingOverview = ({ meeting, isUpdating, onRename, onDelete, onDownload }) => {
  const navigate = useNavigate();
  const [downloadMenuAnchor, setDownloadMenuAnchor] = React.useState(null);

  if (!meeting) return null;

  const statusColor = getStatusColor(meeting.status);

  return (
    <Card variant="outlined" sx={{ mb: 4 }}>
      <CardContent>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/meetings/browse')}
          sx={{ mb: 2 }}
        >
          Back to Meetings
        </Button>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h5"
              component="h1"
              gutterBottom
              sx={{ wordBreak: 'break-word', lineHeight: 1.25 }}
            >
              {meeting.filename}
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 2 }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              useFlexGap
              flexWrap="wrap"
            >
              <Chip
                label={meeting.status?.toUpperCase() || 'UNKNOWN'}
                color={statusColor}
                size="small"
                icon={meeting.status === 'completed' ? <CheckCircleIcon /> : <ScheduleIcon />}
              />
              {meeting.created_at && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center' }}
                >
                  <CalendarIcon sx={{ fontSize: 16, mr: 0.5 }} />
                  {new Date(meeting.created_at).toLocaleString()}
                </Typography>
              )}
              {meeting.folder && (
                <Chip
                  icon={<FolderIcon />}
                  label={meeting.folder}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              width: { xs: '100%', sm: 'auto' },
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            }}
          >
            {meeting.status === 'completed' && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={(e) => setDownloadMenuAnchor(e.currentTarget)}
                >
                  Export
                </Button>
                <Menu
                  anchorEl={downloadMenuAnchor}
                  open={Boolean(downloadMenuAnchor)}
                  onClose={() => setDownloadMenuAnchor(null)}
                >
                  <MenuItem
                    onClick={() => {
                      onDownload('txt');
                      setDownloadMenuAnchor(null);
                    }}
                  >
                    Text (.txt)
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      onDownload('json');
                      setDownloadMenuAnchor(null);
                    }}
                  >
                    JSON (.json)
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      onDownload('docx');
                      setDownloadMenuAnchor(null);
                    }}
                  >
                    Word (.docx)
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      onDownload('pdf');
                      setDownloadMenuAnchor(null);
                    }}
                  >
                    PDF (.pdf)
                  </MenuItem>
                </Menu>
              </>
            )}
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onRename}
              disabled={isUpdating}
            >
              Rename
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onDelete}
              disabled={isUpdating}
            >
              Delete
            </Button>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {(meeting.estimated_duration || meeting.file_size) && (
          <List dense>
            {meeting.estimated_duration && (
              <ListItem>
                <ListItemIcon>
                  <AccessTimeIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Duration"
                  secondary={`~${meeting.estimated_duration} minutes`}
                />
              </ListItem>
            )}
            {meeting.file_size && (
              <ListItem>
                <ListItemIcon>
                  <InfoIcon />
                </ListItemIcon>
                <ListItemText
                  primary="File Size"
                  secondary={`${(meeting.file_size / (1024 * 1024)).toFixed(2)} MB`}
                />
              </ListItem>
            )}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default MeetingOverview;
