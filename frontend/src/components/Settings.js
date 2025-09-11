import React, { useState, useEffect } from 'react';
import api from '../api';
import './Settings.css';

const Settings = () => {
  const [tokens, setTokens] = useState({
    huggingface_token: '',
    openai_api_key: ''
  });
  const [status, setStatus] = useState({
    huggingface_configured: false,
    openai_configured: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showTokens, setShowTokens] = useState({
    huggingface_token: false,
    openai_api_key: false
  });

  useEffect(() => {
    fetchTokenStatus();
  }, []);

  const fetchTokenStatus = async () => {
    try {
      const response = await api.get('/api/v1/settings/api-tokens');
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching token status:', error);
      setMessage('Error fetching token status');
    }
  };

  const handleInputChange = (field, value) => {
    setTokens(prev => ({
      ...prev,
      [field]: value
    }));
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await api.post('/api/v1/settings/api-tokens', tokens);
      setMessage(response.data.message);
      await fetchTokenStatus();
      // Clear form after successful update
      setTokens({
        huggingface_token: '',
        openai_api_key: ''
      });
    } catch (error) {
      console.error('Error updating tokens:', error);
      setMessage('Error updating API tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleClearTokens = async () => {
    if (!window.confirm('Are you sure you want to clear all API tokens?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.delete('/api/v1/settings/api-tokens');
      setMessage(response.data.message);
      await fetchTokenStatus();
    } catch (error) {
      console.error('Error clearing tokens:', error);
      setMessage('Error clearing API tokens');
    } finally {
      setLoading(false);
    }
  };

  const toggleShowToken = (field) => {
    setShowTokens(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div className="settings-container">
      <h2>API Settings</h2>
      
      <div className="current-status">
        <h3>Current Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Hugging Face Token:</span>
            <span className={`status-indicator ${status.huggingface_configured ? 'configured' : 'not-configured'}`}>
              {status.huggingface_configured ? '✓ Configured' : '✗ Not Configured'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">OpenAI API Key:</span>
            <span className={`status-indicator ${status.openai_configured ? 'configured' : 'not-configured'}`}>
              {status.openai_configured ? '✓ Configured' : '✗ Not Configured'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <h3>Update API Tokens</h3>
        
        <div className="form-group">
          <label htmlFor="huggingface_token">
            Hugging Face Token
            <span className="help-text">Required for speaker diarization</span>
          </label>
          <div className="input-with-toggle">
            <input
              type={showTokens.huggingface_token ? "text" : "password"}
              id="huggingface_token"
              value={tokens.huggingface_token}
              onChange={(e) => handleInputChange('huggingface_token', e.target.value)}
              placeholder="Enter your Hugging Face token"
              disabled={loading}
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => toggleShowToken('huggingface_token')}
            >
              {showTokens.huggingface_token ? '🙈' : '👁️'}
            </button>
          </div>
          <small className="form-help">
            Get your token from <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer">Hugging Face Settings</a>
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="openai_api_key">
            OpenAI API Key
            <span className="help-text">Required for transcript analysis</span>
          </label>
          <div className="input-with-toggle">
            <input
              type={showTokens.openai_api_key ? "text" : "password"}
              id="openai_api_key"
              value={tokens.openai_api_key}
              onChange={(e) => handleInputChange('openai_api_key', e.target.value)}
              placeholder="Enter your OpenAI API key"
              disabled={loading}
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => toggleShowToken('openai_api_key')}
            >
              {showTokens.openai_api_key ? '🙈' : '👁️'}
            </button>
          </div>
          <small className="form-help">
            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a>
          </small>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="save-button">
            {loading ? 'Saving...' : 'Save Tokens'}
          </button>
          <button 
            type="button" 
            onClick={handleClearTokens} 
            disabled={loading}
            className="clear-button"
          >
            Clear All Tokens
          </button>
        </div>
      </form>

      {message && <p className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</p>}

      <div className="security-notice">
        <h4>💾 Persistence Notice</h4>
        <p>
          API tokens are now saved to the backend `.env` file for persistence across application restarts.
          This means your tokens will be remembered when the application is restarted.
          Never share your API tokens with others and keep your `.env` file secure.
        </p>
      </div>
    </div>
  );
};

export default Settings;
