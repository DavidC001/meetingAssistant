/**
 * ProjectMembersList
 * Presentational component for the Team tab (tab 3).
 * Renders team stats, member list, and action buttons.
 * All data comes via props — no service calls, no window.confirm.
 */

import React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoAwesome as AutoIcon,
  Badge as BadgeIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';

const getRoleInfo = (role) => {
  const roleMap = {
    owner: { label: 'Owner', color: 'error' },
    lead: { label: 'Lead', color: 'primary' },
    member: { label: 'Member', color: 'default' },
    stakeholder: { label: 'Stakeholder', color: 'secondary' },
  };
  return roleMap[role] || roleMap.member;
};

const getInitials = (name) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const groupMembersByRole = (members) => {
  const grouped = { owner: [], lead: [], member: [], stakeholder: [] };
  members.forEach((m) => {
    if (grouped[m.role]) grouped[m.role].push(m);
    else grouped.member.push(m);
  });
  return grouped;
};

export const ProjectMembersList = ({
  members,
  membersLoading,
  syncing,
  onSyncMembers,
  onOpenAddDialog,
  onOpenEditDialog,
  onRequestDeleteMember,
}) => {
  const groupedMembers = groupMembersByRole(members);

  return (
    <>
      {/* Header */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          {members.length} team member{members.length !== 1 ? 's' : ''}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
            onClick={onSyncMembers}
            disabled={syncing}
          >
            Sync from Meetings
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onOpenAddDialog}>
            Add Member
          </Button>
        </Stack>
      </Box>

      {/* Team Stats */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Team Overview
        </Typography>
        <Grid container spacing={2}>
          {[
            { label: 'Owners', count: groupedMembers.owner.length },
            { label: 'Leads', count: groupedMembers.lead.length },
            { label: 'Members', count: groupedMembers.member.length },
            { label: 'Stakeholders', count: groupedMembers.stakeholder.length },
          ].map(({ label, count }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Box textAlign="center">
                <Typography variant="h4">{count}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Member List */}
      <Paper>
        {membersLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : members.length === 0 ? (
          <Box p={3}>
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={onSyncMembers}>
                  Sync Now
                </Button>
              }
            >
              No team members yet. Click "Sync from Meetings" to auto-detect members or add them
              manually.
            </Alert>
          </Box>
        ) : (
          <List>
            {members.map((member, index) => (
              <React.Fragment key={member.id}>
                {index > 0 && <Divider />}
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: getRoleInfo(member.role).color + '.main' }}>
                      {getInitials(member.name)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1">{member.name}</Typography>
                        <Chip
                          label={getRoleInfo(member.role).label}
                          size="small"
                          color={getRoleInfo(member.role).color}
                        />
                        {member.is_auto_detected && (
                          <Tooltip title="Auto-detected from meetings">
                            <AutoIcon fontSize="small" color="action" />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      <Stack direction="row" spacing={2} mt={0.5}>
                        {member.email && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <EmailIcon fontSize="small" />
                            <Typography variant="body2">{member.email}</Typography>
                          </Box>
                        )}
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <BadgeIcon fontSize="small" />
                          <Typography variant="body2">
                            Added {new Date(member.added_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Stack>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Edit Role">
                      <IconButton edge="end" onClick={() => onOpenEditDialog(member)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton edge="end" onClick={() => onRequestDeleteMember(member.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
    </>
  );
};

export default ProjectMembersList;
