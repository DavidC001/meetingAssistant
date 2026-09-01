import React from 'react';
import {
  Paper,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  People as PeopleIcon,
  Folder as FolderIcon,
  LocalOffer as TagIcon,
  Event as MeetingIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Refresh as RefreshIcon,
  Visibility as ShowIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from '@mui/icons-material';

/**
 * GraphToolbar — type filters + zoom/freeze action buttons.
 */
export const GraphToolbar = ({
  visibleTypes,
  onTypeToggle,
  showLabels,
  onShowLabelsChange,
  hiddenCount,
  onShowAllNodes,
  onZoomIn,
  onZoomOut,
  onCenter,
  onRefresh,
  isSimulationRunning,
  onStopSimulation,
  onResumeSimulation,
}) => (
  <Paper sx={{ p: 2, mb: 2 }}>
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <ToggleButtonGroup
        value={visibleTypes}
        onChange={onTypeToggle}
        size="small"
        sx={{ flexWrap: 'wrap', maxWidth: '100%' }}
      >
        <ToggleButton value="meeting">
          <MeetingIcon fontSize="small" />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>
            Meetings
          </Box>
        </ToggleButton>
        <ToggleButton value="person">
          <PeopleIcon fontSize="small" />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>
            People
          </Box>
        </ToggleButton>
        <ToggleButton value="folder">
          <FolderIcon fontSize="small" />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>
            Folders
          </Box>
        </ToggleButton>
        <ToggleButton value="tag">
          <TagIcon fontSize="small" />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>
            Tags
          </Box>
        </ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch checked={showLabels} onChange={(e) => onShowLabelsChange(e.target.checked)} />
          }
          label="Show Labels"
        />
        {hiddenCount > 0 && (
          <Tooltip title={`Show ${hiddenCount} hidden node(s)`}>
            <IconButton onClick={onShowAllNodes} size="small" color="warning">
              <ShowIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Zoom In">
          <IconButton onClick={onZoomIn} size="small">
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out">
          <IconButton onClick={onZoomOut} size="small">
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Center">
          <IconButton onClick={onCenter} size="small">
            <CenterIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Refresh">
          <IconButton onClick={onRefresh} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={isSimulationRunning ? 'Freeze Graph' : 'Unfreeze Graph'}>
          <IconButton
            onClick={isSimulationRunning ? onStopSimulation : onResumeSimulation}
            size="small"
            color={isSimulationRunning ? 'warning' : 'success'}
          >
            {isSimulationRunning ? <LockOpenIcon /> : <LockIcon />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  </Paper>
);

export default GraphToolbar;
