/**
 * Priority-related utility functions
 * Centralized priority color, config, and label mapping
 */

/**
 * Get priority configuration with colors and labels
 * @param {boolean} isDarkMode - Whether dark mode is enabled
 * @returns {object} Priority configuration object
 */
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

/**
 * Get priority color
 * @param {string} priority - Priority level (high, medium, low, none)
 * @param {boolean} isDarkMode - Whether dark mode is enabled
 * @returns {string} Hex color for the priority
 */
export const getPriorityColor = (priority, isDarkMode = false) => {
  const config = getPriorityConfig(isDarkMode);
  return config[priority]?.color || config.none.color;
};

/**
 * Get priority background color
 * @param {string} priority - Priority level (high, medium, low, none)
 * @param {boolean} isDarkMode - Whether dark mode is enabled
 * @returns {string} RGBA color for the priority background
 */
export const getPriorityBgColor = (priority, isDarkMode = false) => {
  const config = getPriorityConfig(isDarkMode);
  return config[priority]?.bgColor || config.none.bgColor;
};

/**
 * Get priority label
 * @param {string} priority - Priority level (high, medium, low, none)
 * @returns {string} Human-readable priority label
 */
export const getPriorityLabel = (priority) => {
  const config = getPriorityConfig(false);
  return config[priority]?.label || 'No Priority';
};

/**
 * Sort priorities from high to low
 * @param {string[]} priorities - List of priorities to sort
 * @returns {string[]} Sorted priorities
 */
export const sortPriorities = (priorities) => {
  const order = { high: 0, medium: 1, low: 2, none: 3 };
  return priorities.sort((a, b) => (order[a] || 999) - (order[b] || 999));
};
