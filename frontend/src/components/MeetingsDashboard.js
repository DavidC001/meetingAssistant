import React, { useState } from 'react';
import UploadForm from './UploadForm';
import MeetingsList from './MeetingsList';

const MeetingsDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMeetingsUpdate = () => {
    // Increment the key to force a re-render and re-fetch in MeetingsList
    setRefreshKey(prevKey => prevKey + 1);
  };

  return (
    <div>
      <UploadForm onUploadSuccess={handleMeetingsUpdate} />
      <MeetingsList refreshKey={refreshKey} onMeetingUpdate={handleMeetingsUpdate} />
    </div>
  );
};

export default MeetingsDashboard;
