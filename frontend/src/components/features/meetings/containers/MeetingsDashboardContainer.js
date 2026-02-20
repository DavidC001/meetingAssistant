import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Fade, Grid, Card, CardContent, Button, Stack } from '@mui/material';
import {
  FolderOpen as FolderOpenIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
  Sync as ProcessingIcon,
} from '@mui/icons-material';
import MeetingCard from '../../../common/MeetingCard';
import LoadingSkeleton from '../../../common/LoadingSkeleton';
import EmptyState from '../../../common/EmptyState';
import UploadFAB from '../../../upload/UploadFAB';
import { useDashboard } from '../hooks/useDashboard';

const STAT_CARDS = (stats) => [
  { label: 'Total Meetings', value: stats.total, icon: AssessmentIcon, color: '#1976d2' },
  { label: 'Completed', value: stats.completed, icon: CheckCircleIcon, color: '#4caf50' },
  { label: 'Processing', value: stats.processing, icon: ProcessingIcon, color: '#2196f3' },
  { label: 'This Week', value: stats.thisWeek, icon: TrendingUpIcon, color: '#ff9800' },
];

const MeetingsDashboardContainer = () => {
  const { recentMeetings, loading, stats, formatCurrentTime, refresh } = useDashboard();

  return (
    <Fade in timeout={500}>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" fontWeight="700" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatCurrentTime()}
          </Typography>
        </Box>

        {/* Stats */}
        {loading ? (
          <LoadingSkeleton variant="compact" count={4} />
        ) : (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {STAT_CARDS(stats).map((stat) => {
              const Icon = stat.icon;
              return (
                <Grid item xs={12} sm={6} md={3} key={stat.label}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: `4px solid ${stat.color}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            backgroundColor: `${stat.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon sx={{ fontSize: 24, color: stat.color }} />
                        </Box>
                        <Box>
                          <Typography variant="h4" fontWeight="700">
                            {stat.value}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {stat.label}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        {/* Quick Actions + Recent Meetings */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="600" gutterBottom sx={{ mb: 3 }}>
                  Quick Actions
                </Typography>
                <Stack spacing={2}>
                  <Button
                    component={Link}
                    to="/meetings/browse"
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<FolderOpenIcon />}
                    sx={{ py: 1.5 }}
                  >
                    Browse All Meetings
                  </Button>
                  <Button
                    component={Link}
                    to="/calendar"
                    variant="outlined"
                    size="large"
                    fullWidth
                    startIcon={<CalendarIcon />}
                    sx={{ py: 1.5 }}
                  >
                    Calendar View
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                  }}
                >
                  <Typography variant="h6" fontWeight="600">
                    Recent Meetings
                  </Typography>
                  <Button component={Link} to="/meetings/browse" size="small">
                    View All
                  </Button>
                </Box>

                {loading ? (
                  <LoadingSkeleton variant="compact" count={5} />
                ) : recentMeetings.length === 0 ? (
                  <EmptyState
                    title="No meetings yet"
                    description="Upload your first meeting to get started!"
                    size="small"
                  />
                ) : (
                  <Stack spacing={1}>
                    {recentMeetings.map((meeting) => (
                      <MeetingCard key={meeting.id} meeting={meeting} variant="compact" />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <UploadFAB processingCount={stats.processing} onUploadComplete={refresh} />
      </Box>
    </Fade>
  );
};

export default MeetingsDashboardContainer;
