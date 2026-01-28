/**
 * ViewModeToggle Component
 *
 * Toggle buttons for switching between different view modes (grid, list, table).
 */

import React from 'react';
import { ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import {
  GridView as GridIcon,
  ViewList as ListIcon,
  TableRows as TableIcon,
} from '@mui/icons-material';

const ViewModeToggle = ({
  value = 'grid',
  onChange,
  availableModes = ['grid', 'list', 'table'],
}) => {
  const modes = {
    grid: { icon: <GridIcon />, label: 'Grid View' },
    list: { icon: <ListIcon />, label: 'List View' },
    table: { icon: <TableIcon />, label: 'Table View' },
  };

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(e, newValue) => {
        if (newValue !== null) {
          onChange(newValue);
        }
      }}
      size="small"
      aria-label="view mode"
    >
      {availableModes.map((mode) => (
        <ToggleButton key={mode} value={mode} aria-label={modes[mode].label}>
          <Tooltip title={modes[mode].label}>{modes[mode].icon}</Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

export default ViewModeToggle;
