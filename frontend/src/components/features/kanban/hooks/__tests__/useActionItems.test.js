/**
 * Regression tests for two kanban bugs:
 *
 * Bug 3 - The general (global-mode) board leaked completed items, including
 * past-due completed ones, because the "hide completed" filter in
 * fetchActionItems() was gated on `isProjectMode` and never applied to the
 * global board.
 *
 * Bug 6 - Editing an action item from the meeting view reset it to the
 * "Pending" column, because updateActionItem() merged the raw backend
 * response (status uses underscores, e.g. "in_progress") straight into
 * state without normalizing it to the hyphenated form the column grouping
 * ("in-progress") expects.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useActionItems } from '../useActionItems';
import { ActionItemService, projectService } from '../../../../../services';

jest.mock('../../../../../services', () => ({
  ActionItemService: {
    getGlobal: jest.fn(),
    updateGlobal: jest.fn(),
    createGlobal: jest.fn(),
    add: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    linkToProject: jest.fn(),
    unlinkFromProject: jest.fn(),
  },
  projectService: {
    getActionItems: jest.fn(),
    createActionItem: jest.fn(),
  },
}));

jest.mock('../../../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================== Bug 3: hide completed in global mode ==============================

describe('useActionItems - global mode completed-item filtering', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const items = [
    { id: 1, task: 'Pending task', status: 'pending', due_date: tomorrow },
    // Past-due AND completed - this is the item that used to leak through.
    { id: 2, task: 'Expired completed task', status: 'completed', due_date: yesterday },
    { id: 3, task: 'Completed but not due yet', status: 'completed', due_date: tomorrow },
  ];

  test('showCompleted=false hides completed items (including past-due ones) on the global board', async () => {
    ActionItemService.getGlobal.mockResolvedValue(items);

    const { result } = renderHook(() =>
      useActionItems({ mode: 'global', timeHorizon: 'all', showCompleted: false })
    );

    await waitFor(() => expect(ActionItemService.getGlobal).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

    const ids = result.current.actionItems.map((item) => item.id);
    expect(ids).toEqual([1]);
    expect(result.current.columns.completed).toHaveLength(0);
  });

  test('showCompleted=true shows completed items, including past-due ones, on the global board', async () => {
    ActionItemService.getGlobal.mockResolvedValue(items);

    const { result } = renderHook(() =>
      useActionItems({ mode: 'global', timeHorizon: 'all', showCompleted: true })
    );

    await waitFor(() => expect(ActionItemService.getGlobal).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

    const ids = result.current.actionItems.map((item) => item.id).sort();
    expect(ids).toEqual([1, 2, 3]);
    expect(result.current.columns.completed.map((i) => i.id).sort()).toEqual([2, 3]);
  });

  test('project mode keeps hiding completed items when showCompleted=false (unchanged behavior)', async () => {
    projectService.getActionItems.mockResolvedValue({ data: items });

    const { result } = renderHook(() =>
      useActionItems({
        mode: 'project',
        projectId: 42,
        timeHorizon: 'all',
        showCompleted: false,
      })
    );

    await waitFor(() => expect(projectService.getActionItems).toHaveBeenCalled(), {
      timeout: 2000,
    });
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 2000 });

    const ids = result.current.actionItems.map((item) => item.id);
    expect(ids).toEqual([1]);
  });
});

// ============================== Bug 6: status preserved on edit in meeting mode ==============================

describe('useActionItems - updateActionItem preserves status in meeting mode', () => {
  const initialItems = [
    { id: 10, task: 'In progress task', status: 'in_progress', owner: 'Alice', priority: 'medium' },
  ];

  test('editing a task (without sending status) keeps it in the in-progress column', async () => {
    // Simulate the backend PUT response: it returns the full item with the
    // *unchanged* status, using the raw underscore format straight from the DB.
    ActionItemService.update.mockResolvedValue({
      id: 10,
      task: 'In progress task (edited)',
      status: 'in_progress',
      owner: 'Bob',
      priority: 'high',
    });

    const { result } = renderHook(() =>
      useActionItems({ mode: 'meeting', transcriptionId: 99, initialItems })
    );

    // Meeting mode seeds items synchronously from initialItems.
    expect(result.current.columns['in-progress']).toHaveLength(1);
    expect(result.current.columns.pending).toHaveLength(0);

    let success;
    await act(async () => {
      success = await result.current.updateActionItem(10, {
        task: 'In progress task (edited)',
        owner: 'Bob',
        priority: 'high',
        due_date: null,
      });
    });

    expect(success).toBe(true);
    // The payload sent to the backend must not include a status field
    // (exclude_unset on the backend relies on this to leave status alone).
    expect(ActionItemService.update).toHaveBeenCalledWith(
      10,
      expect.not.objectContaining({ status: expect.anything() })
    );

    // The item must still be grouped under "in-progress", not reset to "pending".
    expect(result.current.columns.pending).toHaveLength(0);
    expect(result.current.columns['in-progress']).toHaveLength(1);
    expect(result.current.columns['in-progress'][0].owner).toBe('Bob');
  });
});
