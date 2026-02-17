import apiClient from './apiClient';

const API_URL = '/api/v1/projects';

export const projectService = {
  // Projects CRUD
  listProjects: (status) => apiClient.get(`${API_URL}/`, { params: { status } }),
  createProject: (data) => apiClient.post(`${API_URL}/`, data),
  getProject: (id) => apiClient.get(`${API_URL}/${id}`),
  updateProject: (id, data) => apiClient.put(`${API_URL}/${id}`, data),
  deleteProject: (id, deleteMeetings) =>
    apiClient.delete(`${API_URL}/${id}`, { params: { delete_meetings: deleteMeetings } }),

  // Project Meetings
  getProjectMeetings: (id, params) => apiClient.get(`${API_URL}/${id}/meetings`, { params }),
  addMeetingToProject: (id, meetingId) => apiClient.post(`${API_URL}/${id}/meetings/${meetingId}`),
  removeMeetingFromProject: (id, meetingId) =>
    apiClient.delete(`${API_URL}/${id}/meetings/${meetingId}`),

  // Members
  getMembers: (id) => apiClient.get(`${API_URL}/${id}/members`),
  addMember: (id, data) => apiClient.post(`${API_URL}/${id}/members`, data),
  updateMember: (id, memberId, data) => apiClient.put(`${API_URL}/${id}/members/${memberId}`, data),
  removeMember: (id, memberId) => apiClient.delete(`${API_URL}/${id}/members/${memberId}`),
  syncMembers: (id) => apiClient.post(`${API_URL}/${id}/members/sync`),

  // Milestones
  getMilestones: (id) => apiClient.get(`${API_URL}/${id}/milestones`),
  createMilestone: (id, data) => apiClient.post(`${API_URL}/${id}/milestones`, data),
  updateMilestone: (id, milestoneId, data) =>
    apiClient.put(`${API_URL}/${id}/milestones/${milestoneId}`, data),
  completeMilestone: (id, milestoneId) =>
    apiClient.post(`${API_URL}/${id}/milestones/${milestoneId}/complete`),
  deleteMilestone: (id, milestoneId) =>
    apiClient.delete(`${API_URL}/${id}/milestones/${milestoneId}`),

  // Action Items
  getActionItems: (id, params) => apiClient.get(`${API_URL}/${id}/action-items`, { params }),
  createActionItem: (id, data) => apiClient.post(`${API_URL}/${id}/action-items`, data),

  // Gantt
  getGanttData: (id) => apiClient.get(`${API_URL}/${id}/gantt`),
  updateGanttItem: (projectId, itemId, data) =>
    apiClient.patch(`${API_URL}/${projectId}/gantt/items/${itemId}`, data),
  addGanttLink: (projectId, data) => apiClient.post(`${API_URL}/${projectId}/gantt/links`, data),
  deleteGanttLink: (projectId, linkId) =>
    apiClient.delete(`${API_URL}/${projectId}/gantt/links/${linkId}`),

  // Analytics
  getAnalytics: (id) => apiClient.get(`${API_URL}/${id}/analytics`),
  getActivity: (id, limit) => apiClient.get(`${API_URL}/${id}/activity`, { params: { limit } }),

  // Notes
  getNotes: (id) => apiClient.get(`${API_URL}/${id}/notes`),
  createNote: (id, data) => apiClient.post(`${API_URL}/${id}/notes`, data),
  updateNote: (id, noteId, data) => apiClient.put(`${API_URL}/${id}/notes/${noteId}`, data),
  deleteNote: (id, noteId) => apiClient.delete(`${API_URL}/${id}/notes/${noteId}`),
  getNoteAttachments: (projectId, noteId) =>
    apiClient.get(`${API_URL}/${projectId}/notes/${noteId}/attachments`),
  uploadNoteAttachment: (projectId, noteId, file, description) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }
    return apiClient.post(`${API_URL}/${projectId}/notes/${noteId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  downloadNoteAttachment: (attachmentId) =>
    apiClient.get(`${API_URL}/notes/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    }),
  previewNoteAttachment: (attachmentId) => `${API_URL}/notes/attachments/${attachmentId}/preview`,
  updateNoteAttachment: (attachmentId, description) =>
    apiClient.put(`${API_URL}/notes/attachments/${attachmentId}`, { description }),
  deleteNoteAttachment: (attachmentId) =>
    apiClient.delete(`${API_URL}/notes/attachments/${attachmentId}`),

  // Export
  exportProject: (id, format = 'pdf') =>
    apiClient.get(`${API_URL}/${id}/export`, { params: { format }, responseType: 'blob' }),
};
