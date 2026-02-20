import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import useProjects from '../hooks/useProjects';
import ProjectStatusSection from '../presentation/ProjectStatusSection';
import ProjectFormDialog from '../presentation/ProjectFormDialog';

const STATUS_SECTIONS = [
  { status: 'active', title: 'Active Projects', dimmed: false },
  { status: 'on_hold', title: 'On Hold Projects', dimmed: false },
  { status: 'completed', title: 'Completed Projects', dimmed: false },
  { status: 'archived', title: 'Archived Projects', dimmed: true },
];

const ProjectsManagerContainer = () => {
  const {
    projects,
    loading,
    error,
    setError,
    createDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    selectedProject,
    selectedMeetings,
    setSelectedMeetings,
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    projectStatus,
    setProjectStatus,
    tags,
    setTags,
    availableTags,
    handleOpenCreateDialog,
    handleOpenEditDialog,
    handleOpenDeleteDialog,
    handleCloseDialog,
    handleCreateProject,
    handleUpdateProject,
    handleDeleteProject,
    getStatusColor,
  } = useProjects();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const sharedFormProps = {
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    projectStatus,
    setProjectStatus,
    tags,
    setTags,
    availableTags,
    selectedMeetings,
    setSelectedMeetings,
    onClose: handleCloseDialog,
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" gutterBottom>
            Projects Manager
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
          >
            New Project
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Create projects by selecting meetings and adding optional tags for organization
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Status sections */}
      {STATUS_SECTIONS.map(({ status, title, dimmed }) => (
        <ProjectStatusSection
          key={status}
          title={title}
          projects={projects.filter((p) => p.status === status)}
          onEdit={handleOpenEditDialog}
          onDelete={handleOpenDeleteDialog}
          getStatusColor={getStatusColor}
          dimmed={dimmed}
        />
      ))}

      {/* Create Dialog */}
      <ProjectFormDialog
        open={createDialogOpen}
        isEdit={false}
        onSubmit={handleCreateProject}
        {...sharedFormProps}
      />

      {/* Edit Dialog */}
      <ProjectFormDialog
        open={editDialogOpen}
        isEdit={true}
        onSubmit={handleUpdateProject}
        {...sharedFormProps}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            Associated meetings will NOT be deleted, only the project itself.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleDeleteProject} variant="contained" color="error">
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectsManagerContainer;
