import React from 'react';
import { Box, Grid, TextField, Typography } from '@mui/material';

/**
 * Time tracking fields: arrival time, departure time, hours worked.
 */
const DiaryTimeTracking = ({
  arrivalTime,
  onArrivalChange,
  departureTime,
  onDepartureChange,
  hoursWorked,
  onHoursChange,
  onBlurCalculate,
}) => (
  <Box mb={3}>
    <Typography variant="subtitle1" gutterBottom>
      ⏰ Time Tracking
    </Typography>
    <Grid container spacing={2}>
      <Grid item xs={12} sm={3}>
        <TextField
          fullWidth
          size="small"
          type="time"
          label="Arrival Time"
          value={arrivalTime}
          onChange={(e) => onArrivalChange(e.target.value)}
          onBlur={onBlurCalculate}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid item xs={12} sm={3}>
        <TextField
          fullWidth
          size="small"
          type="time"
          label="Departure Time"
          value={departureTime}
          onChange={(e) => onDepartureChange(e.target.value)}
          onBlur={onBlurCalculate}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid item xs={12} sm={3}>
        <TextField
          fullWidth
          size="small"
          type="number"
          label="Hours Worked"
          value={hoursWorked}
          onChange={(e) => onHoursChange(e.target.value)}
          InputProps={{ inputProps: { min: 0, max: 24, step: 0.25 } }}
        />
      </Grid>
    </Grid>
  </Box>
);

export default DiaryTimeTracking;
