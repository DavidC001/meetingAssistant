/**
 * Meeting Service - Handles all meeting-related API operations.
 *
 * This service encapsulates:
 * - Meeting CRUD operations
 * - File upload with progress tracking
 * - Meeting processing and status management
 * - Export functionality
 */

import apiClient, { buildQueryString, downloadBlob } from './apiClient';

const BASE_URL = '/api/v1/meetings';

/**
 * Meeting Service
 */
const MeetingService = {
  /**
   * Fetch all meetings with optional pagination.
   * @param {Object} options - Query options
   * @param {number} options.skip - Number of items to skip
   * @param {number} options.limit - Maximum items to return
   * @returns {Promise<Array>} List of meetings
   */
  async getAll({ skip = 0, limit = 100 } = {}) {
    const query = buildQueryString({ skip, limit });
    const response = await apiClient.get(`${BASE_URL}/${query}`);
    return response.data;
  },

  /**
   * Fetch a single meeting by ID.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Object>} Meeting details
   */
  async getById(meetingId) {
    const response = await apiClient.get(`${BASE_URL}/${meetingId}`);
    return response.data;
  },

  /**
   * Upload a new meeting file.
   * @param {File} file - The file to upload
   * @param {Object} options - Upload options
   * @param {string} options.transcriptionLanguage - Language code
   * @param {string} options.numberOfSpeakers - Number of speakers or 'auto'
   * @param {string} options.meetingDate - ISO date string
   * @param {Function} options.onProgress - Progress callback (0-100)
   * @returns {Promise<Object>} Created meeting
   */
  async upload(file, options = {}) {
    const {
      transcriptionLanguage = 'en-US',
      numberOfSpeakers = 'auto',
      meetingDate = null,
      onProgress = null,
    } = options;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('transcription_language', transcriptionLanguage);
    formData.append('number_of_speakers', numberOfSpeakers);
    if (meetingDate) {
      formData.append('meeting_date', meetingDate);
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

    const response = await apiClient.post(`${BASE_URL}/upload`, formData, config);
    return response.data;
  },

  /**
   * Upload multiple meeting files.
   * @param {FileList|Array} files - Files to upload
   * @param {Object} options - Upload options (same as upload)
   * @returns {Promise<Array>} Created meetings
   */
  async batchUpload(files, options = {}) {
    const {
      transcriptionLanguages = 'en-US',
      numberOfSpeakersList = 'auto',
      meetingDates = '',
      onProgress = null,
    } = options;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    formData.append('transcription_languages', transcriptionLanguages);
    formData.append('number_of_speakers_list', numberOfSpeakersList);
    formData.append('meeting_dates', meetingDates);

    const config = {
      headers: { 'Content-Type': 'multipart/form-data' },
    };

    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      };
    }

    const response = await apiClient.post(`${BASE_URL}/batch-upload`, formData, config);
    return response.data;
  },

  /**
   * Update meeting details.
   * @param {number} meetingId - Meeting ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated meeting
   */
  async update(meetingId, updates) {
    const response = await apiClient.put(`${BASE_URL}/${meetingId}`, updates);
    return response.data;
  },

  /**
   * Rename a meeting.
   * @param {number} meetingId - Meeting ID
   * @param {string} newName - New filename
   * @returns {Promise<Object>} Updated meeting
   */
  async rename(meetingId, newName) {
    return this.update(meetingId, { filename: newName });
  },

  /**
   * Delete a meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<void>}
   */
  async delete(meetingId) {
    await apiClient.delete(`${BASE_URL}/${meetingId}`);
  },

  /**
   * Restart processing for a meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Object>} Updated meeting
   */
  async restartProcessing(meetingId) {
    const response = await apiClient.post(`${BASE_URL}/${meetingId}/restart-processing`);
    return response.data;
  },

  /**
   * Generate a missing audio file for a meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Object>} Task status
   */
  async regenerateAudio(meetingId) {
    const response = await apiClient.post(`${BASE_URL}/${meetingId}/generate-audio`);
    return response.data;
  },

  /**
   * Retry analysis for a failed meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Object>} Updated meeting
   */
  async retryAnalysis(meetingId) {
    const response = await apiClient.post(`${BASE_URL}/${meetingId}/retry-analysis`);
    return response.data;
  },

  /**
   * Update meeting tags and folder.
   * @param {number} meetingId - Meeting ID
   * @param {string} tags - Comma-separated tags
   * @param {string} folder - Folder name
   * @returns {Promise<Object>} Updated meeting
   */
  async updateTagsFolder(meetingId, tags, folder) {
    const response = await apiClient.put(`${BASE_URL}/${meetingId}/tags-folder`, { tags, folder });
    return response.data;
  },

  /**
   * Update meeting notes.
   * @param {number} meetingId - Meeting ID
   * @param {string} notes - Notes content
   * @returns {Promise<Object>} Updated meeting
   */
  async updateNotes(meetingId, notes) {
    const response = await apiClient.put(`${BASE_URL}/${meetingId}/notes`, { notes });
    return response.data;
  },

  /**
   * Get all unique tags across meetings.
   * @returns {Promise<Array>} List of tags
   */
  async getAllTags() {
    const response = await apiClient.get(`${BASE_URL}/tags/all`);
    return response.data;
  },

  /**
   * Download meeting in specified format.
   * @param {number} meetingId - Meeting ID
   * @param {string} format - Export format (json, txt, docx, pdf)
   * @param {string} filename - Optional filename
   */
  async download(meetingId, format, filename = null) {
    const response = await apiClient.get(`${BASE_URL}/${meetingId}/download/${format}`, {
      responseType: 'blob',
    });

    const defaultFilename = `meeting_${meetingId}.${format}`;
    downloadBlob(response.data, filename || defaultFilename);
  },

  /**
   * Get audio stream URL for playback.
   * @param {number} meetingId - Meeting ID
   * @returns {string} Audio URL
   */
  getAudioUrl(meetingId) {
    return `${BASE_URL}/${meetingId}/audio`;
  },
};

export default MeetingService;
