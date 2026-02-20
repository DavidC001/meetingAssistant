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
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Key as KeyIcon,
} from '@mui/icons-material';
import ConfirmDialog from '../../../common/ConfirmDialog';
import useAPIKeyManagement from '../hooks/useAPIKeyManagement';

const APIKeyManagementContainer = () => {
  const {
    apiKeys,
    dialogOpen,
    isEditing,
    isLoading,
    isSaving,
    snackbar,
    setSnackbar,
    formData,
    providers,
    deleteConfirmOpen,
    handleFormChange,
    handleOpenDialog,
    handleCloseDialog,
    handleSaveApiKey,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useAPIKeyManagement();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          API Key Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add API Key
        </Button>
      </Box>

      <Card>
        <CardContent>
          {apiKeys.length === 0 ? (
            <Alert severity="info">
              No API keys configured. Click &quot;Add API Key&quot; to create your first API key
              configuration.
            </Alert>
          ) : (
            <List>
              {apiKeys.map((apiKey) => {
                const isEnvironmentKey = apiKey.id < 0;

                return (
                  <ListItem key={apiKey.id} divider>
                    <Box display="flex" alignItems="center" mr={2}>
                      <KeyIcon color="primary" />
                    </Box>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1">{apiKey.name}</Typography>
                          <Chip
                            label={apiKey.provider}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {isEnvironmentKey && (
                            <Chip
                              label="Environment"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                          {!apiKey.is_active && (
                            <Chip label="Inactive" size="small" color="error" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Environment Variable: {apiKey.environment_variable}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Key Value: {apiKey.masked_value || '****'}
                          </Typography>
                          {apiKey.description && (
                            <Typography variant="body2" color="textSecondary">
                              {apiKey.description}
                            </Typography>
                          )}
                          {isEnvironmentKey && (
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              style={{ fontStyle: 'italic' }}
                            >
                              This API key is loaded from environment variables and cannot be edited
                              here.
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {!isEnvironmentKey && (
                        <>
                          <IconButton
                            edge="end"
                            aria-label="edit"
                            onClick={() => handleOpenDialog(apiKey)}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => handleDeleteRequest(apiKey.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? 'Edit API Key' : 'Add API Key'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                required
                placeholder="e.g., OpenAI Production"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={formData.provider}
                  onChange={(e) => handleFormChange('provider', e.target.value)}
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Environment Variable"
                value={formData.environment_variable}
                onChange={(e) => handleFormChange('environment_variable', e.target.value)}
                required
                placeholder="e.g., OPENAI_API_KEY"
                helperText="The environment variable name that contains the actual API key"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="API Key Value"
                value={formData.key_value}
                onChange={(e) => handleFormChange('key_value', e.target.value)}
                placeholder="Enter your API key"
                helperText={
                  isEditing
                    ? 'Leave blank to keep the existing key value'
                    : 'The actual API key that will be saved to the environment'
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                multiline
                rows={2}
                placeholder="Optional description for this API key"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveApiKey}
            disabled={isSaving || !formData.name || !formData.environment_variable}
          >
            {isSaving ? <CircularProgress size={20} /> : isEditing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete API Key"
        message="Are you sure you want to delete this API key?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default APIKeyManagementContainer;
