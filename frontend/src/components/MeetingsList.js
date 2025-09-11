import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './MeetingsList.css';

const MeetingsList = ({ refreshKey }) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/api/v1/meetings/');
        setMeetings(response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        setError(null);
      } catch (err) {
        setError('Failed to fetch meetings.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();

    // Set up polling to refresh meetings with 'pending' or 'processing' status
    const interval = setInterval(fetchMeetings, 5000); // Poll every 5 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [refreshKey]);

  if (isLoading && meetings.length === 0) {
    return <p>Loading meetings...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div className="meetings-list-container">
      <h2>All Meetings</h2>
      {meetings.length === 0 ? (
        <p>No meetings found. Upload one to get started!</p>
      ) : (
        <ul className="meetings-list">
          {meetings.map((meeting) => (
            <li key={meeting.id} className={`meeting-item status-${meeting.status}`}>
              <Link to={`/meetings/${meeting.id}`}>
                <span className="meeting-filename">{meeting.filename}</span>
                <span className="meeting-date">
                  {new Date(meeting.created_at).toLocaleString()}
                </span>
                <span className="meeting-status">{meeting.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MeetingsList;
