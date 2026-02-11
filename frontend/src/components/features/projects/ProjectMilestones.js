import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Flag as FlagIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { projectService } from '../../../services';

const emptyFormState = {
  name: '',
  description: '',
  due_date: '',
  color: '#1976d2',
  status: 'pending',
};

const ProjectMilestones = ({ projectId: projectIdProp, embedded = false }) => {
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

  const handleDelete = async (milestoneId) => {
    const confirmed = window.confirm('Delete this milestone? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await projectService.deleteMilestone(projectId, milestoneId);
      setMilestones((prev) => prev.filter((milestone) => milestone.id !== milestoneId));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete milestone');
    }
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !project) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={embedded ? { p: 0 } : { p: 3 }}>
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          {!embedded && (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/projects/${projectId}`)}
              sx={{ mb: 1 }}
            >
              Back to Project
            </Button>
          )}
          <Typography variant={embedded ? 'h5' : 'h4'} gutterBottom>
            {project?.name} - Milestones
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track progress with project milestones and deadlines
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Milestone
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <FlagIcon color="primary" />
                <Typography variant="h6">Total</Typography>
              </Box>
              <Typography variant="h4">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">
                milestones tracked
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <CheckCircleIcon color="success" />
                <Typography variant="h6">Completed</Typography>
              </Box>
              <Typography variant="h4">{stats.completed}</Typography>
              <Typography variant="body2" color="text.secondary">
                finished milestones
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <FlagIcon color="action" />
                <Typography variant="h6">Upcoming</Typography>
              </Box>
              <Typography variant="h4">{stats.pending}</Typography>
              <Typography variant="body2" color="text.secondary">
                pending milestones
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <FlagIcon color="error" />
                <Typography variant="h6">Overdue</Typography>
              </Box>
              <Typography variant="h4">{stats.overdue}</Typography>
              <Typography variant="body2" color="text.secondary">
                past due dates
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            fullWidth
            placeholder="Search milestones by name or description..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="missed">Missed</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Milestone</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMilestones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" py={4}>
                    No milestones found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredMilestones.map((milestone) => {
                const overdue = isOverdue(milestone);
                const statusLabel = overdue ? 'overdue' : milestone.status || 'pending';
                return (
                  <TableRow key={milestone.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: milestone.color || 'primary.main',
                          }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {milestone.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{formatDueDate(milestone.due_date)}</TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabel}
                        size="small"
                        color={getStatusColor(milestone.status, overdue)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {milestone.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {milestone.status !== 'completed' && (
                          <Tooltip title="Mark completed">
                            <IconButton size="small" onClick={() => handleComplete(milestone.id)}>
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit milestone">
                          <IconButton size="small" onClick={() => openEditDialog(milestone)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete milestone">
                          <IconButton size="small" onClick={() => handleDelete(milestone.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMilestone ? 'Edit Milestone' : 'Create Milestone'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Milestone name"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, description: event.target.value }))
              }
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="Due date"
              type="date"
              value={formState.due_date}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, due_date: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Color"
              type="color"
              value={formState.color}
              onChange={(event) => setFormState((prev) => ({ ...prev, color: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            {editingMilestone && (
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, status: event.target.value }))
                  }
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="missed">Missed</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectMilestones;
