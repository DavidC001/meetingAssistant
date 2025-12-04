/**
 * Speaker Service - Handles speaker-related API operations.
 */

import apiClient from './apiClient';

const MEETINGS_URL = '/api/v1/meetings';

const SpeakerService = {
  /**
   * Get all speakers for a meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<Array>} List of speakers
   */
  async getForMeeting(meetingId) {
    const response = await apiClient.get(`${MEETINGS_URL}/${meetingId}/speakers`);
    return response.data;
  },

  /**
   * Get all unique speakers across all meetings.
   * @returns {Promise<Array>} List of unique speaker names
   */
  async getAll() {
    const response = await apiClient.get(`${MEETINGS_URL}/speakers/all`);
    return response.data;
  },

  /**
   * Add a speaker to a meeting.
   * @param {number} meetingId - Meeting ID
   * @param {Object} speaker - Speaker data
   * @param {string} speaker.name - Speaker name
   * @param {string} speaker.label - Speaker label
   * @returns {Promise<Object>} Created speaker
   */
  async add(meetingId, speaker) {
    const response = await apiClient.post(`${MEETINGS_URL}/${meetingId}/speakers`, speaker);
    return response.data;
  },

  /**
   * Update a speaker.
   * @param {number} speakerId - Speaker ID
   * @param {Object} speaker - Updated speaker data
   * @returns {Promise<Object>} Updated speaker
   */
  async update(speakerId, speaker) {
    const response = await apiClient.put(`${MEETINGS_URL}/speakers/${speakerId}`, speaker);
    return response.data;
  },

  /**
   * Delete a speaker.
   * @param {number} speakerId - Speaker ID
   * @returns {Promise<void>}
   */
  async delete(speakerId) {
    await apiClient.delete(`${MEETINGS_URL}/speakers/${speakerId}`);
  },
};

export default SpeakerService;
