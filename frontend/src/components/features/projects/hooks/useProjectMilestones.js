import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { projectService } from '../../../../services';

const emptyFormState = {
  name: '',
  description: '',
  due_date: '',
  color: '#1976d2',
  status: 'pending',
};

const useProjectMilestones = ({ projectIdProp } = {}) => {
  const params = useParams();
  const projectId = projectIdProp || params.projectId;
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [formState, setFormState] = useState(emptyFormState);
  const [saving, setSaving] = useState(false);

  // ConfirmDialog state for delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [projectResponse, milestonesResponse] = await Promise.all([
          projectService.getProject(projectId),
          projectService.getMilestones(projectId),
        ]);
        setProject(projectResponse.data);
        setMilestones(milestonesResponse.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load milestones');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  const isOverdue = (milestone) => {
    if (!milestone?.due_date) return false;
    if (milestone.status === 'completed') return false;
    return new Date(milestone.due_date) < new Date();
  };

  const stats = useMemo(() => {
    const total = milestones.length;
    const completed = milestones.filter((m) => m.status === 'completed').length;
    const overdue = milestones.filter((m) => isOverdue(m)).length;
    const pending = milestones.filter((m) => m.status !== 'completed' && !isOverdue(m)).length;
    return { total, completed, overdue, pending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones]);

  const filteredMilestones = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return milestones
      .filter((milestone) => {
        if (!query) return true;
        return (
          milestone.name?.toLowerCase().includes(query) ||
          milestone.description?.toLowerCase().includes(query)
        );
      })
      .filter((milestone) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'overdue') return isOverdue(milestone);
        return milestone.status === statusFilter;
      })
      .sort((a, b) => {
        const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones, searchQuery, statusFilter]);

  const openCreateDialog = () => {
    setEditingMilestone(null);
    setFormState(emptyFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (milestone) => {
    setEditingMilestone(milestone);
    setFormState({
      name: milestone.name || '',
      description: milestone.description || '',
      due_date: milestone.due_date ? format(new Date(milestone.due_date), 'yyyy-MM-dd') : '',
      color: milestone.color || '#1976d2',
      status: milestone.status || 'pending',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formState.name.trim()) {
      setError('Milestone name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: formState.name.trim(),
        description: formState.description?.trim() || null,
        due_date: formState.due_date
          ? new Date(`${formState.due_date}T00:00:00`).toISOString()
          : null,
        color: formState.color || null,
      };

      if (editingMilestone) {
        const response = await projectService.updateMilestone(projectId, editingMilestone.id, {
          ...payload,
          status: formState.status,
        });
        setMilestones((prev) =>
          prev.map((milestone) =>
            milestone.id === editingMilestone.id ? response.data : milestone
          )
        );
      } else {
        const response = await projectService.createMilestone(projectId, payload);
        setMilestones((prev) => [...prev, response.data]);
      }

      setDialogOpen(false);
      setEditingMilestone(null);
      setFormState(emptyFormState);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save milestone');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (milestoneId) => {
    setPendingDeleteId(milestoneId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteConfirmOpen(false);
    try {
      await projectService.deleteMilestone(projectId, pendingDeleteId);
      setMilestones((prev) => prev.filter((milestone) => milestone.id !== pendingDeleteId));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete milestone');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const handleComplete = async (milestoneId) => {
    try {
      const response = await projectService.completeMilestone(projectId, milestoneId);
      setMilestones((prev) =>
        prev.map((milestone) => (milestone.id === milestoneId ? response.data : milestone))
      );
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to complete milestone');
    }
  };

  const getStatusColor = (status, overdue) => {
    if (status === 'completed') return 'success';
    if (overdue) return 'error';
    if (status === 'missed') return 'error';
    return 'default';
  };

  const formatDueDate = (value) => {
    if (!value) return 'No due date';
    return format(new Date(value), 'MMM dd, yyyy');
  };

  return {
    projectId,
    project,
    milestones,
    loading,
    error,
    setError,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dialogOpen,
    setDialogOpen,
    editingMilestone,
    formState,
    setFormState,
    saving,
    deleteConfirmOpen,
    filteredMilestones,
    stats,
    isOverdue,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleComplete,
    getStatusColor,
    formatDueDate,
    navigate,
  };
};

export default useProjectMilestones;
