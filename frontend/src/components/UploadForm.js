import React, { useState } from 'react';
import api from '../api';
import './UploadForm.css';

const UploadForm = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setMessage('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setMessage('Uploading and processing... This may take a moment.');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/api/v1/meetings/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage('File uploaded successfully! The meeting is now being processed.');
      setFile(null); // Reset file input
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage('Error uploading file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-form-container">
      <h2>Upload New Meeting</h2>
      <form onSubmit={handleSubmit}>
        <input type="file" onChange={handleFileChange} disabled={isUploading} />
        <button type="submit" disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {message && <p className="upload-message">{message}</p>}
    </div>
  );
};

export default UploadForm;
