import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Container, CircularProgress, Alert } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import KanbanBoard from '../kanban/KanbanBoard';
import { projectService } from '../../../services';

const ProjectActionItems = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await projectService.getProject(projectId);
        setProject(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/projects/${projectId}`)}>
          Back to Project
        </Button>
      </Box>

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
    </Container>
  );
};

export default ProjectActionItems;
