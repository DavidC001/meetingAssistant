/**
 * Attachment Service - Handles file attachment operations.
 */

import apiClient, { downloadBlob } from './apiClient';

const BASE_URL = '/api/v1/meetings';

const AttachmentService = {
  /**
   * Get all attachments for a meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Array>} List of attachments
   */
  async getForMeeting(meetingId) {
    const response = await apiClient.get(`${BASE_URL}/${meetingId}/attachments`);
    return response.data;
  },

  /**
   * Upload an attachment to a meeting.
   * @param {number} meetingId - Meeting ID
   * @param {File} file - File to upload
   * @param {string} description - Optional description
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Created attachment
   */
  async upload(meetingId, file, description = '', onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    const config = {
      headers: { 'Content-Type': 'multipart/form-data' },
    };

    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      };
    }

    const response = await apiClient.post(`${BASE_URL}/${meetingId}/attachments`, formData, config);
    return response.data;
  },

  /**
   * Update attachment description.
   * @param {number} attachmentId - Attachment ID
   * @param {string} description - New description
   * @returns {Promise<Object>} Updated attachment
   */
  async update(attachmentId, description) {
    const response = await apiClient.put(`${BASE_URL}/attachments/${attachmentId}`, {
      description,
    });
    return response.data;
  },

  /**
   * Delete an attachment.
   * @param {number} attachmentId - Attachment ID
   * @returns {Promise<void>}
   */
  async delete(attachmentId) {
    await apiClient.delete(`${BASE_URL}/attachments/${attachmentId}`);
  },

  /**
   * Download an attachment.
   * @param {number} attachmentId - Attachment ID
   * @param {string} filename - Optional filename
   */
  async download(attachmentId, filename = 'attachment') {
    const response = await apiClient.get(`${BASE_URL}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    downloadBlob(response.data, filename);
  },

  /**
   * Get preview URL for an attachment.
   * @param {number} attachmentId - Attachment ID
   * @returns {string} Preview URL
   */
  getPreviewUrl(attachmentId) {
    return `${BASE_URL}/attachments/${attachmentId}/preview`;
  },
};

export default AttachmentService;
