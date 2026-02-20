import React from 'react';
import { Box, Card, CardContent, Chip, IconButton, Typography, Avatar } from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Flag as FlagIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

const ActionItemCard = ({
  task,
  isMyTask,
  isDarkMode,
  allowEdit,
  allowDelete,
  priorityConfig,
  onMenuOpen,
  formatDate,
  isDragging,
}) => {
  const priority = task.priority || 'none';
  const config = priorityConfig[priority] || priorityConfig.none;

  return (
    <Card
      elevation={isDragging ? 8 : isMyTask ? 2 : 1}
      sx={{
        mb: 1.5,
        cursor: 'grab',
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: isDragging ? 'primary.main' : 'transparent',
        bgcolor: isMyTask ? 'rgba(33, 150, 243, 0.04)' : 'background.paper',
        transform: isDragging ? 'rotate(3deg) scale(1.02)' : 'none',
        transition: isDragging ? 'none' : 'all 0.2s ease',
        boxShadow: isMyTask
          ? 'inset 0 0 0 2px rgba(33, 150, 243, 0.25), 0 2px 8px rgba(33, 150, 243, 0.15)'
          : undefined,
        '&:hover': {
          boxShadow: isMyTask
            ? 'inset 0 0 0 2px rgba(33, 150, 243, 0.4), 0 4px 12px rgba(33, 150, 243, 0.2)'
            : 4,
          borderColor: 'primary.light',
          transform: 'translateY(-2px)',
        },
        '&:active': {
          cursor: 'grabbing',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 1.5,
          }}
        >
          <Chip
            icon={<FlagIcon sx={{ fontSize: '14px !important' }} />}
            label={config.label}
            size="small"
            sx={{
              bgcolor: config.bgColor,
              color: config.color,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              '& .MuiChip-icon': {
                color: config.color,
              },
            }}
          />
          {(allowEdit || allowDelete) && (
            <IconButton
              size="small"
              onClick={(e) => onMenuOpen(e, task)}
              sx={{
                mt: -0.5,
                mr: -0.5,
                opacity: 0.6,
                '&:hover': { opacity: 1 },
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        <Typography
          variant="body2"
          sx={{
            mb: 2,
            fontWeight: 500,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: 'text.primary',
          }}
        >
          {task.task}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {task.owner && (
            <Chip
              avatar={
                <Avatar
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: '0.7rem',
                    bgcolor: 'primary.main',
                  }}
                >
                  {task.owner[0]?.toUpperCase()}
                </Avatar>
              }
              label={task.owner}
              size="small"
              sx={{
                height: 26,
                bgcolor: isDarkMode ? 'grey.800' : 'grey.100',
                color: isDarkMode ? 'grey.100' : 'text.primary',
                '& .MuiChip-label': { fontSize: '0.75rem' },
              }}
            />
          )}
          {task.due_date &&
            (() => {
              const { text, isOverdue, isToday } = formatDate(task.due_date);
              return (
                <Chip
                  icon={<CalendarIcon sx={{ fontSize: '14px !important' }} />}
                  label={isToday ? 'Today' : text}
                  size="small"
                  sx={{
                    height: 26,
                    bgcolor: isOverdue
                      ? isDarkMode
                        ? 'rgba(211, 47, 47, 0.2)'
                        : '#ffebee'
                      : isToday
                        ? isDarkMode
                          ? 'rgba(25, 118, 210, 0.2)'
                          : '#e3f2fd'
                        : isDarkMode
                          ? 'grey.800'
                          : 'grey.100',
                    color: isOverdue
                      ? isDarkMode
                        ? '#ff8a80'
                        : '#d32f2f'
                      : isToday
                        ? isDarkMode
                          ? '#64b5f6'
                          : '#1976d2'
                        : 'text.secondary',
                    '& .MuiChip-icon': {
                      color: isOverdue
                        ? isDarkMode
                          ? '#ff8a80'
                          : '#d32f2f'
                        : isToday
                          ? isDarkMode
                            ? '#64b5f6'
                            : '#1976d2'
                          : 'text.secondary',
                    },
                    '& .MuiChip-label': { fontSize: '0.75rem' },
                  }}
                />
              );
            })()}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ActionItemCard;
