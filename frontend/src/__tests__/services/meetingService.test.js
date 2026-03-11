/**
 * Tests for meetingService.
 */
import MeetingService from '../../services/meetingService';
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
  return {
    __esModule: true,
    default: client,
    buildQueryString: jest.fn((params) => {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      return qs ? `?${qs}` : '';
    }),
    downloadBlob: jest.fn(),
  };
});

beforeEach(() => jest.clearAllMocks());

describe('MeetingService', () => {
  test('getAll calls GET /api/v1/meetings/', async () => {
    apiClient.get.mockResolvedValue({ data: [{ id: 1 }] });
    const result = await MeetingService.getAll();
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/meetings/'));
    expect(result).toEqual([{ id: 1 }]);
  });

  test('getById calls GET with meeting id', async () => {
    apiClient.get.mockResolvedValue({ data: { id: 5 } });
    // eslint-disable-next-line testing-library/no-await-sync-query
    const result = await MeetingService.getById(5);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/meetings/5');
    expect(result).toEqual({ id: 5 });
  });

  test('upload sends FormData via POST', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 10 } });
    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    const result = await MeetingService.upload(file);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/meetings/upload',
      expect.any(FormData),
      expect.any(Object)
    );
    expect(result).toEqual({ id: 10 });
  });

  test('upload with onProgress callback', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 11 } });
    const file = new File(['audio'], 'test.wav');
    const onProgress = jest.fn();
    await MeetingService.upload(file, { onProgress });
    const callArgs = apiClient.post.mock.calls[0][2];
    expect(callArgs.onUploadProgress).toBeDefined();
  });

  test('update calls PUT', async () => {
    apiClient.put.mockResolvedValue({ data: { id: 1, filename: 'new' } });
    const result = await MeetingService.update(1, { filename: 'new' });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/meetings/1', { filename: 'new' });
    expect(result.filename).toBe('new');
  });

  test('rename delegates to update', async () => {
    apiClient.put.mockResolvedValue({ data: { id: 1, filename: 'renamed' } });
    await MeetingService.rename(1, 'renamed');
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/meetings/1', { filename: 'renamed' });
  });

  test('delete calls DELETE', async () => {
    apiClient.delete.mockResolvedValue({});
    await MeetingService.delete(3);
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/meetings/3');
  });

  test('restartProcessing calls POST', async () => {
    apiClient.post.mockResolvedValue({ data: { status: 'processing' } });
    await MeetingService.restartProcessing(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/meetings/1/restart-processing');
  });

  test('updateTagsFolder calls PUT', async () => {
    apiClient.put.mockResolvedValue({ data: { tags: 'a', folder: 'f' } });
    await MeetingService.updateTagsFolder(1, 'a', 'f');
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/meetings/1/tags-folder', {
      tags: 'a',
      folder: 'f',
    });
  });

  test('updateNotes calls PUT', async () => {
    apiClient.put.mockResolvedValue({ data: {} });
    await MeetingService.updateNotes(1, 'notes');
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/meetings/1/notes', { notes: 'notes' });
  });

  test('getAllTags calls GET', async () => {
    apiClient.get.mockResolvedValue({ data: ['tag1', 'tag2'] });
    const result = await MeetingService.getAllTags();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/meetings/tags/all');
    expect(result).toEqual(['tag1', 'tag2']);
  });

  test('getAudioUrl returns correct URL', () => {
    expect(MeetingService.getAudioUrl(7)).toBe('/api/v1/meetings/7/audio');
  });

  test('batchUpload sends multiple files', async () => {
    apiClient.post.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
    const files = [new File(['a'], 'a.wav'), new File(['b'], 'b.wav')];
    await MeetingService.batchUpload(files);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/meetings/batch-upload',
      expect.any(FormData),
      expect.any(Object)
    );
  });
});
