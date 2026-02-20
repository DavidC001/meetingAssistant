import React from 'react';
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
import ConfirmDialog from '../../../common/ConfirmDialog';
import useProjectMilestones from '../hooks/useProjectMilestones';

const ProjectMilestonesContainer = ({ projectId: projectIdProp, embedded = false }) => {
  const {
    projectId,
    project,
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
  } = useProjectMilestones({ projectIdProp });

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
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteRequest(milestone.id)}
                          >
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

      {/* Create/Edit dialog */}
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

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Milestone"
        message="Delete this milestone? This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
};

export default ProjectMilestonesContainer;
