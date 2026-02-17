/**
 * PageHeader Component
 *
 * Consistent page header with title and optional actions.
 */

import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const PageHeader = ({
  title,
  subtitle = null,
  breadcrumbs = [],
  actions = null,
  backButton = null,
}) => {
  return (
    <Box mb={3}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            if (isLast || !crumb.to) {
              return (
                <Typography key={index} color={isLast ? 'text.primary' : 'inherit'} variant="body2">
                  {crumb.label}
                </Typography>
              );
            }

            return (
              <Link
                key={index}
                component={RouterLink}
                to={crumb.to}
                color="inherit"
                underline="hover"
                variant="body2"
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      {/* Header Row */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={2}
      >
        <Box display="flex" alignItems="center" gap={1}>
          {backButton}

          <Box>
            <Typography variant="h4" component="h1">
              {title}
            </Typography>

            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {actions && (
          <Box display="flex" alignItems="center" gap={1}>
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PageHeader;
