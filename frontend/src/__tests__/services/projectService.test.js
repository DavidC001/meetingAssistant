/**
 * Tests for projectService.
 */
import { projectService } from '../../services/projectService';
import apiClient from '../../services/apiClient';

jest.mock('../../services/apiClient', () => {
  const client = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
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

const API = '/api/v1/projects';

describe('projectService', () => {
  // CRUD
  test('listProjects calls GET /', () => {
    projectService.listProjects('active');
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/`, { params: { status: 'active' } });
  });

  test('createProject calls POST /', () => {
    projectService.createProject({ name: 'P1' });
    expect(apiClient.post).toHaveBeenCalledWith(`${API}/`, { name: 'P1' });
  });

  test('getProject calls GET /:id', () => {
    projectService.getProject(1);
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1`);
  });

  test('updateProject calls PUT /:id', () => {
    projectService.updateProject(1, { name: 'Updated' });
    expect(apiClient.put).toHaveBeenCalledWith(`${API}/1`, { name: 'Updated' });
  });

  test('deleteProject calls DELETE with params', () => {
    projectService.deleteProject(1, true);
    expect(apiClient.delete).toHaveBeenCalledWith(`${API}/1`, {
      params: { delete_meetings: true },
    });
  });

  // Meetings
  test('getProjectMeetings calls GET /:id/meetings', () => {
    projectService.getProjectMeetings(1, { status: 'completed' });
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/meetings`, {
      params: { status: 'completed' },
    });
  });

  test('addMeetingToProject calls POST', () => {
    projectService.addMeetingToProject(1, 5);
    expect(apiClient.post).toHaveBeenCalledWith(`${API}/1/meetings/5`);
  });

  test('removeMeetingFromProject calls DELETE', () => {
    projectService.removeMeetingFromProject(1, 5);
    expect(apiClient.delete).toHaveBeenCalledWith(`${API}/1/meetings/5`);
  });

  // Members
  test('getMembers', () => {
    projectService.getMembers(1);
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/members`);
  });

  test('addMember', () => {
    projectService.addMember(1, { name: 'Alice' });
    expect(apiClient.post).toHaveBeenCalledWith(`${API}/1/members`, { name: 'Alice' });
  });

  test('updateMember', () => {
    projectService.updateMember(1, 2, { role: 'lead' });
    expect(apiClient.put).toHaveBeenCalledWith(`${API}/1/members/2`, { role: 'lead' });
  });

  test('removeMember', () => {
    projectService.removeMember(1, 2);
    expect(apiClient.delete).toHaveBeenCalledWith(`${API}/1/members/2`);
  });

  test('syncMembers', () => {
    projectService.syncMembers(1);
    expect(apiClient.post).toHaveBeenCalledWith(`${API}/1/members/sync`);
  });

  // Milestones
  test('getMilestones', () => {
    projectService.getMilestones(1);
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/milestones`);
  });

  test('createMilestone', () => {
    projectService.createMilestone(1, { name: 'MS1' });
    expect(apiClient.post).toHaveBeenCalledWith(`${API}/1/milestones`, { name: 'MS1' });
  });

  test('completeMilestone', () => {
    projectService.completeMilestone(1, 2);
    expect(apiClient.post).toHaveBeenCalledWith(`${API}/1/milestones/2/complete`);
  });

  test('deleteMilestone', () => {
    projectService.deleteMilestone(1, 2);
    expect(apiClient.delete).toHaveBeenCalledWith(`${API}/1/milestones/2`);
  });

  // Action Items
  test('getActionItems', () => {
    projectService.getActionItems(1, { status: 'pending' });
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/action-items`, {
      params: { status: 'pending' },
    });
  });

  // Gantt
  test('getGanttData', () => {
    projectService.getGanttData(1);
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/gantt`);
  });

  test('updateGanttItem', () => {
    projectService.updateGanttItem(1, 2, { start: '2024-01-01' });
    expect(apiClient.patch).toHaveBeenCalledWith(`${API}/1/gantt/items/2`, {
      start: '2024-01-01',
    });
  });

  // Analytics
  test('getAnalytics', () => {
    projectService.getAnalytics(1);
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/analytics`);
  });

  test('getActivity', () => {
    projectService.getActivity(1, 10);
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/activity`, { params: { limit: 10 } });
  });

  // Notes
  test('getNotes', () => {
    projectService.getNotes(1);
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/notes`);
  });

  test('createNote', () => {
    projectService.createNote(1, { title: 'Note' });
    expect(apiClient.post).toHaveBeenCalledWith(`${API}/1/notes`, { title: 'Note' });
  });

  test('deleteNote', () => {
    projectService.deleteNote(1, 2);
    expect(apiClient.delete).toHaveBeenCalledWith(`${API}/1/notes/2`);
  });

  // Export
  test('exportProject', () => {
    projectService.exportProject(1, 'pdf');
    expect(apiClient.get).toHaveBeenCalledWith(`${API}/1/export`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    });
  });
});
