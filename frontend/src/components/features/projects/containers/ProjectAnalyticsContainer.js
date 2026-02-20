import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import useProjectAnalytics from '../hooks/useProjectAnalytics';

const ProjectAnalyticsContainer = () => {
  const {
    projectId,
    project,
    analytics,
    activity,
    loading,
    error,
    loadAnalytics,
    formatHours,
    completionRate,
    milestoneCompletionRate,
    meetingsByMonth,
    navigate,
  } = useProjectAnalytics();

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
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/projects/${projectId}`)}>
          Back to Project
        </Button>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadAnalytics}>
          Refresh
        </Button>
      </Stack>

      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          {project?.name} - Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Project insights and performance metrics
        </Typography>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon color="primary" />
                <Typography variant="h6">Meetings</Typography>
              </Stack>
              <Typography variant="h3" mt={1}>
                {analytics?.total_meetings || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total meetings in project
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <ScheduleIcon color="primary" />
                <Typography variant="h6">Duration</Typography>
              </Stack>
              <Typography variant="h3" mt={1}>
                {formatHours(analytics?.total_duration_hours)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total hours tracked
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <AssignmentIcon color="primary" />
                <Typography variant="h6">Action Items</Typography>
              </Stack>
              <Typography variant="h3" mt={1}>
                {analytics?.total_action_items || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {analytics?.completed_action_items || 0} completed
              </Typography>
              <Box mt={1}>
                <LinearProgress variant="determinate" value={completionRate()} />
                <Typography variant="caption" color="text.secondary">
                  {completionRate()}% completion
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleIcon color="primary" />
                <Typography variant="h6">Participants</Typography>
              </Stack>
              <Typography variant="h3" mt={1}>
                {analytics?.unique_participants || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unique speakers
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <AssignmentIcon color="primary" />
                <Typography variant="h6">Action Items by Status</Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {Object.entries(analytics?.action_items_by_status || {}).map(([status, count]) => (
                  <Chip key={status} label={`${status}: ${count}`} sx={{ mr: 1, mb: 1 }} />
                ))}
                {Object.keys(analytics?.action_items_by_status || {}).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No action items available
                  </Typography>
                )}
              </Stack>
              <Box mt={2} display="flex" alignItems="center" gap={1}>
                <WarningIcon color="warning" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  {analytics?.overdue_action_items || 0} overdue items
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Milestone Progress
              </Typography>
              <Stack spacing={1} mb={2}>
                <Typography variant="body2" color="text.secondary">
                  {analytics?.milestone_progress?.completed || 0} completed of{' '}
                  {analytics?.milestone_progress?.total || 0} milestones
                </Typography>
                <LinearProgress variant="determinate" value={milestoneCompletionRate()} />
                <Typography variant="caption" color="text.secondary">
                  {milestoneCompletionRate()}% completion
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {analytics?.milestone_progress?.missed || 0} missed
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Meetings by Month (Last 6 Months)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Meetings</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {meetingsByMonth.map((item) => (
                  <TableRow key={item.month}>
                    <TableCell>{item.month}</TableCell>
                    <TableCell align="right">{item.count}</TableCell>
                  </TableRow>
                ))}
                {meetingsByMonth.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No meeting history available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Action Items by Owner
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Owner</TableCell>
                  <TableCell align="right">Items</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(analytics?.action_items_by_owner || []).map((row) => (
                  <TableRow key={row.owner}>
                    <TableCell>{row.owner}</TableCell>
                    <TableCell align="right">{row.count}</TableCell>
                  </TableRow>
                ))}
                {(analytics?.action_items_by_owner || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No action items assigned
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <List dense>
              {activity.map((item, index) => (
                <React.Fragment key={`${item.type}-${item.timestamp}-${index}`}>
                  <ListItem>
                    <ListItemText
                      primary={item.description}
                      secondary={new Date(item.timestamp).toLocaleString()}
                    />
                  </ListItem>
                  {index < activity.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {activity.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No recent activity"
                    secondary="Activity feed will appear as meetings and milestones update"
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProjectAnalyticsContainer;
