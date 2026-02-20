import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  TextField,
  Button,
  IconButton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  CalendarToday as CalendarIcon,
  EmojiEvents as TrophyIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import useDiaryStatistics from '../hooks/useDiaryStatistics';

const DiaryStatisticsContainer = () => {
  const {
    loading,
    error,
    statistics,
    timeline,
    dateRange,
    loadStatistics,
    handleDateRangeChange,
    navigate,
  } = useDiaryStatistics();

  if (loading && !statistics) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box p={3}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <IconButton onClick={() => navigate('/diary')} color="primary">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ mb: 0 }}>
            Diary Statistics & Metrics
          </Typography>
        </Box>

        <Box display="flex" gap={2} mb={4} alignItems="center">
          <TextField
            type="date"
            label="Start Date"
            value={dateRange.start}
            onChange={(e) => handleDateRangeChange('start', e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            type="date"
            label="End Date"
            value={dateRange.end}
            onChange={(e) => handleDateRangeChange('end', e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <Button variant="outlined" onClick={loadStatistics}>
            Refresh
          </Button>
        </Box>

        {statistics && (
          <>
            <Grid container spacing={3} mb={4}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <CalendarIcon color="primary" />
                      <Typography variant="h6">{statistics.total_entries}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Diary Entries
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AccessTimeIcon color="primary" />
                      <Typography variant="h6">{statistics.average_hours_worked}h</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Avg Hours/Day
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total: {statistics.total_hours_worked}h
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <CheckCircleIcon color="success" />
                      <Typography variant="h6">
                        {statistics.total_action_items_completed}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Action Items Completed
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <TrendingUpIcon color="primary" />
                      <Typography variant="h6">
                        {statistics.average_arrival_time || 'N/A'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Avg Arrival Time
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Departure: {statistics.average_departure_time || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Productivity Distribution (1-10 Scale)
                </Typography>
                {Object.keys(statistics.mood_distribution || {}).length > 0 ? (
                  <Box>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                      const count = statistics.mood_distribution[level.toString()] || 0;
                      const maxCount = Math.max(
                        ...Object.values(statistics.mood_distribution || {}),
                        1
                      );
                      const percentage = (count / maxCount) * 100;
                      return (
                        <Box key={level} mb={1}>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Typography variant="body2" sx={{ minWidth: 20, fontWeight: 'bold' }}>
                              {level}
                            </Typography>
                            <Box
                              sx={{
                                flexGrow: 1,
                                bgcolor: 'grey.200',
                                borderRadius: 1,
                                height: 28,
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  width: `${percentage}%`,
                                  height: '100%',
                                  bgcolor:
                                    level <= 3
                                      ? 'error.main'
                                      : level <= 5
                                        ? 'warning.main'
                                        : level <= 7
                                          ? 'info.main'
                                          : 'success.main',
                                  transition: 'width 0.3s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  px: 1,
                                }}
                              >
                                {count > 0 && (
                                  <Typography
                                    variant="body2"
                                    sx={{ color: 'white', fontWeight: 'bold' }}
                                  >
                                    {count} {count === 1 ? 'day' : 'days'}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No productivity data available
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <TrophyIcon color="warning" />
                  <Typography variant="h6">Most Productive Days</Typography>
                </Box>
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  <List>
                    {statistics.most_productive_days &&
                    statistics.most_productive_days.length > 0 ? (
                      statistics.most_productive_days.map((day, index) => (
                        <ListItem
                          key={index}
                          divider={index < statistics.most_productive_days.length - 1}
                        >
                          <ListItemText
                            primary={new Date(day.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                            secondary={`${day.items_completed} action items completed`}
                          />
                          <Chip
                            label={`#${index + 1}`}
                            color="primary"
                            size="small"
                            variant={index === 0 ? 'filled' : 'outlined'}
                          />
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText
                          primary="No productivity data available"
                          secondary="Start completing action items to see your most productive days"
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Daily Timeline
                </Typography>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {timeline.length > 0 ? (
                    <List dense>
                      {timeline.map((day, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={new Date(day.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            secondary={
                              <Box component="span" display="flex" gap={2}>
                                <span>⏰ {day.hours_worked}h</span>
                                <span>✅ {day.action_items_completed} completed</span>
                                <span>🔄 {day.action_items_worked_on} worked on</span>
                                {day.mood && <span>📊 Productivity: {day.mood}/10</span>}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" py={4}>
                      No timeline data available for selected date range
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default DiaryStatisticsContainer;
