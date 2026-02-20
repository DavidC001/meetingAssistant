import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import ProjectCard from './ProjectCard';

/**
 * Renders a heading + grid of ProjectCards for a single status group.
 * Only renders if there are projects for this status.
 */
const ProjectStatusSection = ({ title, projects, onEdit, onDelete, getStatusColor, dimmed }) => {
  if (!projects || projects.length === 0) return null;

  return (
    <Box mb={4}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Grid container spacing={3}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={onEdit}
            onDelete={onDelete}
            getStatusColor={getStatusColor}
            dimmed={dimmed}
          />
        ))}
      </Grid>
    </Box>
  );
};

export default ProjectStatusSection;
