import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import './MeetingDetails.css';

const MeetingDetails = () => {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/api/v1/meetings/${meetingId}`);
        setMeeting(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch meeting details.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetingDetails();

    // Poll for updates if the meeting is still processing
    const interval = setInterval(() => {
        if (meeting && (meeting.status === 'pending' || meeting.status === 'processing')) {
            fetchMeetingDetails();
        }
    }, 5000);

    return () => clearInterval(interval);

  }, [meetingId, meeting]);

  if (isLoading) {
    return <p>Loading meeting details...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!meeting) {
    return <p>No meeting data found.</p>;
  }

  return (
    <div className="meeting-details-container">
      <div className="details-header">
        <h2>{meeting.filename}</h2>
        <span className={`status-badge status-${meeting.status}`}>{meeting.status}</span>
      </div>
      <p><strong>Uploaded on:</strong> {new Date(meeting.created_at).toLocaleString()}</p>

      {meeting.status === 'completed' && meeting.transcription ? (
        <div className="details-content">
          <div className="content-section">
            <h3>Summary</h3>
            <div className="summary-box">
                {meeting.transcription.summary.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                ))}
            </div>
          </div>

          <div className="content-section">
            <h3>Action Items</h3>
            {meeting.transcription.action_items.length > 0 ? (
              <ul className="action-items-list">
                {meeting.transcription.action_items.map((item) => (
                  <li key={item.id}>
                    <p><strong>Task:</strong> {item.task}</p>
                    <p><strong>Owner:</strong> {item.owner || 'Unassigned'}</p>
                    <p><strong>Due:</strong> {item.due_date || 'N/A'}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No action items identified.</p>
            )}
          </div>

          <div className="content-section">
            <h3>Full Transcript</h3>
            <div className="transcript-box">
                {meeting.transcription.full_text.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="processing-notice">
          <p>This meeting is currently being processed. The results will appear here once it's complete.</p>
        </div>
      )}
    </div>
  );
};

export default MeetingDetails;
