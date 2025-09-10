import React, { useState } from 'react';
import UploadForm from './UploadForm';
import MeetingsList from './MeetingsList';

const MeetingsDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    // Increment the key to force a re-render and re-fetch in MeetingsList
    setRefreshKey(prevKey => prevKey + 1);
  };

  return (
    <div>
      <UploadForm onUploadSuccess={handleUploadSuccess} />
      <MeetingsList refreshKey={refreshKey} />
    </div>
  );
};

export default MeetingsDashboard;
