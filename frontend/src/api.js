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
  getAllTags: () => client.get('/api/v1/meetings/tags/all'),

  // Notes API
  updateMeetingNotes: (meetingId, notes) => {
    return client.put(`/api/v1/meetings/${meetingId}/notes`, { notes });
  },

  // Download API
  downloadMeeting: (meetingId, format) => {
    return client.get(`/api/v1/meetings/${meetingId}/download/${format}`, {
      responseType: 'blob' // Important for downloading files
    });
  },

  // Attachment API
  uploadAttachment: (meetingId, file, description) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }
    return client.post(`/api/v1/meetings/${meetingId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  getMeetingAttachments: (meetingId) => {
    return client.get(`/api/v1/meetings/${meetingId}/attachments`);
  },
  downloadAttachment: (attachmentId) => {
    return client.get(`/api/v1/meetings/attachments/${attachmentId}/download`, {
      responseType: 'blob'
    });
  },
  previewAttachment: (attachmentId) => {
    // Returns the URL for previewing in browser (opens in new tab)
    return `/api/v1/meetings/attachments/${attachmentId}/preview`;
  },
  updateAttachment: (attachmentId, description) => {
    return client.put(`/api/v1/meetings/attachments/${attachmentId}`, { description });
  },
  deleteAttachment: (attachmentId) => {
    return client.delete(`/api/v1/meetings/attachments/${attachmentId}`);
  },

  // Global chat API
  globalChat: {
    listSessions: () => client.get('/api/v1/global-chat/sessions'),
    createSession: (title, tags, filterFolder, filterTags) => client.post('/api/v1/global-chat/sessions', { 
      title, 
      tags,
      filter_folder: filterFolder,
      filter_tags: filterTags
    }),
    getSession: (sessionId) => client.get(`/api/v1/global-chat/sessions/${sessionId}`),
    deleteSession: (sessionId) => client.delete(`/api/v1/global-chat/sessions/${sessionId}`),
    updateSession: (sessionId, title, tags, filterFolder, filterTags) => client.put(`/api/v1/global-chat/sessions/${sessionId}`, { 
      title, 
      tags,
      filter_folder: filterFolder,
      filter_tags: filterTags
    }),
    sendMessage: (sessionId, message, chatHistory, topK) => client.post(
      `/api/v1/global-chat/sessions/${sessionId}/messages`,
      { message, chat_history: chatHistory, top_k: topK }
    ),
    getAvailableFolders: () => client.get('/api/v1/global-chat/filters/folders'),
    getAvailableFilterTags: () => client.get('/api/v1/global-chat/filters/tags'),
  },

  // Embedding & worker settings
  embeddingSettings: {
    getConfig: () => client.get('/api/v1/settings/embedding-config'),
    validateModel: (provider, modelName) =>
      client.get('/api/v1/settings/embedding-config/validate-model', {
        params: { provider, model_name: modelName },
      }),
    createConfig: (payload) => client.post('/api/v1/settings/embedding-config', payload),
    updateConfig: (configId, payload) => client.put(`/api/v1/settings/embedding-config/${configId}`, payload),
    activateConfig: (configId) => client.post(`/api/v1/settings/embedding-config/${configId}/activate`),
    deleteConfig: (configId) => client.delete(`/api/v1/settings/embedding-config/${configId}`),
    recomputeAll: () => client.post('/api/v1/settings/embedding-config/recompute'),
    recomputeMeeting: (meetingId) => client.post(`/api/v1/settings/embedding-config/${meetingId}/recompute`),
  },
  workerSettings: {
    get: () => client.get('/api/v1/settings/worker-scaling'),
    update: (maxWorkers) => client.put('/api/v1/settings/worker-scaling', { max_workers: maxWorkers }),
  }
};


export default api;
