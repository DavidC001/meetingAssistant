import React, { useState } from 'react';
import api from '../api';
import './UploadForm.css';

const UploadForm = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setMessage('');
    setUploadProgress(0);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setMessage('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setMessage('Uploading and processing... This may take a moment.');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/api/v1/meetings/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });
      setMessage('File uploaded successfully! The meeting is now being processed.');
      setFile(null); // Reset file input
      setUploadProgress(100);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage('Error uploading file. Please try again.');
      setUploadProgress(0);
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
          {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload'}
        </button>
      </form>
      
      {isUploading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <span className="progress-text">{uploadProgress}%</span>
        </div>
      )}
      
      {message && <p className="upload-message">{message}</p>}
    </div>
  );
};

export default UploadForm;
