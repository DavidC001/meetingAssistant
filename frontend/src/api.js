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
};


export default api;
