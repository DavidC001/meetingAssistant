import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

const NODE_TYPES = [
  { color: '#1976d2', label: 'Meeting' },
  { color: '#f50057', label: 'Person' },
  { color: '#ff9800', label: 'Folder' },
  { color: '#4caf50', label: 'Tag' },
];

/**
 * GraphLegend — static legend strip shown below the graph.
 */
export const GraphLegend = () => (
  <Paper sx={{ p: 2, mt: 2 }}>
    <Typography variant="body2" color="text.secondary">
      <strong>Legend:</strong>
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
      {NODE_TYPES.map(({ color, label }) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: color, mr: 1 }} />
          <Typography variant="body2">{label}</Typography>
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
        <Box sx={{ width: 24, height: 2, bgcolor: '#999', mr: 1 }} />
        <Typography variant="body2">Relationship</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: 24, height: 2, borderTop: '2px dashed #999', mr: 1 }} />
        <Typography variant="body2">Meeting Reference</Typography>
      </Box>
    </Box>
  </Paper>
);

export default GraphLegend;
