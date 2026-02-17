import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Avatar,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add as AddIcon,
  Sync as SyncIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  AutoAwesome as AutoIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { projectService } from '../../../services';

import logger from '../../../utils/logger';
const ProjectTeam = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'member',
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectResponse, membersResponse] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getMembers(projectId),
      ]);

      setProject(projectResponse.data);
      setMembers(membersResponse.data);
    } catch (err) {
      logger.error('Failed to load team members:', err);
      setError(err.response?.data?.detail || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMembers = async () => {
    try {
      setSyncing(true);
      setError(null);

      await projectService.syncMembers(projectId);
      await loadData(); // Reload to show updated members
    } catch (err) {
      logger.error('Failed to sync members:', err);
      setError(err.response?.data?.detail || 'Failed to sync members');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddMember = async () => {
    try {
      setError(null);

      await projectService.addMember(projectId, formData);
      await loadData();

      setAddDialogOpen(false);
      setFormData({ name: '', email: '', role: 'member' });
    } catch (err) {
      logger.error('Failed to add member:', err);
      setError(err.response?.data?.detail || 'Failed to add member');
    }
  };

  const handleEditMember = async () => {
    try {
      setError(null);

      await projectService.updateMember(projectId, selectedMember.id, {
        role: formData.role,
      });
      await loadData();

      setEditDialogOpen(false);
      setSelectedMember(null);
      setFormData({ name: '', email: '', role: 'member' });
    } catch (err) {
      logger.error('Failed to update member:', err);
      setError(err.response?.data?.detail || 'Failed to update member');
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      setError(null);
      await projectService.removeMember(projectId, memberId);
      await loadData();
    } catch (err) {
      logger.error('Failed to remove member:', err);
      setError(err.response?.data?.detail || 'Failed to remove member');
    }
  };

  const openEditDialog = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      email: member.email || '',
      role: member.role,
    });
    setEditDialogOpen(true);
  };

  const openAddDialog = () => {
    setFormData({ name: '', email: '', role: 'member' });
    setAddDialogOpen(true);
  };

  const getRoleInfo = (role) => {
    const roleMap = {
      owner: { label: 'Owner', color: 'error' },
      lead: { label: 'Lead', color: 'primary' },
      member: { label: 'Member', color: 'default' },
      stakeholder: { label: 'Stakeholder', color: 'secondary' },
    };
    return roleMap[role] || roleMap.member;
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const groupMembersByRole = () => {
    const grouped = {
      owner: [],
      lead: [],
      member: [],
      stakeholder: [],
    };

    members.forEach((member) => {
      if (grouped[member.role]) {
        grouped[member.role].push(member);
      } else {
        grouped.member.push(member);
      }
    });

    return grouped;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const groupedMembers = groupMembersByRole();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/projects/${projectId}`)}
            sx={{ mb: 1 }}
          >
            Back to Project
          </Button>
          <Typography variant="h4" gutterBottom>
            {project?.name} - Team
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {members.length} team member{members.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
            onClick={handleSyncMembers}
            disabled={syncing}
          >
            Sync from Meetings
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
            Add Member
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Team Statistics */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Team Overview
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h4">{groupedMembers.owner.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Owners
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h4">{groupedMembers.lead.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Leads
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h4">{groupedMembers.member.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Members
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h4">{groupedMembers.stakeholder.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Stakeholders
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Team Members List */}
      <Paper>
        <List>
          {members.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="body2" color="text.secondary" align="center" py={4}>
                    No team members yet. Click "Sync from Meetings" to auto-detect members or add
                    them manually.
                  </Typography>
                }
              />
            </ListItem>
          ) : (
            members.map((member, index) => (
              <React.Fragment key={member.id}>
                {index > 0 && <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
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
                      <IconButton edge="end" onClick={() => openEditDialog(member)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton edge="end" onClick={() => handleDeleteMember(member.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            ))
          )}
        </List>
      </Paper>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="owner">Owner</MenuItem>
                <MenuItem value="lead">Lead</MenuItem>
                <MenuItem value="member">Member</MenuItem>
                <MenuItem value="stakeholder">Stakeholder</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddMember} variant="contained" disabled={!formData.name}>
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Team Member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={formData.name} fullWidth disabled />
            <TextField label="Email" value={formData.email} fullWidth disabled />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="owner">Owner</MenuItem>
                <MenuItem value="lead">Lead</MenuItem>
                <MenuItem value="member">Member</MenuItem>
                <MenuItem value="stakeholder">Stakeholder</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditMember} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectTeam;
