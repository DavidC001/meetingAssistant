/**
 * ProjectOverview
 * Presentational component for the project Overview tab (tab 0).
 * Renders stats cards, activity feed, milestones, quick actions, and team preview.
 * All data comes via props — no service calls.
 */

import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Chat as ChatIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Flag as FlagIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

export const ProjectOverview = ({ project, projectId, onTabChange, onNavigate }) => {
  const getActionItemProgress = () => {
    if (!project || project.action_item_count === 0) return 0;
    return (project.completed_action_items / project.action_item_count) * 100;
  };

  const notificationSettings = project?.settings?.notification_preferences || {};
  const dailySummaryEnabled = Boolean(notificationSettings.daily_summary);
  const milestoneRemindersEnabled = Boolean(notificationSettings.milestone_reminders);

  const getDailySummaryItems = () => {
    const activity = project?.recent_activity || [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return activity.filter(
      (item) => item.timestamp && new Date(item.timestamp).getTime() >= cutoff
    );
  };

  const getMilestoneReminders = () => {
    const milestones = project?.milestones || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(today.getDate() + 7);
    return milestones.filter((m) => {
      if (!m.due_date || m.status === 'completed') return false;
      return new Date(m.due_date) <= upcomingLimit;
    });
  };

  return (
    <>
      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <EventIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Meetings</Typography>
              </Box>
              <Typography variant="h4">{project.meeting_count}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total meetings
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <AssignmentIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Action Items</Typography>
              </Box>
              <Typography variant="h4">
                {project.completed_action_items}/{project.action_item_count}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={getActionItemProgress()}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <PeopleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Team Members</Typography>
              </Box>
              <Typography variant="h4">{project.member_count}</Typography>
              <Typography variant="body2" color="text.secondary">
                Active participants
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Milestones</Typography>
              </Box>
              <Typography variant="h4">{project.milestones?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">
                Tracked milestones
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notification panels */}
      {(dailySummaryEnabled || milestoneRemindersEnabled) && (
        <Grid container spacing={3} mb={4}>
          {dailySummaryEnabled && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Daily Summary (Last 24 hours)
                  </Typography>
                  <List>
                    {getDailySummaryItems().length > 0 ? (
                      getDailySummaryItems()
                        .slice(0, 5)
                        .map((activity, index) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={activity.description}
                              secondary={
                                activity.timestamp
                                  ? format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')
                                  : ''
                              }
                            />
                          </ListItem>
                        ))
                    ) : (
                      <ListItem>
                        <ListItemText
                          primary="No activity in the last 24 hours"
                          secondary="New activity will appear here"
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}
          {milestoneRemindersEnabled && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Milestone Reminders (Next 7 days)
                  </Typography>
                  <List>
                    {getMilestoneReminders().length > 0 ? (
                      getMilestoneReminders()
                        .slice(0, 5)
                        .map((milestone) => {
                          const dueDate = milestone.due_date ? new Date(milestone.due_date) : null;
                          const isOverdue = dueDate ? dueDate < new Date() : false;
                          return (
                            <ListItem key={milestone.id}>
                              <ListItemText
                                primary={milestone.name}
                                secondary={
                                  dueDate
                                    ? `Due: ${format(dueDate, 'MMM dd, yyyy')}`
                                    : 'No due date'
                                }
                              />
                              <Chip
                                label={isOverdue ? 'Overdue' : 'Upcoming'}
                                size="small"
                                color={isOverdue ? 'error' : 'warning'}
                              />
                            </ListItem>
                          );
                        })
                    ) : (
                      <ListItem>
                        <ListItemText
                          primary="No upcoming milestones"
                          secondary="Add due dates to get reminders"
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Activity / Milestones / Quick Actions / Team preview */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List>
                {project.recent_activity?.length > 0 ? (
                  project.recent_activity.slice(0, 5).map((activity, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={activity.description}
                        secondary={
                          activity.timestamp
                            ? format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')
                            : ''
                        }
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText
                      primary="No recent activity"
                      secondary="Activity will appear here as you work on the project"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Milestones
              </Typography>
              <List>
                {project.milestones?.length > 0 ? (
                  project.milestones.slice(0, 5).map((milestone) => (
                    <ListItem key={milestone.id}>
                      <ListItemText
                        primary={milestone.name}
                        secondary={
                          milestone.due_date
                            ? `Due: ${format(new Date(milestone.due_date), 'MMM dd, yyyy')}`
                            : 'No due date'
                        }
                      />
                      <Chip
                        label={milestone.status}
                        size="small"
                        color={milestone.status === 'completed' ? 'success' : 'default'}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText
                      primary="No milestones yet"
                      secondary="Add milestones to track project progress"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<EventIcon />}
                  onClick={() => onTabChange(1)}
                  fullWidth
                >
                  View All Meetings
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AssignmentIcon />}
                  onClick={() => onTabChange(2)}
                  fullWidth
                >
                  Manage Action Items
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FlagIcon />}
                  onClick={() => onNavigate(`/projects/${projectId}/milestones`)}
                  fullWidth
                >
                  Manage Milestones
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ChatIcon />}
                  onClick={() => onTabChange(5)}
                  fullWidth
                >
                  Chat with Project
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => onTabChange(6)}
                  fullWidth
                >
                  Project Notes
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PeopleIcon />}
                  onClick={() => onTabChange(3)}
                  fullWidth
                >
                  View Team
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Team Members</Typography>
                <Button size="small" onClick={() => onTabChange(3)}>
                  View All
                </Button>
              </Box>
              <List>
                {project.members?.length > 0 ? (
                  project.members.slice(0, 5).map((member) => (
                    <ListItem key={member.id}>
                      <ListItemAvatar>
                        <Avatar>
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={member.name} secondary={member.role} />
                      {member.is_auto_detected && (
                        <Chip label="Auto" size="small" variant="outlined" />
                      )}
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText
                      primary="No team members"
                      secondary="Members will be auto-detected from meeting speakers"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
};

export default ProjectOverview;
