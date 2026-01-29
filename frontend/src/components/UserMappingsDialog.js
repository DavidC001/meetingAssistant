import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Box,
  Typography,
  Chip,
  Alert,
  Snackbar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

const UserMappingsDialog = ({ open, onClose, userEmail }) => {
  const [mappings, setMappings] = useState([]);
  const [unmappedNames, setUnmappedNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (open) {
      fetchMappings();
      fetchSuggestions();
    }
  }, [open]);

  const fetchMappings = async () => {
    try {
      const response = await fetch('/api/v1/user-mappings/');
      if (response.ok) {
        const data = await response.json();
        setMappings(data);
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
      showSnackbar('Error loading mappings', 'error');
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('/api/v1/user-mappings/suggest');
      if (response.ok) {
        const data = await response.json();
        setUnmappedNames(data.unmapped_names || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/user-mappings/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showSnackbar('Mapping deleted successfully', 'success');
        fetchMappings();
        fetchSuggestions();
      } else {
        showSnackbar('Failed to delete mapping', 'error');
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      showSnackbar('Error deleting mapping', 'error');
    }
  };

  const handleEdit = (mapping) => {
    setEditingId(mapping.id);
    setEditName(mapping.name);
    setEditEmail(mapping.email);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/v1/user-mappings/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          is_active: true,
        }),
      });

      if (response.ok) {
        showSnackbar('Mapping updated successfully', 'success');
        setEditingId(null);
        fetchMappings();
      } else {
        showSnackbar('Failed to update mapping', 'error');
      }
    } catch (error) {
      console.error('Error updating mapping:', error);
      showSnackbar('Error updating mapping', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
  };

  const handleAdd = async () => {
    if (!newName || !newEmail) {
      showSnackbar('Please fill in both name and email', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/v1/user-mappings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          is_active: true,
        }),
      });

      if (response.ok) {
        showSnackbar('Mapping created successfully', 'success');
        setShowAddForm(false);
        setNewName('');
        setNewEmail('');
        fetchMappings();
        fetchSuggestions();
      } else {
        const error = await response.json();
        showSnackbar(error.detail || 'Failed to create mapping', 'error');
      }
    } catch (error) {
      console.error('Error creating mapping:', error);
      showSnackbar('Error creating mapping', 'error');
    }
  };

  const handleQuickAdd = (name) => {
    setNewName(name);
    setNewEmail(userEmail || '');
    setShowAddForm(true);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">User Name Mappings</Typography>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              size="small"
              onClick={() => setShowAddForm(true)}
            >
              Add Mapping
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Map person names (as they appear in action items) to email addresses for proper task
            filtering.
          </Typography>

          {/* Add Form */}
          {showAddForm && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" gutterBottom>
                New Mapping
              </Typography>
              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  label="Person Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g., Davide Cavicchini"
                />
                <TextField
                  label="Email Address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  size="small"
                  fullWidth
                  type="email"
                  placeholder="e.g., davide@example.com"
                />
                <Button variant="contained" onClick={handleAdd} size="small">
                  Save
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName('');
                    setNewEmail('');
                  }}
                  size="small"
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          )}

          {/* Suggestions */}
          {unmappedNames.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AutoFixHighIcon fontSize="small" />
                <Typography variant="subtitle2">
                  Suggested Mappings ({unmappedNames.length} unmapped names found)
                </Typography>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {unmappedNames.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    onClick={() => handleQuickAdd(name)}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Click a name to quickly map it to your email
              </Typography>
            </Paper>
          )}

          {/* Existing Mappings Table */}
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Person Name</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Email Address</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Actions</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No mappings yet. Add one to get started!
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  mappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell>
                        {editingId === mapping.id ? (
                          <TextField
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            size="small"
                            fullWidth
                          />
                        ) : (
                          mapping.name
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === mapping.id ? (
                          <TextField
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            size="small"
                            fullWidth
                            type="email"
                          />
                        ) : (
                          mapping.email
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingId === mapping.id ? (
                          <>
                            <Button size="small" onClick={handleSaveEdit}>
                              Save
                            </Button>
                            <Button size="small" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(mapping)}
                              title="Edit"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(mapping.id)}
                              title="Delete"
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default UserMappingsDialog;
