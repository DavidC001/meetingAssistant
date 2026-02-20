/**
 * kanbanConfig.js
 * Shared configuration for kanban board (colors, icons, etc)
 */

import {
  HourglassEmpty as PendingIcon,
  PlayCircleOutline as InProgressIcon,
  CheckCircleOutline as CompletedIcon,
} from '@mui/icons-material';

export const getPriorityConfig = (isDarkMode) => ({
  high: {
    color: isDarkMode ? '#ff8a80' : '#d32f2f',
    bgColor: isDarkMode ? 'rgba(211, 47, 47, 0.2)' : 'rgba(211, 47, 47, 0.1)',
    label: 'High',
  },
  medium: {
    color: isDarkMode ? '#ffb74d' : '#ed6c02',
    bgColor: isDarkMode ? 'rgba(237, 108, 2, 0.2)' : 'rgba(237, 108, 2, 0.1)',
    label: 'Medium',
  },
  low: {
    color: isDarkMode ? '#81c784' : '#2e7d32',
    bgColor: isDarkMode ? 'rgba(46, 125, 50, 0.2)' : 'rgba(46, 125, 50, 0.1)',
    label: 'Low',
  },
  none: {
    color: isDarkMode ? '#b0b0b0' : '#757575',
    bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : 'rgba(117, 117, 117, 0.1)',
    label: 'No Priority',
  },
});

export const getColumnConfig = (isDarkMode) => ({
  pending: {
    label: 'Pending',
    icon: PendingIcon,
    gradient: isDarkMode
      ? 'linear-gradient(135deg, #5c6bc0 0%, #7e57c2 100%)'
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    headerBg: isDarkMode ? 'rgba(92, 107, 192, 0.9)' : 'rgba(102, 126, 234, 0.9)',
  },
  'in-progress': {
    label: 'In Progress',
    icon: InProgressIcon,
    gradient: isDarkMode
      ? 'linear-gradient(135deg, #ec407a 0%, #f44336 100%)'
      : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    headerBg: isDarkMode ? 'rgba(236, 64, 122, 0.9)' : 'rgba(240, 147, 251, 0.9)',
  },
  completed: {
    label: 'Completed',
    icon: CompletedIcon,
    gradient: isDarkMode
      ? 'linear-gradient(135deg, #26c6da 0%, #00acc1 100%)'
      : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    headerBg: isDarkMode ? 'rgba(38, 198, 218, 0.9)' : 'rgba(79, 172, 254, 0.9)',
  },
});
