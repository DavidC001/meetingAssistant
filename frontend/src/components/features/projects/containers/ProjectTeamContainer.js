/**
 * ProjectTeam — full-page route (/projects/:projectId/team)
 * Thin wrapper: uses useProjectMembers hook + ProjectMembersList presentation
 * + FormDialog/ConfirmDialog for member CRUD.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { projectService } from '../../../../services';
import { FormDialog, ConfirmDialog } from '../../../common';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { ProjectMembersList } from '../presentation/ProjectMembersList';

const ProjectTeamContainer = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const members = useProjectMembers(projectId);

  useEffect(() => {
    Promise.all([projectService.getProject(projectId), members.loadMembers()])
      .then(([res]) => setProjectName(res.data?.name || ''))
      .catch((err) => setPageError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setPageLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (pageLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }
  if (pageError) {
    return (
      <Box p={3}>
        <Alert severity="error">{pageError}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/projects/${projectId}`)}
          sx={{ mb: 1 }}
        >
          Back to Project
        </Button>
        <Typography variant="h4">{projectName} — Team</Typography>
      </Box>

      <ProjectMembersList
        members={members.members}
        membersLoading={members.membersLoading}
        syncing={members.syncing}
        onSyncMembers={members.handleSyncMembers}
        onOpenAddDialog={members.openAddMemberDialog}
        onOpenEditDialog={members.openEditMemberDialog}
        onRequestDeleteMember={members.requestDeleteMember}
      />

      {/* Add Member */}
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

      {/* Edit Member */}
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

      {/* Delete Confirm */}
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
    </Box>
  );
};

export default ProjectTeamContainer;
