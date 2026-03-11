/**
 * Tests for searchService, diaryService, calendarService,
 * actionItemService, and speakerService.
 */
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

// ============================== SearchService ==============================
describe('SearchService', () => {
  let SearchService;
  beforeAll(async () => {
    const mod = await import('../../services/searchService');
    SearchService = mod.default;
  });

  test('search posts query', async () => {
    apiClient.post.mockResolvedValue({
      data: { results: [], total: 0, query: 'test', search_time_ms: 1 },
    });
    const result = await SearchService.search('test');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/search/',
      expect.objectContaining({ query: 'test' })
    );
    expect(result.total).toBe(0);
  });

  test('search with options', async () => {
    apiClient.post.mockResolvedValue({ data: { results: [], total: 0 } });
    await SearchService.search('q', {
      searchIn: ['transcripts'],
      limit: 5,
      folder: 'eng',
      tags: ['weekly'],
    });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/search/', {
      query: 'q',
      search_in: ['transcripts'],
      limit: 5,
      folder: 'eng',
      date_from: undefined,
      date_to: undefined,
      tags: ['weekly'],
    });
  });
});

// ============================== DiaryService ==============================
describe('DiaryService', () => {
  let diaryService;
  beforeAll(async () => {
    const mod = await import('../../services/diaryService');
    diaryService = mod.default;
  });

  test('getEntries with params', async () => {
    apiClient.get.mockResolvedValue({ data: { entries: [], total: 0 } });
    await diaryService.getEntries({ startDate: '2024-01-01', endDate: '2024-01-31' });
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/diary/entries'));
  });

  test('getEntry by date', async () => {
    apiClient.get.mockResolvedValue({ data: { date: '2024-01-15' } });
    await diaryService.getEntry('2024-01-15');
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/diary/entries/2024-01-15')
    );
  });

  test('createEntry', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await diaryService.createEntry({ date: '2024-01-15', content: 'test' });
    expect(apiClient.post).toHaveBeenCalledWith(expect.stringContaining('/api/v1/diary/entries'), {
      date: '2024-01-15',
      content: 'test',
    });
  });

  test('updateEntry', async () => {
    apiClient.put.mockResolvedValue({ data: {} });
    await diaryService.updateEntry('2024-01-15', { content: 'updated' });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/diary/entries/2024-01-15', {
      content: 'updated',
    });
  });

  test('deleteEntry', async () => {
    apiClient.delete.mockResolvedValue({});
    await diaryService.deleteEntry('2024-01-15');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/diary/entries/2024-01-15');
  });

  test('checkReminder', async () => {
    apiClient.get.mockResolvedValue({ data: { show: true } });
    await diaryService.checkReminder();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/diary/reminder');
  });

  test('dismissReminder', async () => {
    apiClient.post.mockResolvedValue({});
    await diaryService.dismissReminder('2024-01-15');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/diary/reminder/dismiss', {
      date: '2024-01-15',
    });
  });
});

// ============================== CalendarService ==============================
describe('CalendarService', () => {
  let CalendarService;
  beforeAll(async () => {
    const mod = await import('../../services/calendarService');
    CalendarService = mod.default;
  });

  test('getGoogleStatus', async () => {
    apiClient.get.mockResolvedValue({ data: { isConnected: false } });
    await CalendarService.getGoogleStatus();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/calendar/google/status');
  });

  test('getGoogleAuthUrl', async () => {
    apiClient.get.mockResolvedValue({ data: { url: 'https://example.com' } });
    await CalendarService.getGoogleAuthUrl();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/calendar/google/auth-url');
  });

  test('authorizeGoogle', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await CalendarService.authorizeGoogle('code123');
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/calendar/google/authorize', {
      code: 'code123',
    });
  });

  test('disconnectGoogle', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await CalendarService.disconnectGoogle();
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/calendar/google/disconnect');
  });

  test('getActionItems', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await CalendarService.getActionItems();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/calendar/action-items');
  });

  test('createActionItem', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await CalendarService.createActionItem({ task: 'Do X' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/calendar/action-items', {
      task: 'Do X',
    });
  });

  test('updateActionItem', async () => {
    apiClient.put.mockResolvedValue({ data: { id: 1 } });
    await CalendarService.updateActionItem(1, { task: 'Updated' });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/calendar/action-items/1', {
      task: 'Updated',
    });
  });

  test('deleteActionItem', async () => {
    apiClient.delete.mockResolvedValue({ data: {} });
    await CalendarService.deleteActionItem(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/meetings/action-items/1');
  });

  test('syncAllPending', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await CalendarService.syncAllPending();
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/calendar/sync-all?status=pending');
  });
});

// ============================== ActionItemService ==============================
describe('ActionItemService', () => {
  let ActionItemService;
  beforeAll(async () => {
    const mod = await import('../../services/actionItemService');
    ActionItemService = mod.default;
  });

  test('getAll with filters', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await ActionItemService.getAll({ status: 'pending' });
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/meetings/action-items')
    );
  });

  test('add action item to transcription', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await ActionItemService.add(10, { task: 'Write tests' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/meetings/transcriptions/10/action-items', {
      task: 'Write tests',
    });
  });

  test('update action item', async () => {
    apiClient.put.mockResolvedValue({ data: { id: 1 } });
    await ActionItemService.update(1, { status: 'completed' });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/meetings/action-items/1', {
      status: 'completed',
    });
  });

  test('delete action item', async () => {
    apiClient.delete.mockResolvedValue({});
    await ActionItemService.delete(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/meetings/action-items/1');
  });

  test('linkToProject', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await ActionItemService.linkToProject(1, 5);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/projects/1/action-items/5');
  });

  test('unlinkFromProject', async () => {
    apiClient.delete.mockResolvedValue({});
    await ActionItemService.unlinkFromProject(1, 5);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/projects/1/action-items/5');
  });

  test('getGlobal', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await ActionItemService.getGlobal();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/calendar/action-items');
  });
});

// ============================== SpeakerService ==============================
describe('SpeakerService', () => {
  let SpeakerService;
  beforeAll(async () => {
    const mod = await import('../../services/speakerService');
    SpeakerService = mod.default;
  });

  test('getForMeeting', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await SpeakerService.getForMeeting(1);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/meetings/1/speakers');
  });

  test('getAll', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await SpeakerService.getAll();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/meetings/speakers/all');
  });

  test('add speaker', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await SpeakerService.add(1, { name: 'Alice', label: 'Speaker 1' });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/meetings/1/speakers', {
      name: 'Alice',
      label: 'Speaker 1',
    });
  });

  test('update speaker', async () => {
    apiClient.put.mockResolvedValue({ data: { id: 1 } });
    await SpeakerService.update(1, { name: 'Bob' });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/meetings/speakers/1', { name: 'Bob' });
  });

  test('delete speaker', async () => {
    apiClient.delete.mockResolvedValue({});
    await SpeakerService.delete(1);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/meetings/speakers/1');
  });
});
