import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './MeetingsList.css';

const MeetingsList = ({ refreshKey, onMeetingUpdate }) => {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null); // ID of the meeting whose menu is open
  const menuRef = useRef(null);

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

  useEffect(() => {
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 5000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  // Handle clicks outside of the menu to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const handleRename = async (meetingId, currentName) => {
    const newName = prompt("Enter new name for the meeting:", currentName);
    if (newName && newName.trim() && newName !== currentName) {
      try {
        await api.renameMeeting(meetingId, newName.trim());
        onMeetingUpdate(); // This will trigger a refresh
      } catch (err) {
        setError('Failed to rename meeting.');
        console.error(err);
      } finally {
        setMenuOpen(null);
      }
    }
  };

  const handleDelete = async (meetingId) => {
    if (window.confirm("Are you sure you want to delete this meeting? This action cannot be undone.")) {
      try {
        await api.deleteMeeting(meetingId);
        onMeetingUpdate(); // This will trigger a refresh
      } catch (err) {
        setError('Failed to delete meeting.');
        console.error(err);
      } finally {
        setMenuOpen(null);
      }
    }
  };

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
              <Link to={`/meetings/${meeting.id}`} className="meeting-link">
                <span className="meeting-filename">{meeting.filename}</span>
                <span className="meeting-date">
                  {new Date(meeting.created_at).toLocaleString()}
                </span>
                <span className="meeting-status">{meeting.status}</span>
              </Link>
              <div className="meeting-actions">
                <button onClick={() => setMenuOpen(menuOpen === meeting.id ? null : meeting.id)} className="menu-button">
                  &#x22EE; {/* Vertical ellipsis */}
                </button>
                {menuOpen === meeting.id && (
                  <div className="action-menu" ref={menuRef}>
                    <button onClick={() => handleRename(meeting.id, meeting.filename)}>Rename</button>
                    <button onClick={() => handleDelete(meeting.id)}>Delete</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MeetingsList;
