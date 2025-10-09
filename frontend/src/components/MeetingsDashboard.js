import React, { useState } from 'react';
import { Box, Typography, Fade, Tabs, Tab } from '@mui/material';
import UploadForm from './UploadForm';
import MeetingsListImproved from './MeetingsListImproved';
import MultiMeetingChat from './MultiMeetingChat';

const MeetingsDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('meetings');

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
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            aria-label="Meeting dashboard tabs"
          >
            <Tab label="Meetings" value="meetings" />
            <Tab label="Cross-Meeting Chat" value="chat" />
          </Tabs>
        </Box>
        <Box
          role="tabpanel"
          hidden={activeTab !== 'meetings'}
          sx={{ display: activeTab === 'meetings' ? 'block' : 'none' }}
        >
          <UploadForm onUploadSuccess={handleMeetingsUpdate} />
          <Box sx={{ mt: 4 }}>
            <MeetingsListImproved
              refreshKey={refreshKey}
              onMeetingUpdate={handleMeetingsUpdate}
            />
          </Box>
        </Box>
        <Box
          role="tabpanel"
          hidden={activeTab !== 'chat'}
          sx={{ display: activeTab === 'chat' ? 'block' : 'none', mt: 4 }}
        >
          <MultiMeetingChat />
        </Box>
      </Box>
    </Fade>
  );
};

export default MeetingsDashboard;
