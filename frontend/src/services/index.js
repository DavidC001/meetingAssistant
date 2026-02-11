/**
 * Services barrel file.
 *
 * Re-exports all service modules for convenient importing.
 *
 * Usage:
 *   import { MeetingService, ChatService } from './services';
 *   // or
 *   import MeetingService from './services/meetingService';
 */

export { default as apiClient } from './apiClient';
export { buildQueryString, downloadBlob } from './apiClient';

export { default as MeetingService } from './meetingService';
export { default as SpeakerService } from './speakerService';
export { default as ActionItemService } from './actionItemService';
export { default as AttachmentService } from './attachmentService';
export { MeetingChatService, GlobalChatService } from './chatService';
export { default as ChatService } from './chatService';
export {
  APIKeyService,
  ModelConfigService,
  EmbeddingConfigService,
  WorkerConfigService,
  AppSettingsService,
} from './settingsService';
export { default as SettingsService } from './settingsService';
export { default as DiaryService } from './diaryService';
export { projectService } from './projectService';
