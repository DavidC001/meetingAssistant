/**
 * useProjectMembers
 * Manages project team member CRUD — list, add, edit, delete, sync.
 */

import { useState, useCallback } from 'react';
import { projectService } from '../../../../services/projectService';
import logger from '../../../../utils/logger';

export const useProjectMembers = (projectId) => {
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Add dialog state
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  // Edit dialog state
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  // Shared form data
  const [memberFormData, setMemberFormData] = useState({ name: '', email: '', role: 'member' });
  // Confirm delete
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState(null);

  const loadMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      const response = await projectService.getMembers(projectId);
      setMembers(response.data || []);
    } catch (err) {
      logger.error('Failed to load members:', err);
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  const handleSyncMembers = useCallback(async () => {
    try {
      setSyncing(true);
      await projectService.syncMembers(projectId);
      await loadMembers();
    } catch (err) {
      logger.error('Failed to sync members:', err);
    } finally {
      setSyncing(false);
    }
  }, [projectId, loadMembers]);

  const openAddMemberDialog = useCallback(() => {
    setMemberFormData({ name: '', email: '', role: 'member' });
    setAddMemberDialogOpen(true);
  }, []);

  const closeAddMemberDialog = useCallback(() => setAddMemberDialogOpen(false), []);

  const handleAddMember = useCallback(async () => {
    try {
      await projectService.addMember(projectId, memberFormData);
      await loadMembers();
      setAddMemberDialogOpen(false);
      setMemberFormData({ name: '', email: '', role: 'member' });
    } catch (err) {
      logger.error('Failed to add member:', err);
    }
  }, [projectId, memberFormData, loadMembers]);

  const openEditMemberDialog = useCallback((member) => {
    setSelectedMember(member);
    setMemberFormData({ name: member.name, email: member.email || '', role: member.role });
    setEditMemberDialogOpen(true);
  }, []);

  const closeEditMemberDialog = useCallback(() => {
    setEditMemberDialogOpen(false);
    setSelectedMember(null);
    setMemberFormData({ name: '', email: '', role: 'member' });
  }, []);

  const handleEditMember = useCallback(async () => {
    try {
      await projectService.updateMember(projectId, selectedMember.id, {
        role: memberFormData.role,
      });
      await loadMembers();
      closeEditMemberDialog();
    } catch (err) {
      logger.error('Failed to update member:', err);
    }
  }, [projectId, selectedMember, memberFormData, loadMembers, closeEditMemberDialog]);

  const requestDeleteMember = useCallback((memberId) => setConfirmDeleteMemberId(memberId), []);
  const cancelDeleteMember = useCallback(() => setConfirmDeleteMemberId(null), []);

  const handleDeleteMember = useCallback(async () => {
    if (!confirmDeleteMemberId) return;
    try {
      await projectService.removeMember(projectId, confirmDeleteMemberId);
      await loadMembers();
    } catch (err) {
      logger.error('Failed to remove member:', err);
    } finally {
      setConfirmDeleteMemberId(null);
    }
  }, [projectId, confirmDeleteMemberId, loadMembers]);

  return {
    members,
    membersLoading,
    syncing,
    // Add dialog
    addMemberDialogOpen,
    openAddMemberDialog,
    closeAddMemberDialog,
    handleAddMember,
    // Edit dialog
    editMemberDialogOpen,
    selectedMember,
    openEditMemberDialog,
    closeEditMemberDialog,
    handleEditMember,
    // Shared form data
    memberFormData,
    setMemberFormData,
    // Delete confirm
    confirmDeleteMemberId,
    requestDeleteMember,
    cancelDeleteMember,
    handleDeleteMember,
    // Actions
    loadMembers,
    handleSyncMembers,
  };
};
