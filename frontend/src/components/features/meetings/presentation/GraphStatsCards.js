import React from 'react';
import { Grid, Card, CardContent, Box, Typography } from '@mui/material';
import {
  People as PeopleIcon,
  Folder as FolderIcon,
  LocalOffer as TagIcon,
  Event as MeetingIcon,
} from '@mui/icons-material';

const STATS_CONFIG = [
  { key: 'meetings', icon: MeetingIcon, color: '#1976d2', label: 'Meetings' },
  { key: 'people', icon: PeopleIcon, color: '#f50057', label: 'People' },
  { key: 'folders', icon: FolderIcon, color: '#ff9800', label: 'Folders' },
  { key: 'tags', icon: TagIcon, color: '#4caf50', label: 'Tags' },
];

/**
 * GraphStatsCards — stat summary row above the graph.
 * @param {{ stats: { meetings: number, people: number, folders: number, tags: number } }} props
 */
export const GraphStatsCards = ({ stats }) => {
  if (!stats) return null;
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {STATS_CONFIG.map(({ key, icon: Icon, color, label }) => (
        <Grid item xs={12} sm={6} md={3} key={key}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Icon sx={{ mr: 1, color }} />
                <Box>
                  <Typography variant="h5">{stats[key]}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default GraphStatsCards;
