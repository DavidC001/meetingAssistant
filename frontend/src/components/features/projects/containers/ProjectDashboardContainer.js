/**
 * ProjectDashboardContainer
 * Orchestrates project detail via 3 hooks and delegates all UI to
 * presentation components and existing sub-feature components.
 * No raw axios, no window.confirm, no inline dialogs.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Menu,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { FormDialog, ConfirmDialog } from '../../../common';
import { useProjectDetail } from '../hooks/useProjectDetail';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useProjectMeetings } from '../hooks/useProjectMeetings';
import { ProjectOverview } from '../presentation/ProjectOverview';
import { ProjectMeetingsTable } from '../presentation/ProjectMeetingsTable';
import { ProjectMembersList } from '../presentation/ProjectMembersList';
import KanbanBoard from '../../kanban/KanbanBoard';
import ProjectGantt from '../ProjectGantt';
import ProjectChat from '../ProjectChat';
import ProjectNotes from '../ProjectNotes';
import ProjectMilestones from '../ProjectMilestones';

const ProjectDashboardContainer = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(0);

  const detail = useProjectDetail(projectId);
  const members = useProjectMembers(projectId);
  const meetings = useProjectMeetings(projectId);

  const { project, loading, error, exportError } = detail;

  // Lazy-load tab data when user switches tabs
  useEffect(() => {
    if (!project) return;
    if (currentTab === 1) meetings.loadMeetings();
    if (currentTab === 3) members.loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, project]);

  // ───── Loading / Error ─────
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

  const getStatusColor = (status) => {
    const map = { active: 'success', on_hold: 'warning', completed: 'info', archived: 'default' };
    return map[status] || 'default';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* ── Project Header ── */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
          <Box>
            <Typography variant="h4" gutterBottom>
              {project.name}
            </Typography>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <Chip label={project.status} color={getStatusColor(project.status)} />
              {project.tags?.length > 0 && (
                <Box display="flex" gap={0.5} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                    Tags:
                  </Typography>
                  {project.tags.map((tag, idx) => (
                    <Chip key={idx} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
              <Typography variant="body2" color="text.secondary">
                {project.meeting_count} Meeting{project.meeting_count !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={detail.openEditDialog} color="primary" title="Edit Project">
              <EditIcon />
            </IconButton>
            <IconButton onClick={detail.openDeleteDialog} color="error" title="Delete Project">
              <DeleteIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={detail.openExportMenu}
              disabled={detail.exporting}
            >
              Export
            </Button>
            <Menu
              anchorEl={detail.exportAnchorEl}
              open={Boolean(detail.exportAnchorEl)}
              onClose={detail.closeExportMenu}
            >
              <MenuItem onClick={() => detail.handleExport('pdf')}>Export as PDF</MenuItem>
              <MenuItem onClick={() => detail.handleExport('docx')}>Export as DOCX</MenuItem>
              <MenuItem onClick={() => detail.handleExport('txt')}>Export as TXT</MenuItem>
              <MenuItem onClick={() => detail.handleExport('json')}>Export as JSON</MenuItem>
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

      {/* ── Navigation Tabs ── */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
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

      {/* ── Tab Content ── */}
      {currentTab === 0 && (
        <ProjectOverview
          project={project}
          projectId={projectId}
          onTabChange={setCurrentTab}
          onNavigate={navigate}
        />
      )}
      {currentTab === 1 && (
        <ProjectMeetingsTable
          filteredMeetings={meetings.filteredMeetings}
          meetingsLoading={meetings.meetingsLoading}
          searchQuery={meetings.searchQuery}
          onSearchChange={meetings.setSearchQuery}
          onClearSearch={meetings.handleClearSearch}
          statusFilter={meetings.statusFilter}
          onStatusChange={meetings.setStatusFilter}
          sortBy={meetings.sortBy}
          sortOrder={meetings.sortOrder}
          onSort={meetings.handleSort}
          onLoadMeetings={meetings.loadMeetings}
          onNavigateToMeeting={(id) => navigate(`/meetings/${id}`)}
        />
      )}
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
          headerSubtitle={project.name}
        />
      )}
      {currentTab === 3 && (
        <ProjectMembersList
          members={members.members}
          membersLoading={members.membersLoading}
          syncing={members.syncing}
          onSyncMembers={members.handleSyncMembers}
          onOpenAddDialog={members.openAddMemberDialog}
          onOpenEditDialog={members.openEditMemberDialog}
          onRequestDeleteMember={members.requestDeleteMember}
        />
      )}
      {currentTab === 4 && <ProjectGantt projectId={projectId} />}
      {currentTab === 5 && <ProjectChat projectId={projectId} />}
      {currentTab === 6 && <ProjectNotes projectId={projectId} embedded />}
      {currentTab === 7 && <ProjectMilestones projectId={projectId} embedded />}

      {/* ── Edit Project Dialog ── */}
      <FormDialog
        open={detail.editDialogOpen}
        onClose={detail.closeEditDialog}
        onSubmit={detail.handleUpdateProject}
        title="Edit Project"
        submitLabel="Update Project"
        isSubmitDisabled={!detail.editFormData.name}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Project Name"
            value={detail.editFormData.name}
            onChange={(e) =>
              detail.setEditFormData({ ...detail.editFormData, name: e.target.value })
            }
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={detail.editFormData.description}
            onChange={(e) =>
              detail.setEditFormData({ ...detail.editFormData, description: e.target.value })
            }
            fullWidth
            multiline
            rows={3}
          />
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={detail.editFormData.status}
              onChange={(e) =>
                detail.setEditFormData({ ...detail.editFormData, status: e.target.value })
              }
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
            options={detail.availableTags}
            value={detail.editFormData.tags}
            onChange={(_, newValue) =>
              detail.setEditFormData({ ...detail.editFormData, tags: newValue })
            }
            filterOptions={(options, params) => {
              const filtered = options.filter((o) =>
                o.toLowerCase().includes(params.inputValue.toLowerCase())
              );
              if (params.inputValue !== '' && !filtered.includes(params.inputValue))
                filtered.push(params.inputValue);
              return filtered;
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} size="small" />
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
      </FormDialog>

      {/* ── Delete Project Dialog ── */}
      <ConfirmDialog
        open={detail.deleteDialogOpen}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? Associated meetings will NOT be deleted. This action cannot be undone.`}
        confirmLabel="Delete Project"
        confirmColor="error"
        onConfirm={detail.handleDeleteProject}
        onCancel={detail.closeDeleteDialog}
        maxWidth="xs"
      />

      {/* ── Add Member Dialog ── */}
      <FormDialog
        open={members.addMemberDialogOpen}
        onClose={members.closeAddMemberDialog}
        onSubmit={members.handleAddMember}
        title="Add Team Member"
        submitLabel="Add Member"
        isSubmitDisabled={!members.memberFormData.name}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={members.memberFormData.name}
            onChange={(e) =>
              members.setMemberFormData({ ...members.memberFormData, name: e.target.value })
            }
            fullWidth
            required
          />
          <TextField
            label="Email"
            type="email"
            value={members.memberFormData.email}
            onChange={(e) =>
              members.setMemberFormData({ ...members.memberFormData, email: e.target.value })
            }
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={members.memberFormData.role}
              onChange={(e) =>
                members.setMemberFormData({ ...members.memberFormData, role: e.target.value })
              }
              label="Role"
            >
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="lead">Lead</MenuItem>
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="stakeholder">Stakeholder</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </FormDialog>

      {/* ── Edit Member Dialog ── */}
      <FormDialog
        open={members.editMemberDialogOpen}
        onClose={members.closeEditMemberDialog}
        onSubmit={members.handleEditMember}
        title="Edit Team Member"
        submitLabel="Save Changes"
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={members.memberFormData.name} fullWidth disabled />
          <TextField label="Email" value={members.memberFormData.email} fullWidth disabled />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={members.memberFormData.role}
              onChange={(e) =>
                members.setMemberFormData({ ...members.memberFormData, role: e.target.value })
              }
              label="Role"
            >
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="lead">Lead</MenuItem>
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="stakeholder">Stakeholder</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </FormDialog>

      {/* ── Delete Member Confirm ── */}
      <ConfirmDialog
        open={Boolean(members.confirmDeleteMemberId)}
        title="Remove Team Member"
        message="Are you sure you want to remove this team member?"
        confirmLabel="Remove"
        confirmColor="error"
        onConfirm={members.handleDeleteMember}
        onCancel={members.cancelDeleteMember}
        maxWidth="xs"
      />
    </Container>
  );
};

export default ProjectDashboardContainer;
