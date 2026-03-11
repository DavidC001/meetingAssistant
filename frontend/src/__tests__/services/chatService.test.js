/**
 * Tests for chatService.
 */
import ChatService, {
  MeetingChatService,
  ProjectChatService,
  GlobalChatService,
} from '../../services/chatService';
import apiClient from '../../services/apiClient';

jest.mock('../../services/apiClient', () => {
  const client = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  client.defaults = { baseURL: '' };
  client.interceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  };
  return { __esModule: true, default: client };
});

beforeEach(() => jest.clearAllMocks());

describe('MeetingChatService', () => {
  test('getHistory calls correct endpoint', async () => {
    apiClient.get.mockResolvedValue({ data: [{ id: 1 }] });
    const result = await MeetingChatService.getHistory(10);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/meetings/10/chat/history', {
      params: { limit: 50 },
    });
    expect(result).toEqual([{ id: 1 }]);
  });

  test('sendMessage posts message', async () => {
    apiClient.post.mockResolvedValue({ data: { answer: 'response' } });
    const result = await MeetingChatService.sendMessage(10, 'hello');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/meetings/10/chat', {
      query: 'hello',
      chat_history: [],
      top_k: 5,
      use_full_transcript: false,
    });
    expect(result.answer).toBe('response');
  });

  test('clearHistory deletes history', async () => {
    apiClient.delete.mockResolvedValue({});
    await MeetingChatService.clearHistory(10);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/meetings/10/chat/history');
  });
});

describe('ProjectChatService', () => {
  test('listSessions gets sessions', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await ProjectChatService.listSessions(5);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/projects/5/chat/sessions');
  });

  test('createSession posts session', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1, title: 'Chat' } });
    await ProjectChatService.createSession(5, 'Chat');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/projects/5/chat/sessions', {
      title: 'Chat',
    });
  });

  test('getMessages fetches messages', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await ProjectChatService.getMessages(5, 1);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/projects/5/chat/sessions/1/messages');
  });

  test('sendMessage posts to project chat', async () => {
    apiClient.post.mockResolvedValue({ data: { message: 'hi' } });
    await ProjectChatService.sendMessage(5, 'hello', 1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/projects/5/chat', {
      message: 'hello',
      session_id: 1,
    });
  });

  test('deleteSession calls delete', async () => {
    apiClient.delete.mockResolvedValue({});
    await ProjectChatService.deleteSession(5, 1);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/projects/5/chat/sessions/1');
  });
});

describe('GlobalChatService', () => {
  test('listSessions gets sessions', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await GlobalChatService.listSessions();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/global-chat/sessions');
  });

  test('createSession with options', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await GlobalChatService.createSession({
      title: 'Test',
      filterFolder: 'eng',
      filterTags: ['weekly'],
    });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/global-chat/sessions', {
      title: 'Test',
      tags: null,
      filter_folder: 'eng',
      filter_tags: ['weekly'],
    });
  });

  test('getSession fetches session', async () => {
    apiClient.get.mockResolvedValue({ data: { id: 1 } });
    await GlobalChatService.getSession(1);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/global-chat/sessions/1');
  });

  test('sendMessage posts message', async () => {
    apiClient.post.mockResolvedValue({ data: { response: 'ok' } });
    await GlobalChatService.sendMessage(1, 'hello');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/global-chat/sessions/1/messages',
      expect.objectContaining({ message: 'hello' })
    );
  });

  test('deleteSession calls delete', async () => {
    apiClient.delete.mockResolvedValue({});
    await GlobalChatService.deleteSession(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/global-chat/sessions/1');
  });

  test('getAvailableFolders fetches folders', async () => {
    apiClient.get.mockResolvedValue({ data: ['eng', 'design'] });
    const result = await GlobalChatService.getAvailableFolders();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/global-chat/filters/folders');
    expect(result).toEqual(['eng', 'design']);
  });

  test('getAvailableTags fetches tags', async () => {
    apiClient.get.mockResolvedValue({ data: ['weekly'] });
    await GlobalChatService.getAvailableTags();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/global-chat/filters/tags');
  });
});

describe('ChatService unified object', () => {
  test('has meeting, project, global sub-services', () => {
    expect(ChatService.meeting).toBe(MeetingChatService);
    expect(ChatService.project).toBe(ProjectChatService);
    expect(ChatService.global).toBe(GlobalChatService);
  });
});
