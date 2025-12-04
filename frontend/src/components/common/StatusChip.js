/**
 * StatusChip Component
 * 
 * Displays status with appropriate color and icon.
 */

import React from 'react';
import { Chip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  Sync as ProcessingIcon,
  Error as ErrorIcon,
  Help as UnknownIcon
} from '@mui/icons-material';
import { MEETING_STATUS } from '../../constants';

const statusConfig = {
  [MEETING_STATUS.COMPLETED]: {
    color: 'success',
    icon: CheckCircleIcon,
    label: 'Completed',
  },
  [MEETING_STATUS.PROCESSING]: {
    color: 'info',
    icon: ProcessingIcon,
    label: 'Processing',
  },
  [MEETING_STATUS.PENDING]: {
    color: 'warning',
    icon: PendingIcon,
    label: 'Pending',
  },
  [MEETING_STATUS.FAILED]: {
    color: 'error',
    icon: ErrorIcon,
    label: 'Failed',
  },
};

const StatusChip = ({ 
  status, 
  size = 'small',
  showIcon = true,
  customLabel = null,
  ...props 
}) => {
  const config = statusConfig[status] || {
    color: 'default',
    icon: UnknownIcon,
    label: status || 'Unknown',
  };
  
  const Icon = config.icon;
  
  return (
    <Chip
      size={size}
      color={config.color}
      label={customLabel || config.label}
      icon={showIcon ? <Icon fontSize="small" /> : undefined}
      {...props}
    />
  );
};

export default StatusChip;
