/**
 * Status-related utility functions
 * Centralized status color and label mapping
 */

import { MEETING_STATUS } from '../constants';

/**
 * Get meeting status color
 * @param {string} status - Meeting status
 * @returns {string} Material-UI color
 */
export const getStatusColor = (status) => {
  switch (status) {
    case MEETING_STATUS.COMPLETED:
      return 'success';
    case MEETING_STATUS.PROCESSING:
      return 'info';
    case MEETING_STATUS.PENDING:
      return 'warning';
    case MEETING_STATUS.FAILED:
      return 'error';
    default:
      return 'default';
  }
};

/**
 * Get meeting status label
 * @param {string} status - Meeting status
 * @returns {string} Human-readable status label
 */
export const getStatusLabel = (status) => {
  switch (status) {
    case MEETING_STATUS.COMPLETED:
      return 'Completed';
    case MEETING_STATUS.PROCESSING:
      return 'Processing';
    case MEETING_STATUS.PENDING:
      return 'Pending';
    case MEETING_STATUS.FAILED:
      return 'Failed';
    default:
      return 'Unknown';
  }
};

/**
 * Get status color for project (active, on_hold, completed, archived)
 * @param {string} status - Project status
 * @returns {string} Material-UI color
 */
export const getProjectStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'on_hold':
      return 'warning';
    case 'completed':
      return 'info';
    case 'archived':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Get status color for action item/milestone
 * @param {string} status - Action item status
 * @param {boolean} overdue - Whether the item is overdue
 * @returns {string} Material-UI color
 */
export const getActionItemStatusColor = (status, overdue) => {
  if (status === 'completed') return 'success';
  if (overdue) return 'error';
  if (status === 'missed') return 'error';
  return 'default';
};

/**
 * Get omnibus status color for system/health status
 * @param {string} status - System status
 * @returns {string} Material-UI color
 */
export const getSystemStatusColor = (status) => {
  switch (status) {
    case 'operational':
    case 'healthy':
    case 'running':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'offline':
    case 'unhealthy':
    case 'stopped':
    case 'error':
      return 'error';
    default:
      return 'warning';
  }
};
