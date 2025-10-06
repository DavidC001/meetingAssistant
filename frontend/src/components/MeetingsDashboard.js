import React, { useState } from 'react';
import { Box, Typography, Fade } from '@mui/material';
import UploadForm from './UploadForm';
import MeetingsListImproved from './MeetingsListImproved';

const MeetingsDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMeetingsUpdate = () => {
    // Increment the key to force a re-render and re-fetch in MeetingsList
    setRefreshKey(prevKey => prevKey + 1);
  };

  return (
    <Fade in timeout={500}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Meeting Dashboard
        </Typography>
        <UploadForm onUploadSuccess={handleMeetingsUpdate} />
        <MeetingsListImproved refreshKey={refreshKey} onMeetingUpdate={handleMeetingsUpdate} />
      </Box>
    </Fade>
  );
};

export default MeetingsDashboard;
