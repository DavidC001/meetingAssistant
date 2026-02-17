/**
 * Unified Chat Service - Handles all chat API operations across the application.
 *
 * This service consolidates three chat contexts:
 * - Meeting-specific chat (RAG over single meeting transcript)
 * - Project chat (RAG over all meetings + notes in a project)
 * - Global chat (RAG across all meetings with optional filtering)
 */

import apiClient from './apiClient';

const MEETINGS_URL = '/api/v1/meetings';
const GLOBAL_CHAT_URL = '/api/v1/global-chat';
const PROJECTS_URL = '/api/v1/projects';

/**
 * Meeting-specific chat operations.
 * Chat with AI about a single meeting's transcript.
 */
export const MeetingChatService = {
  /**
   * Get chat history for a meeting.
   * @param {number} meetingId - Meeting ID
   * @param {number} limit - Maximum messages to return
   * @returns {Promise<Array>} Chat messages
   */
  async getHistory(meetingId, limit = 50) {
    const response = await apiClient.get(`${MEETINGS_URL}/${meetingId}/chat/history`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Send a message in meeting chat.
   * @param {number} meetingId - Meeting ID
   * @param {string} message - User message
   * @param {Object} options - Chat options
   * @param {Array} options.chatHistory - Previous messages
   * @param {number} options.topK - Number of chunks to retrieve
   * @param {boolean} options.useFullTranscript - Use entire transcript instead of RAG
   * @returns {Promise<Object>} Chat response with answer and sources
   */
  async sendMessage(meetingId, message, options = {}) {
    const { chatHistory = [], topK = 5, useFullTranscript = false } = options;

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
    await apiClient.delete(`${MEETINGS_URL}/${meetingId}/chat/history`);
  },
};

/**
 * Project-specific chat operations.
 * Chat with AI about all meetings and notes within a project.
 */
export const ProjectChatService = {
  /**
   * List all chat sessions for a project.
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} List of chat sessions
   */
  async listSessions(projectId) {
    const response = await apiClient.get(`${PROJECTS_URL}/${projectId}/chat/sessions`);
    return response.data;
  },

  /**
   * Create a new chat session for a project.
   * @param {number} projectId - Project ID
   * @param {string} title - Session title
   * @returns {Promise<Object>} Created session
   */
  async createSession(projectId, title = 'New chat') {
    const response = await apiClient.post(`${PROJECTS_URL}/${projectId}/chat/sessions`, {
      title,
    });
    return response.data;
  },

  /**
   * Get messages from a chat session.
   * @param {number} projectId - Project ID
   * @param {number} sessionId - Session ID
   * @returns {Promise<Array>} List of messages
   */
  async getMessages(projectId, sessionId) {
    const response = await apiClient.get(
      `${PROJECTS_URL}/${projectId}/chat/sessions/${sessionId}/messages`
    );
    return response.data;
  },

  /**
   * Send a message in a project chat session.
   * @param {number} projectId - Project ID
   * @param {string} message - User message
   * @param {number} sessionId - Session ID (optional, creates new if not provided)
   * @returns {Promise<Object>} Chat response with session_id, message, sources, and follow-ups
   */
  async sendMessage(projectId, message, sessionId = null) {
    const response = await apiClient.post(`${PROJECTS_URL}/${projectId}/chat`, {
      message,
      session_id: sessionId,
    });
    return response.data;
  },

  /**
   * Update a chat session (e.g., rename).
   * @param {number} projectId - Project ID
   * @param {number} sessionId - Session ID
   * @param {string} title - New title
   * @returns {Promise<Object>} Updated session
   */
  async updateSession(projectId, sessionId, title) {
    const response = await apiClient.put(
      `${PROJECTS_URL}/${projectId}/chat/sessions/${sessionId}`,
      { title }
    );
    return response.data;
  },

  /**
   * Delete a chat session.
   * @param {number} projectId - Project ID
   * @param {number} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async deleteSession(projectId, sessionId) {
    await apiClient.delete(`${PROJECTS_URL}/${projectId}/chat/sessions/${sessionId}`);
  },
};

/**
 * Global chat operations (cross-meeting RAG).
 * Chat with AI across all meetings with optional filtering.
 */
export const GlobalChatService = {
  /**
   * List all global chat sessions.
   * @returns {Promise<Array>} List of sessions
   */
  async listSessions() {
    const response = await apiClient.get(`${GLOBAL_CHAT_URL}/sessions`);
    return response.data;
  },

  /**
   * Create a new global chat session.
   * @param {Object} options - Session options
   * @param {string} options.title - Session title
   * @param {Array<string>} options.tags - Session tags
   * @param {string} options.filterFolder - Filter meetings by folder
   * @param {Array<string>} options.filterTags - Filter meetings by tags
   * @returns {Promise<Object>} Created session
   */
  async createSession(options = {}) {
    const { title = 'New chat', tags = null, filterFolder = null, filterTags = null } = options;

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
   * Update a global chat session.
   * @param {number} sessionId - Session ID
   * @param {Object} updates - Fields to update
   * @param {string} updates.title - Session title
   * @param {Array<string>} updates.tags - Session tags
   * @param {string} updates.filterFolder - Filter folder
   * @param {Array<string>} updates.filterTags - Filter tags
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
   * Delete a global chat session.
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
   * @param {Array} options.chatHistory - Previous messages
   * @param {number} options.topK - Number of chunks to retrieve
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

/**
 * Unified chat service object for convenience.
 *
 * @example
 * import ChatService from './services/chatService';
 *
 * // Meeting chat
 * const response = await ChatService.meeting.sendMessage(123, 'What was discussed?');
 *
 * // Project chat
 * const sessions = await ChatService.project.listSessions(456);
 *
 * // Global chat
 * const folders = await ChatService.global.getAvailableFolders();
 */
const ChatService = {
  meeting: MeetingChatService,
  project: ProjectChatService,
  global: GlobalChatService,
};

export default ChatService;
