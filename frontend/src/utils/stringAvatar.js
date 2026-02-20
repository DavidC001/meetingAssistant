/**
 * String Avatar Utility
 * Creates Avatar props (sx, children) from a name string
 */

/**
 * Generate avatar styling based on name string
 * @param {string} name - Full name or display name
 * @returns {Object} Object with sx and children props for MUI Avatar
 */
export function stringAvatar(name) {
  if (!name) {
    return {
      sx: {
        bgcolor: '#bdbdbd',
      },
      children: '?',
    };
  }

  // Get first letters from name
  const parts = name.trim().split(' ');
  let initials = '';

  if (parts.length === 1) {
    initials = parts[0].charAt(0).toUpperCase();
  } else {
    initials = (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // Generate deterministic color from name
  const hash = name.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0);
  const colors = [
    '#f44336', // red
    '#2196f3', // blue
    '#4caf50', // green
    '#ff9800', // orange
    '#9c27b0', // purple
    '#00bcd4', // cyan
    '#e91e63', // pink
    '#3f51b5', // indigo
    '#009688', // teal
    '#ff5722', // deep orange
  ];

  const color = colors[Math.abs(hash) % colors.length];

  return {
    sx: {
      bgcolor: color,
      color: '#fff',
      fontWeight: 'bold',
    },
    children: initials,
  };
}

export default stringAvatar;
