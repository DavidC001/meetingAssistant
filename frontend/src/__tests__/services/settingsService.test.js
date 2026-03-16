/**
 * Tests for settingsService.
 */
import SettingsService, {
  APIKeyService,
  ModelConfigService,
  EmbeddingConfigService,
  WorkerConfigService,
  AppSettingsService,
  BackupService,
} from '../../services/settingsService';
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

const BASE = '/api/v1/settings';
const BACKUP_BASE = '/api/v1/backup';

describe('APIKeyService', () => {
  test('getAll', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    const result = await APIKeyService.getAll();
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/api-keys`);
    expect(result).toEqual([]);
  });

  test('create', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await APIKeyService.create({ name: 'key', provider: 'openai' });
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/api-keys`, {
      name: 'key',
      provider: 'openai',
    });
  });

  test('update', async () => {
    apiClient.put.mockResolvedValue({ data: { id: 1 } });
    await APIKeyService.update(1, { name: 'updated' });
    expect(apiClient.put).toHaveBeenCalledWith(`${BASE}/api-keys/1`, { name: 'updated' });
  });

  test('delete', async () => {
    apiClient.delete.mockResolvedValue({});
    await APIKeyService.delete(1);
    expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/api-keys/1`);
  });

  test('getTokenStatus', async () => {
    apiClient.get.mockResolvedValue({ data: {} });
    await APIKeyService.getTokenStatus();
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/api-tokens`);
  });

  test('updateTokens', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await APIKeyService.updateTokens({ OPENAI_API_KEY: 'sk-test' });
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/api-tokens`, {
      OPENAI_API_KEY: 'sk-test',
    });
  });
});

describe('ModelConfigService', () => {
  test('getAll', async () => {
    apiClient.get.mockResolvedValue({ data: [] });
    await ModelConfigService.getAll();
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/model-configurations`);
  });

  test('getProviders', async () => {
    apiClient.get.mockResolvedValue({ data: {} });
    await ModelConfigService.getProviders();
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/model-providers`);
  });

  test('getById', async () => {
    apiClient.get.mockResolvedValue({ data: { id: 1 } });
    // eslint-disable-next-line testing-library/no-await-sync-query
    await ModelConfigService.getById(1);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/model-configurations/1`);
  });

  test('create', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await ModelConfigService.create({ name: 'cfg' });
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/model-configurations`, { name: 'cfg' });
  });

  test('update', async () => {
    apiClient.put.mockResolvedValue({ data: { id: 1 } });
    await ModelConfigService.update(1, { name: 'updated' });
    expect(apiClient.put).toHaveBeenCalledWith(`${BASE}/model-configurations/1`, {
      name: 'updated',
    });
  });

  test('delete', async () => {
    apiClient.delete.mockResolvedValue({});
    await ModelConfigService.delete(1);
    expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/model-configurations/1`);
  });

  test('setDefault', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await ModelConfigService.setDefault(1);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/model-configurations/1/set-default`);
  });
});

describe('EmbeddingConfigService', () => {
  test('getConfig', async () => {
    apiClient.get.mockResolvedValue({ data: {} });
    await EmbeddingConfigService.getConfig();
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/embedding-config`);
  });

  test('validateModel', async () => {
    apiClient.get.mockResolvedValue({ data: { valid: true } });
    await EmbeddingConfigService.validateModel('openai', 'text-embedding-3-small');
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/embedding-config/validate-model`, {
      params: { provider: 'openai', model_name: 'text-embedding-3-small' },
    });
  });

  test('create', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 1 } });
    await EmbeddingConfigService.create({ provider: 'openai' });
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/embedding-config`, {
      provider: 'openai',
    });
  });

  test('activate', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await EmbeddingConfigService.activate(1);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/embedding-config/1/activate`);
  });

  test('recomputeAll', async () => {
    apiClient.post.mockResolvedValue({ data: { task_id: 'abc' } });
    await EmbeddingConfigService.recomputeAll();
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/embedding-config/recompute`);
  });
});

describe('WorkerConfigService', () => {
  test('get', async () => {
    apiClient.get.mockResolvedValue({ data: { max_workers: 2 } });
    const result = await WorkerConfigService.get();
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/worker-scaling`);
    expect(result.max_workers).toBe(2);
  });

  test('update', async () => {
    apiClient.put.mockResolvedValue({ data: { max_workers: 4 } });
    await WorkerConfigService.update(4);
    expect(apiClient.put).toHaveBeenCalledWith(`${BASE}/worker-scaling`, { max_workers: 4 });
  });
});

describe('AppSettingsService', () => {
  test('get', async () => {
    apiClient.get.mockResolvedValue({ data: { max_file_size_mb: 1000 } });
    await AppSettingsService.get();
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/app-settings`);
  });

  test('update', async () => {
    apiClient.post.mockResolvedValue({ data: {} });
    await AppSettingsService.update({ max_file_size_mb: 500 });
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/app-settings`, {
      max_file_size_mb: 500,
    });
  });
});

describe('BackupService', () => {
  test('export without audio', async () => {
    apiClient.get.mockResolvedValue({ data: new Blob(), headers: {} });
    const result = await BackupService.export(false);
    expect(apiClient.get).toHaveBeenCalledWith(`${BACKUP_BASE}/export`, {
      params: { include_audio: false },
      responseType: 'blob',
    });
    expect(result).toHaveProperty('blob');
    expect(result).toHaveProperty('filename');
  });

  test('export with audio uses zip endpoint and filename header', async () => {
    apiClient.get.mockResolvedValue({
      data: new Blob(),
      headers: {
        'content-disposition':
          'attachment; filename="meeting_assistant_backup_20260316_120000.zip"',
      },
    });

    const result = await BackupService.export(true);

    expect(apiClient.get).toHaveBeenCalledWith(`${BACKUP_BASE}/export`, {
      params: { include_audio: true },
      responseType: 'blob',
    });
    expect(result.filename).toBe('meeting_assistant_backup_20260316_120000.zip');
  });

  test('import file', async () => {
    apiClient.post.mockResolvedValue({ data: { imported: 10 } });
    const file = new File(['{}'], 'backup.json');
    await BackupService.import(file, true);
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BACKUP_BASE}/import`,
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
    );
  });
});

describe('SettingsService unified', () => {
  test('has all sub-services', () => {
    expect(SettingsService.apiKeys).toBe(APIKeyService);
    expect(SettingsService.modelConfig).toBe(ModelConfigService);
    expect(SettingsService.embeddingConfig).toBe(EmbeddingConfigService);
    expect(SettingsService.workerConfig).toBe(WorkerConfigService);
    expect(SettingsService.appSettings).toBe(AppSettingsService);
    expect(SettingsService.backup).toBe(BackupService);
  });
});
