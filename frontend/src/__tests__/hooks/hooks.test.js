/**
 * Tests for custom hooks: useKeyboardNavigation and useMeetingChat.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import useKeyboardNavigation, { COMMON_SHORTCUTS } from '../../hooks/useKeyboardNavigation';
import { useMeetingChat } from '../../hooks/useMeetingChat';
import { MeetingChatService } from '../../services';

// ============================== useKeyboardNavigation ==============================

describe('useKeyboardNavigation', () => {
  test('COMMON_SHORTCUTS has expected keys', () => {
    expect(COMMON_SHORTCUTS.SEARCH).toBe('ctrl+k');
    expect(COMMON_SHORTCUTS.NEW_MEETING).toBe('ctrl+n');
    expect(COMMON_SHORTCUTS.CLOSE).toBe('escape');
    expect(COMMON_SHORTCUTS.SAVE).toBe('ctrl+s');
  });

  test('fires callback for matching keyboard shortcut', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardNavigation({ 'ctrl+k': handler }));

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      );
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('does nothing for unregistered shortcut', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardNavigation({ 'ctrl+k': handler }));

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true })
      );
    });

    expect(handler).not.toHaveBeenCalled();
  });

  test('supports escape key', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardNavigation({ escape: handler }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('returns focusFirst helper', () => {
    const { result } = renderHook(() => useKeyboardNavigation({}));
    expect(typeof result.current.focusFirst).toBe('function');
    expect(typeof result.current.trapFocus).toBe('function');
  });

  test('focusFirst focuses first interactive element', () => {
    const { result } = renderHook(() => useKeyboardNavigation({}));
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.focus = jest.fn();
    container.appendChild(button);

    result.current.focusFirst(container);
    expect(button.focus).toHaveBeenCalled();
  });

  test('cleans up listener on unmount', () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useKeyboardNavigation({ 'ctrl+k': handler }));
    unmount();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      );
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

// ============================== useMeetingChat ==============================
jest.mock('../../services', () => ({
  MeetingChatService: {
    getHistory: jest.fn().mockResolvedValue({ history: [] }),
    sendMessage: jest.fn().mockResolvedValue({
      response: 'AI answer',
      sources: [],
      follow_up_suggestions: [],
    }),
    clearHistory: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

// mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe('useMeetingChat', () => {
  beforeEach(() => jest.clearAllMocks());

  test('initializes with default state', async () => {
    const { result } = renderHook(() => useMeetingChat(1));
    await waitFor(() => expect(MeetingChatService.getHistory).toHaveBeenCalled());

    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.topK).toBe(5);
    expect(result.current.useFullTranscript).toBe(false);
  });

  test('loads chat history on mount', async () => {
    MeetingChatService.getHistory.mockResolvedValue({
      history: [{ role: 'user', content: 'hi', sources: [] }],
    });

    const { result } = renderHook(() => useMeetingChat(42));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    expect(MeetingChatService.getHistory).toHaveBeenCalledWith(42, 50);
  });

  test('handleSend sends message and updates state', async () => {
    MeetingChatService.getHistory.mockResolvedValue({ history: [] });
    MeetingChatService.sendMessage.mockResolvedValue({
      response: 'I can help!',
      sources: [{ text: 'src' }],
      follow_up_suggestions: ['ask more'],
    });

    const { result } = renderHook(() => useMeetingChat(1));
    await waitFor(() => expect(MeetingChatService.getHistory).toHaveBeenCalled());

    // Set input
    act(() => result.current.setInput('Hello'));

    await act(async () => {
      await result.current.handleSend();
    });

    // Should have user message + assistant response
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[1].content).toBe('I can help!');
  });

  test('clearChatHistory clears messages', async () => {
    MeetingChatService.getHistory.mockResolvedValue({
      history: [{ role: 'user', content: 'hi', sources: [] }],
    });

    const { result } = renderHook(() => useMeetingChat(1));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.clearChatHistory();
    });

    expect(MeetingChatService.clearHistory).toHaveBeenCalledWith(1);
    expect(result.current.messages).toEqual([]);
  });

  test('toggleSourcesExpanded toggles a source index', async () => {
    const { result } = renderHook(() => useMeetingChat(1));
    await waitFor(() => expect(MeetingChatService.getHistory).toHaveBeenCalled());

    act(() => result.current.toggleSourcesExpanded(0));
    expect(result.current.expandedSources[0]).toBe(true);

    act(() => result.current.toggleSourcesExpanded(0));
    expect(result.current.expandedSources[0]).toBe(false);
  });
});
