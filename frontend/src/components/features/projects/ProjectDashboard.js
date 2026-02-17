import React, { useState, useEffect } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as AssignmentIcon,
  AutoAwesome as AutoIcon,
  Badge as BadgeIcon,
  CalendarToday as CalendarIcon,
  Chat as ChatIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../../../services/projectService';
import { downloadBlob, MeetingService } from '../../../services';
import { format } from 'date-fns';
import KanbanBoard from '../kanban/KanbanBoard';
import ProjectGantt from './ProjectGantt';
import ProjectChat from './ProjectChat';
import ProjectNotes from './ProjectNotes';
import ProjectMilestones from './ProjectMilestones';

import logger from '../../../utils/logger';
const ProjectDashboard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);

  // Tab-specific state
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Edit/Delete dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    tags: [],
  });
  const [availableTags, setAvailableTags] = useState([]);

  // Team member management
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberFormData, setMemberFormData] = useState({
    name: '',
    email: '',
    role: 'member',
  });

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    loadAvailableTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (project) {
      if (currentTab === 1) loadMeetings();
      if (currentTab === 3) loadMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, project]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectService.getProject(projectId);
      setProject(response.data);
    } catch (err) {
      setError('Failed to load project: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const response = await MeetingService.getAllTags();
      const tagsSet = new Set(response || []);
      if (project?.tags && Array.isArray(project.tags)) {
        project.tags.forEach((tag) => {
          if (tag && tag.trim()) {
            tagsSet.add(tag.trim());
          }
        });
      }
      setAvailableTags(Array.from(tagsSet).sort());
    } catch (err) {
      logger.warn('Failed to load available tags', err);
    }
  };

  const handleOpenEditDialog = () => {
    setEditFormData({
      name: project.name,
      description: project.description || '',
      status: project.status || 'active',
      tags: project.tags || [],
    });
    setEditDialogOpen(true);
  };

  const handleUpdateProject = async () => {
    try {
      await projectService.updateProject(projectId, {
        name: editFormData.name,
        description: editFormData.description || null,
        status: editFormData.status,
        tags: editFormData.tags,
      });
      setEditDialogOpen(false);
      await loadProject();
    } catch (err) {
      setError('Failed to update project: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.deleteProject(projectId, false);
      setDeleteDialogOpen(false);
      navigate('/projects');
    } catch (err) {
      setError('Failed to delete project: ' + (err.response?.data?.detail || err.message));
    }
  };

  const loadMeetings = async () => {
    try {
      setMeetingsLoading(true);
      const response = await projectService.getProjectMeetings(projectId, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setMeetings(response.data || []);
    } catch (err) {
      logger.error('Failed to load meetings:', err);
    } finally {
      setMeetingsLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      setMembersLoading(true);
      const response = await projectService.getMembers(projectId);
      setMembers(response.data || []);
    } catch (err) {
      logger.error('Failed to load members:', err);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleSyncMembers = async () => {
    try {
      setSyncing(true);
      await projectService.syncMembers(projectId);
      await loadMembers();
    } catch (err) {
      logger.error('Failed to sync members:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleAddMember = async () => {
    try {
      await projectService.addMember(projectId, memberFormData);
      await loadMembers();
      setAddMemberDialogOpen(false);
      setMemberFormData({ name: '', email: '', role: 'member' });
    } catch (err) {
      logger.error('Failed to add member:', err);
    }
  };

  const handleEditMember = async () => {
    try {
      await projectService.updateMember(projectId, selectedMember.id, {
        role: memberFormData.role,
      });
      await loadMembers();
      setEditMemberDialogOpen(false);
      setSelectedMember(null);
      setMemberFormData({ name: '', email: '', role: 'member' });
    } catch (err) {
      logger.error('Failed to update member:', err);
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) {
      return;
    }
    try {
      await projectService.removeMember(projectId, memberId);
      await loadMembers();
    } catch (err) {
      logger.error('Failed to remove member:', err);
    }
  };

  const openEditMemberDialog = (member) => {
    setSelectedMember(member);
    setMemberFormData({
      name: member.name,
      email: member.email || '',
      role: member.role,
    });
    setEditMemberDialogOpen(true);
  };

  const openAddMemberDialog = () => {
    setMemberFormData({ name: '', email: '', role: 'member' });
    setAddMemberDialogOpen(true);
  };

  const handleOpenExportMenu = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleCloseExportMenu = () => {
    setExportAnchorEl(null);
  };

  const getExportFilename = (response, fallbackName) => {
    const contentDisposition =
      response?.headers?.['content-disposition'] || response?.headers?.['Content-Disposition'];
    if (contentDisposition) {
      const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
      if (match && match[1]) {
        return match[1];
      }
    }
    return fallbackName;
  };

  const handleExport = async (formatType) => {
    if (!projectId) return;
    try {
      setExporting(true);
      setExportError(null);
      const response = await projectService.exportProject(projectId, formatType);
      const baseName = (project?.name || `project_${projectId}`).replace(/[^a-z0-9-_]+/gi, '_');
      const filename = getExportFilename(response, `${baseName}_report.${formatType}`);
      downloadBlob(response.data, filename);
    } catch (err) {
      setExportError('Failed to export project report. Please try again.');
    } finally {
      setExporting(false);
      handleCloseExportMenu();
    }
  };

  // Meetings helpers
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const filteredMeetings = meetings.filter((meeting) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      meeting.title?.toLowerCase().includes(query) ||
      meeting.folder?.toLowerCase().includes(query) ||
      meeting.speakers?.some((s) => s.toLowerCase().includes(query))
    );
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Team helpers
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'on_hold':
        return 'warning';
      case 'completed':
        return 'info';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  };

  const getActionItemProgress = () => {
    if (!project || project.action_item_count === 0) return 0;
    return (project.completed_action_items / project.action_item_count) * 100;
  };

  const getMeetingStatusColor = (status) => {
    const colors = {
      completed: 'success',
      processing: 'warning',
      failed: 'error',
      pending: 'default',
    };
    return colors[status] || 'default';
  };

  const notificationSettings = project?.settings?.notification_preferences || {};
  const dailySummaryEnabled = Boolean(notificationSettings.daily_summary);
  const milestoneRemindersEnabled = Boolean(notificationSettings.milestone_reminders);

  const getDailySummaryItems = () => {
    const activity = project?.recent_activity || [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return activity.filter((item) => {
      if (!item.timestamp) return false;
      return new Date(item.timestamp).getTime() >= cutoff;
    });
  };

  const getMilestoneReminders = () => {
    const milestones = project?.milestones || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(today.getDate() + 7);

    return milestones.filter((milestone) => {
      if (!milestone.due_date) return false;
      if (milestone.status === 'completed') return false;
      const dueDate = new Date(milestone.due_date);
      return dueDate <= upcomingLimit;
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Project not found'}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Project Header */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
          <Box>
            <Typography variant="h4" gutterBottom>
              {project.name}
            </Typography>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <Chip label={project.status} color={getStatusColor(project.status)} />
              {project.tags && project.tags.length > 0 && (
                <Box display="flex" gap={0.5} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                    Tags:
                  </Typography>
                  {project.tags.map((tag, idx) => (
                    <Chip key={idx} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                {project.meeting_count} Meeting{project.meeting_count !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleOpenEditDialog} color="primary" title="Edit Project">
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={() => setDeleteDialogOpen(true)}
              color="error"
              title="Delete Project"
            >
              <DeleteIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleOpenExportMenu}
              disabled={exporting}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              open={Boolean(exportAnchorEl)}
              onClose={handleCloseExportMenu}
            >
              <MenuItem onClick={() => handleExport('pdf')}>Export as PDF</MenuItem>
              <MenuItem onClick={() => handleExport('docx')}>Export as DOCX</MenuItem>
              <MenuItem onClick={() => handleExport('txt')}>Export as TXT</MenuItem>
              <MenuItem onClick={() => handleExport('json')}>Export as JSON</MenuItem>
            </Menu>
            <Button
              variant="outlined"
              startIcon={<TrendingUpIcon />}
              onClick={() => navigate(`/projects/${projectId}/analytics`)}
            >
              Analytics
            </Button>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => navigate(`/projects/${projectId}/settings`)}
            >
              Settings
            </Button>
          </Stack>
        </Box>
        {exportError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {exportError}
          </Alert>
        )}
        {project.description && (
          <Typography variant="body1" color="text.secondary">
            {project.description}
          </Typography>
        )}
      </Box>

      {/* Navigation Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab label="Overview" />
          <Tab label="Meetings" />
          <Tab label="Action Items" />
          <Tab label="Team" />
          <Tab label="Timeline" />
          <Tab label="Chat" />
          <Tab label="Notes" />
          <Tab label="Milestones" />
        </Tabs>
      </Paper>

      {/* Tab Content: Overview */}
      {currentTab === 0 && (
        <>
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <EventIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Meetings</Typography>
                  </Box>
                  <Typography variant="h4">{project.meeting_count}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total meetings
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <AssignmentIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Action Items</Typography>
                  </Box>
                  <Typography variant="h4">
                    {project.completed_action_items}/{project.action_item_count}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={getActionItemProgress()}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <PeopleIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Team Members</Typography>
                  </Box>
                  <Typography variant="h4">{project.member_count}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active participants
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Milestones</Typography>
                  </Box>
                  <Typography variant="h4">{project.milestones?.length || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tracked milestones
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {(dailySummaryEnabled || milestoneRemindersEnabled) && (
            <Grid container spacing={3} mb={4}>
              {dailySummaryEnabled && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Daily Summary (Last 24 hours)
                      </Typography>
                      <List>
                        {getDailySummaryItems().length > 0 ? (
                          getDailySummaryItems()
                            .slice(0, 5)
                            .map((activity, index) => (
                              <ListItem key={index}>
                                <ListItemText
                                  primary={activity.description}
                                  secondary={
                                    activity.timestamp
                                      ? format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')
                                      : ''
                                  }
                                />
                              </ListItem>
                            ))
                        ) : (
                          <ListItem>
                            <ListItemText
                              primary="No activity in the last 24 hours"
                              secondary="New activity will appear here"
                            />
                          </ListItem>
                        )}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {milestoneRemindersEnabled && (
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Milestone Reminders (Next 7 days)
                      </Typography>
                      <List>
                        {getMilestoneReminders().length > 0 ? (
                          getMilestoneReminders()
                            .slice(0, 5)
                            .map((milestone) => {
                              const dueDate = milestone.due_date
                                ? new Date(milestone.due_date)
                                : null;
                              const isOverdue = dueDate ? dueDate < new Date() : false;
                              return (
                                <ListItem key={milestone.id}>
                                  <ListItemText
                                    primary={milestone.name}
                                    secondary={
                                      dueDate
                                        ? `Due: ${format(dueDate, 'MMM dd, yyyy')}`
                                        : 'No due date'
                                    }
                                  />
                                  <Chip
                                    label={isOverdue ? 'Overdue' : 'Upcoming'}
                                    size="small"
                                    color={isOverdue ? 'error' : 'warning'}
                                  />
                                </ListItem>
                              );
                            })
                        ) : (
                          <ListItem>
                            <ListItemText
                              primary="No upcoming milestones"
                              secondary="Add due dates to get reminders"
                            />
                          </ListItem>
                        )}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Activity
                  </Typography>
                  <List>
                    {project.recent_activity && project.recent_activity.length > 0 ? (
                      project.recent_activity.slice(0, 5).map((activity, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={activity.description}
                            secondary={
                              activity.timestamp
                                ? format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')
                                : ''
                            }
                          />
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText
                          primary="No recent activity"
                          secondary="Activity will appear here as you work on the project"
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Milestones
                  </Typography>
                  <List>
                    {project.milestones && project.milestones.length > 0 ? (
                      project.milestones.slice(0, 5).map((milestone) => (
                        <ListItem key={milestone.id}>
                          <ListItemText
                            primary={milestone.name}
                            secondary={
                              milestone.due_date
                                ? `Due: ${format(new Date(milestone.due_date), 'MMM dd, yyyy')}`
                                : 'No due date'
                            }
                          />
                          <Chip
                            label={milestone.status}
                            size="small"
                            color={milestone.status === 'completed' ? 'success' : 'default'}
                          />
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText
                          primary="No milestones yet"
                          secondary="Add milestones to track project progress"
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Actions
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Button
                      variant="outlined"
                      startIcon={<EventIcon />}
                      onClick={() => setCurrentTab(1)}
                      fullWidth
                    >
                      View All Meetings
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<AssignmentIcon />}
                      onClick={() => setCurrentTab(2)}
                      fullWidth
                    >
                      Manage Action Items
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<FlagIcon />}
                      onClick={() => navigate(`/projects/${projectId}/milestones`)}
                      fullWidth
                    >
                      Manage Milestones
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ChatIcon />}
                      onClick={() => setCurrentTab(5)}
                      fullWidth
                    >
                      Chat with Project
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => setCurrentTab(6)}
                      fullWidth
                    >
                      Project Notes
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PeopleIcon />}
                      onClick={() => setCurrentTab(3)}
                      fullWidth
                    >
                      View Team
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Team Members</Typography>
                    <Button size="small" onClick={() => setCurrentTab(3)}>
                      View All
                    </Button>
                  </Box>
                  <List>
                    {project.members && project.members.length > 0 ? (
                      project.members.slice(0, 5).map((member) => (
                        <ListItem key={member.id}>
                          <ListItemAvatar>
                            <Avatar>
                              <PersonIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText primary={member.name} secondary={member.role} />
                          {member.is_auto_detected && (
                            <Chip label="Auto" size="small" variant="outlined" />
                          )}
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText
                          primary="No team members"
                          secondary="Members will be auto-detected from meeting speakers"
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {/* Tab Content: Meetings */}
      {currentTab === 1 && (
        <>
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              {/* Search */}
              <TextField
                fullWidth
                placeholder="Search meetings by title, folder, or speaker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleClearSearch}>
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Status Filter */}
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>

              {/* Refresh Button */}
              <Button variant="outlined" onClick={loadMeetings} disabled={meetingsLoading}>
                <RefreshIcon />
              </Button>
            </Stack>
          </Paper>

          {/* Meetings Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'title'}
                      direction={sortBy === 'title' ? sortOrder : 'asc'}
                      onClick={() => handleSort('title')}
                    >
                      Title
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'date'}
                      direction={sortBy === 'date' ? sortOrder : 'asc'}
                      onClick={() => handleSort('date')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Speakers</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action Items</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {meetingsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress sx={{ my: 2 }} />
                    </TableCell>
                  </TableRow>
                ) : filteredMeetings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" py={4}>
                        No meetings found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMeetings.map((meeting) => (
                    <TableRow
                      key={meeting.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {meeting.title || `Meeting ${meeting.id}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {formatDate(meeting.meeting_date)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PersonIcon fontSize="small" color="action" />
                          <Typography variant="body2">{meeting.speakers?.length || 0}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={meeting.status || 'unknown'}
                          color={getMeetingStatusColor(meeting.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{meeting.action_items_count || 0}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Meeting">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/meetings/${meeting.id}`);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Tab Content: Action Items */}
      {currentTab === 2 && (
        <KanbanBoard
          mode="project"
          projectId={projectId}
          showHeader
          showFilters
          allowAdd
          allowEdit
          allowDelete
          defaultShowCompleted={false}
          headerTitle="Project Action Items"
          headerSubtitle={project?.name || 'Project'}
        />
      )}

      {/* Tab Content: Team */}
      {currentTab === 3 && (
        <>
          {/* Team Header */}
          <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {members.length} team member{members.length !== 1 ? 's' : ''}
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={handleSyncMembers}
                disabled={syncing}
              >
                Sync from Meetings
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openAddMemberDialog}>
                Add Member
              </Button>
            </Stack>
          </Box>

          {/* Team Statistics */}
          {(() => {
            const groupedMembers = groupMembersByRole();
            return (
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
            );
          })()}

          {/* Team Members List */}
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
                    <Button color="inherit" size="small" onClick={handleSyncMembers}>
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
                          <IconButton edge="end" onClick={() => openEditMemberDialog(member)}>
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
                ))}
              </List>
            )}
          </Paper>
        </>
      )}

      {/* Tab Content: Milestones */}
      {currentTab === 7 && <ProjectMilestones projectId={projectId} embedded />}

      {/* Tab Content: Timeline (Gantt) */}
      {currentTab === 4 && <ProjectGantt projectId={projectId} />}

      {/* Tab Content: Chat */}
      {currentTab === 5 && <ProjectChat projectId={projectId} />}

      {/* Tab Content: Notes */}
      {currentTab === 6 && <ProjectNotes projectId={projectId} embedded />}

      {/* Add Member Dialog */}
      <Dialog
        open={addMemberDialogOpen}
        onClose={() => setAddMemberDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={memberFormData.name}
              onChange={(e) => setMemberFormData({ ...memberFormData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={memberFormData.email}
              onChange={(e) => setMemberFormData({ ...memberFormData, email: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={memberFormData.role}
                onChange={(e) => setMemberFormData({ ...memberFormData, role: e.target.value })}
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
          <Button onClick={() => setAddMemberDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddMember} variant="contained" disabled={!memberFormData.name}>
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog
        open={editMemberDialogOpen}
        onClose={() => setEditMemberDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Team Member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={memberFormData.name} fullWidth disabled />
            <TextField label="Email" value={memberFormData.email} fullWidth disabled />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={memberFormData.role}
                onChange={(e) => setMemberFormData({ ...memberFormData, role: e.target.value })}
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
          <Button onClick={() => setEditMemberDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditMember} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Project Name"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="on_hold">On Hold</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              freeSolo
              options={availableTags}
              value={editFormData.tags}
              onChange={(event, newValue) => setEditFormData({ ...editFormData, tags: newValue })}
              filterOptions={(options, params) => {
                const filtered = options.filter((option) =>
                  option.toLowerCase().includes(params.inputValue.toLowerCase())
                );
                if (params.inputValue !== '' && !filtered.includes(params.inputValue)) {
                  filtered.push(params.inputValue);
                }
                return filtered;
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Add tags..."
                  helperText="Optional: organize projects with tags"
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateProject} variant="contained" color="primary">
            Update Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{project?.name}"? This action cannot be undone.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            Associated meetings will NOT be deleted, only the project itself.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteProject} variant="contained" color="error">
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectDashboard;
