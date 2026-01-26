/**
 * Chat Service - Handles meeting and global chat API operations.
 */

import apiClient from './apiClient';

const MEETINGS_URL = '/api/v1/meetings';
const GLOBAL_CHAT_URL = '/api/v1/global-chat';

/**
 * Meeting-specific chat operations.
 */
export const MeetingChatService = {
  /**
   * Get chat history for a meeting.
   * @param {number} meetingId - Meeting ID
   * @param {number} limit - Maximum messages to return
   * @returns {Promise<Array>} Chat messages
   */
  async getHistory(meetingId, limit = 50) {
    const response = await apiClient.get(`${MEETINGS_URL}/${meetingId}/chat?limit=${limit}`);
    return response.data;
  },

  /**
   * Send a message in meeting chat.
   * @param {number} meetingId - Meeting ID
   * @param {string} message - User message
   * @param {Object} options - Chat options
   * @returns {Promise<Object>} Chat response
   */
  async sendMessage(meetingId, message, options = {}) {
    const {
      chatHistory = [],
      topK = 5,
      useFullTranscript = false,
    } = options;

    const response = await apiClient.post(`${MEETINGS_URL}/${meetingId}/chat`, {
      query: message,
      chat_history: chatHistory,
      top_k: topK,
      use_full_transcript: useFullTranscript,
    });
    return response.data;
  },

  /**
   * Clear chat history for a meeting.
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<void>}
   */
  async clearHistory(meetingId) {
    await apiClient.delete(`${MEETINGS_URL}/${meetingId}/chat`);
  },
};

/**
 * Global chat operations (cross-meeting RAG).
 */
export const GlobalChatService = {
  /**
   * List all chat sessions.
   * @returns {Promise<Array>} List of sessions
   */
  async listSessions() {
    const response = await apiClient.get(`${GLOBAL_CHAT_URL}/sessions`);
    return response.data;
  },

  /**
   * Create a new chat session.
   * @param {Object} options - Session options
   * @returns {Promise<Object>} Created session
   */
  async createSession(options = {}) {
    const {
      title = 'New chat',
      tags = null,
      filterFolder = null,
      filterTags = null,
    } = options;

    const response = await apiClient.post(`${GLOBAL_CHAT_URL}/sessions`, {
      title,
      tags,
      filter_folder: filterFolder,
      filter_tags: filterTags,
    });
    return response.data;
  },

  /**
   * Get a session with its messages.
   * @param {number} sessionId - Session ID
   * @returns {Promise<Object>} Session details with messages
   */
  async getSession(sessionId) {
    const response = await apiClient.get(`${GLOBAL_CHAT_URL}/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Update a session.
   * @param {number} sessionId - Session ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated session
   */
  async updateSession(sessionId, updates) {
    const response = await apiClient.put(`${GLOBAL_CHAT_URL}/sessions/${sessionId}`, {
      title: updates.title,
      tags: updates.tags,
      filter_folder: updates.filterFolder,
      filter_tags: updates.filterTags,
    });
    return response.data;
  },

  /**
   * Delete a session.
   * @param {number} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    await apiClient.delete(`${GLOBAL_CHAT_URL}/sessions/${sessionId}`);
  },

  /**
   * Send a message in a global chat session.
   * @param {number} sessionId - Session ID
   * @param {string} message - User message
   * @param {Object} options - Chat options
   * @returns {Promise<Object>} Chat response
   */
  async sendMessage(sessionId, message, options = {}) {
    const { chatHistory = [], topK = 5 } = options;

    const response = await apiClient.post(`${GLOBAL_CHAT_URL}/sessions/${sessionId}/messages`, {
      message,
      chat_history: chatHistory,
      top_k: topK,
    });
    return response.data;
  },

  /**
   * Get available folders for filtering.
   * @returns {Promise<Array>} List of folder names
   */
  async getAvailableFolders() {
    const response = await apiClient.get(`${GLOBAL_CHAT_URL}/filters/folders`);
    return response.data;
  },

  /**
   * Get available tags for filtering.
   * @returns {Promise<Array>} List of tag names
   */
  async getAvailableTags() {
    const response = await apiClient.get(`${GLOBAL_CHAT_URL}/filters/tags`);
    return response.data;
  },
};

// Export both services as default for backward compatibility
export default {
  meeting: MeetingChatService,
  global: GlobalChatService,
};
