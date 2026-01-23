import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Fade, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Paper,
  Chip,
  LinearProgress,
  Stack,
  Divider,
  IconButton,
  useTheme
} from '@mui/material';
import {
  Upload as UploadIcon,
  FolderOpen as FolderOpenIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
  Sync as ProcessingIcon
} from '@mui/icons-material';
import MeetingCard from './common/MeetingCard';
import LoadingSkeleton from './common/LoadingSkeleton';
import EmptyState from './common/EmptyState';
import UploadFAB from './upload/UploadFAB';
import api from '../api';

const MeetingsDashboard = () => {
  const theme = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    today: 0,
    thisWeek: 0
  });

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/meetings/');
      const meetings = response.data;
      
      // Get recent meetings (last 5 completed)
      const recent = meetings
        .filter(m => m.status === 'completed')
        .sort((a, b) => new Date(b.meeting_date || b.created_at) - new Date(a.meeting_date || a.created_at))
        .slice(0, 5);
      
      setRecentMeetings(recent);

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const todayCount = meetings.filter(m => 
        new Date(m.meeting_date || m.created_at) >= todayStart
      ).length;

      const thisWeekCount = meetings.filter(m => 
        new Date(m.meeting_date || m.created_at) >= weekStart
      ).length;

      setStats({
        total: meetings.length,
        completed: meetings.filter(m => m.status === 'completed').length,
        processing: meetings.filter(m => m.status === 'processing').length,
        failed: meetings.filter(m => m.status === 'failed').length,
        today: todayCount,
        thisWeek: thisWeekCount
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshKey]);

  const handleMeetingsUpdate = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const formatCurrentTime = () => {
    return currentTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Stat card configuration
  const statCards = [
    {
      label: 'Total Meetings',
      value: stats.total,
      icon: AssessmentIcon,
      color: '#1976d2',
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: CheckCircleIcon,
      color: '#4caf50',
    },
    {
      label: 'Processing',
      value: stats.processing,
      icon: ProcessingIcon,
      color: '#2196f3',
    },
    {
      label: 'This Week',
      value: stats.thisWeek,
      icon: TrendingUpIcon,
      color: '#ff9800',
    },
  ];

  return (
    <Fade in timeout={500}>
      <Box>
        {/* Professional Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" fontWeight="700" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatCurrentTime()}
          </Typography>
        </Box>

        {/* Statistics Cards with Consistent Design */}
        {loading ? (
          <LoadingSkeleton variant="compact" count={4} />
        ) : (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    sx={{
                      height: '100%',
                      borderLeft: `4px solid ${stat.color}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                      },
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

        {/* Quick Actions & Recent Meetings */}
        <Grid container spacing={3}>
          {/* Quick Actions */}
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
                    to="/scheduled-meetings"
                    variant="outlined"
                    size="large"
                    fullWidth
                    startIcon={<ScheduleIcon />}
                    sx={{ py: 1.5 }}
                  >
                    Scheduled Meetings
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

          {/* Recent Meetings */}
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" fontWeight="600">
                    Recent Meetings
                  </Typography>
                  <Button 
                    component={Link}
                    to="/meetings/browse"
                    size="small"
                  >
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
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        variant="compact"
                      />
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Upload FAB */}
        <UploadFAB 
          processingCount={stats.processing} 
          onUploadComplete={handleMeetingsUpdate} 
        />
      </Box>
    </Fade>
  );
};

export default MeetingsDashboard;
