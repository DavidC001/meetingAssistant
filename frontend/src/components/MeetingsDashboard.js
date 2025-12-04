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
  Divider
} from '@mui/material';
import {
  Upload as UploadIcon,
  FolderOpen as FolderOpenIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import UploadForm from './UploadForm';
import api from '../api';

const MeetingsDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    today: 0,
    thisWeek: 0
  });

  const fetchDashboardData = async () => {
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
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));

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
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshKey]);

  const handleMeetingsUpdate = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h3" component="h1" fontWeight="700" gutterBottom>
              Welcome Back! 👋
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Upload new meetings or browse your collection
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" fontWeight="700">{stats.total}</Typography>
                    <Typography variant="body2">Total Meetings</Typography>
                  </Box>
                  <AssessmentIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" fontWeight="700">{stats.completed}</Typography>
                    <Typography variant="body2">Completed</Typography>
                  </Box>
                  <CheckCircleIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" fontWeight="700">{stats.processing}</Typography>
                    <Typography variant="body2">Processing</Typography>
                  </Box>
                  <ScheduleIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h3" fontWeight="700">{stats.thisWeek}</Typography>
                    <Typography variant="body2">This Week</Typography>
                  </Box>
                  <TrendingUpIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Upload Section */}
        <Card elevation={3} sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <UploadIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
              <Typography variant="h5" fontWeight="600">
                Upload New Meeting
              </Typography>
            </Box>
            <UploadForm onUploadSuccess={handleMeetingsUpdate} />
          </CardContent>
        </Card>

        {/* Quick Actions & Recent Meetings */}
        <Grid container spacing={3}>
          {/* Quick Actions */}
          <Grid item xs={12} md={4}>
            <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="600" gutterBottom sx={{ mb: 3 }}>
                  🚀 Quick Actions
                </Typography>
                <Stack spacing={2}>
                  <Button
                    component={Link}
                    to="/meetings/browse"
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<FolderOpenIcon />}
                    sx={{ 
                      py: 1.5,
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                    }}
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
            <Card elevation={3} sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" fontWeight="600">
                    📋 Recent Meetings
                  </Typography>
                  <Button 
                    component={Link}
                    to="/meetings/browse"
                    size="small"
                  >
                    View All
                  </Button>
                </Box>
                
                {recentMeetings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No meetings yet. Upload your first meeting to get started!
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {recentMeetings.map((meeting) => (
                      <Paper
                        key={meeting.id}
                        elevation={1}
                        sx={{
                          p: 2,
                          transition: 'all 0.3s',
                          '&:hover': {
                            elevation: 3,
                            transform: 'translateX(4px)',
                            bgcolor: 'action.hover'
                          }
                        }}
                      >
                        <Box
                          component={Link}
                          to={`/meetings/${meeting.id}`}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textDecoration: 'none',
                            color: 'inherit'
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                              {meeting.filename}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(meeting.meeting_date || meeting.created_at)}
                              </Typography>
                              {meeting.folder && (
                                <>
                                  <Divider orientation="vertical" flexItem />
                                  <Chip 
                                    label={meeting.folder} 
                                    size="small" 
                                    variant="outlined"
                                  />
                                </>
                              )}
                            </Stack>
                          </Box>
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Completed"
                            color="success"
                            size="small"
                          />
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
};

export default MeetingsDashboard;
