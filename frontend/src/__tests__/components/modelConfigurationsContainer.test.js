import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../components/features/settings/hooks/useModelConfigurations', () => jest.fn());

const useModelConfigurations = require('../../components/features/settings/hooks/useModelConfigurations');
const ModelConfigurationsContainer =
  require('../../components/features/settings/containers/ModelConfigurationsContainer').default;

const mockedUseModelConfigurations = useModelConfigurations;

const baseFormData = {
  name: 'Config A',
  whisper_model: 'base',
  whisper_provider: 'faster-whisper',
  chat_provider: 'ollama',
  chat_model: 'llama3',
  chat_base_url: 'https://example.com',
  chat_api_key_id: null,
  analysis_provider: 'openai',
  analysis_model: 'gpt-4o-mini',
  analysis_base_url: '',
  analysis_api_key_id: null,
  max_tokens: 4000,
  max_reasoning_depth: 3,
  is_default: true,
};

const buildHookState = (overrides = {}) => ({
  configurations: [],
  providers: {
    whisper_providers: [{ id: 'faster-whisper', name: 'Faster Whisper' }],
    whisper_models: ['base'],
    llm_providers: [
      { id: 'openai', name: 'OpenAI' },
      { id: 'ollama', name: 'Ollama' },
      { id: 'other', name: 'Other/Custom' },
    ],
  },
  apiKeys: [
    {
      id: 1,
      name: 'Ollama Key',
      provider: 'ollama',
      environment_variable: 'OLLAMA_SERVER_API_KEY',
    },
    { id: 2, name: 'Other Key', provider: 'other', environment_variable: 'PROXY_API_KEY' },
    { id: 3, name: 'OpenAI Key', provider: 'openai', environment_variable: 'OPENAI_API_KEY' },
  ],
  dialogOpen: true,
  isEditing: true,
  isLoading: false,
  isSaving: false,
  snackbar: { open: false, message: '', severity: 'info' },
  setSnackbar: jest.fn(),
  activeTab: 2,
  setActiveTab: jest.fn(),
  formData: { ...baseFormData },
  deleteConfirmOpen: false,
  handleOpenDialog: jest.fn(),
  handleCloseDialog: jest.fn(),
  handleSaveConfiguration: jest.fn(),
  handleDeleteRequest: jest.fn(),
  handleDeleteConfirm: jest.fn(),
  handleDeleteCancel: jest.fn(),
  handleSetDefault: jest.fn(),
  handleFormChange: jest.fn(),
  handleNameChange: jest.fn(),
  handleMaxTokensChange: jest.fn(),
  handleChatModelChange: jest.fn(),
  handleAnalysisModelChange: jest.fn(),
  handleChatBaseUrlChange: jest.fn(),
  handleAnalysisBaseUrlChange: jest.fn(),
  ...overrides,
});

describe('ModelConfigurationsContainer API key selector', () => {
  test('shows chat API key selector for ollama and includes ollama+other keys', () => {
    mockedUseModelConfigurations.mockReturnValue(buildHookState());

    render(<ModelConfigurationsContainer />);

    expect(screen.getByText('Chat API Key (Optional)')).toBeInTheDocument();

    const chatSelect = screen.getByRole('combobox', { name: /chat api key \(optional\)/i });
    fireEvent.mouseDown(chatSelect);

    expect(screen.getByText(/Ollama Key/)).toBeInTheDocument();
    expect(screen.getByText(/Other Key/)).toBeInTheDocument();
    expect(screen.queryByText(/OpenAI Key/)).not.toBeInTheDocument();
  });

  test('shows analysis API key selector for ollama and includes ollama+other keys', () => {
    mockedUseModelConfigurations.mockReturnValue(
      buildHookState({
        activeTab: 3,
        formData: { ...baseFormData, analysis_provider: 'ollama' },
      })
    );

    render(<ModelConfigurationsContainer />);

    expect(screen.getByText('Analysis API Key (Optional)')).toBeInTheDocument();

    const analysisSelect = screen.getByRole('combobox', {
      name: /analysis api key \(optional\)/i,
    });
    fireEvent.mouseDown(analysisSelect);

    expect(screen.getByText(/Ollama Key/)).toBeInTheDocument();
    expect(screen.getByText(/Other Key/)).toBeInTheDocument();
    expect(screen.queryByText(/OpenAI Key/)).not.toBeInTheDocument();
  });
});
