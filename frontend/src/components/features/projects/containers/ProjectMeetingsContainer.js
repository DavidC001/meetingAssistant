/**
 * ProjectMeetings — full-page route (/projects/:projectId/meetings)
 * Thin wrapper: uses useProjectMeetings hook + ProjectMeetingsTable presentation.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Alert, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { projectService } from '../../../../services';
import { useProjectMeetings } from '../hooks/useProjectMeetings';
import { ProjectMeetingsTable } from '../presentation/ProjectMeetingsTable';

const ProjectMeetingsContainer = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const meetings = useProjectMeetings(projectId);

  useEffect(() => {
    Promise.all([projectService.getProject(projectId), meetings.loadMeetings()])
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
        <Typography variant="h4" gutterBottom>
          {projectName} — Meetings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {meetings.filteredMeetings.length} meeting
          {meetings.filteredMeetings.length !== 1 ? 's' : ''} found
        </Typography>
      </Box>

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
    </Box>
  );
};

export default ProjectMeetingsContainer;
