import axios from 'axios';

// The Nginx reverse proxy is set up to forward requests starting with /api
// to the backend service. So we can use a relative URL here.
const client = axios.create({
  baseURL: '/',
});

const api = {
  get: (url, config) => client.get(url, config),
  post: (url, data, config) => client.post(url, data, config),
  put: (url, data, config) => client.put(url, data, config),
  delete: (url, config) => client.delete(url, config),

  renameMeeting: (meetingId, newName) => {
    return client.put(`/api/v1/meetings/${meetingId}`, { filename: newName });
  },

  deleteMeeting: (meetingId) => {
    return client.delete(`/api/v1/meetings/${meetingId}`);
  },
  // Speaker API
  addSpeaker: (meetingId, speaker) => client.post(`/api/v1/meetings/${meetingId}/speakers`, speaker),
  getSpeakers: (meetingId) => client.get(`/api/v1/meetings/${meetingId}/speakers`),
  updateSpeaker: (speakerId, speaker) => client.put(`/api/v1/meetings/speakers/${speakerId}`, speaker),
  deleteSpeaker: (speakerId) => client.delete(`/api/v1/meetings/speakers/${speakerId}`),

  // Action Item API
  addActionItem: (transcriptionId, actionItem) => client.post(`/api/v1/meetings/transcriptions/${transcriptionId}/action-items`, actionItem),
  updateActionItem: (itemId, actionItem) => client.put(`/api/v1/meetings/action-items/${itemId}`, actionItem),
  deleteActionItem: (itemId) => client.delete(`/api/v1/meetings/action-items/${itemId}`),

  // Tags/Folder API
  updateMeetingTagsFolder: (meetingId, tags, folder) => {
    return client.put(`/api/v1/meetings/${meetingId}/tags-folder`, { tags, folder });
  },

  // Download API
  downloadMeeting: (meetingId, format) => {
    return client.get(`/api/v1/meetings/${meetingId}/download/${format}`, {
      responseType: 'blob' // Important for downloading files
    });
  },
};


export default api;
