import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Alert,
  Tooltip,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon
} from '@mui/icons-material';
import api from '../api';

const TEMPLATE_TYPES = [
  { value: 'standup', label: 'Daily Standup', icon: '🌅' },
  { value: 'retrospective', label: 'Retrospective', icon: '🔄' },
  { value: '1on1', label: '1:1 Meeting', icon: '👥' },
  { value: 'brainstorm', label: 'Brainstorming', icon: '💡' },
  { value: 'planning', label: 'Planning', icon: '📅' },
  { value: 'review', label: 'Review', icon: '📊' },
  { value: 'custom', label: 'Custom', icon: '📋' },
];

const MeetingTemplates = ({ onSelectTemplate }) => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template_type: 'custom',
    default_language: 'en-US',
    default_speakers: 'auto',
    default_folder: '',
    default_tags: '',
    expected_speakers: [],
    summary_sections: [],
    action_item_categories: [],
    icon: '📋',
    color: '#1976d2'
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/templates/');
      setTemplates(response.data);
    } catch (err) {
      console.error('Error fetching templates:', err);
      // Initialize defaults if none exist
      try {
        await api.post('/api/v1/templates/initialize-defaults');
        const response = await api.get('/api/v1/templates/');
        setTemplates(response.data);
      } catch (initErr) {
        setError('Failed to load templates');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenDialog = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        template_type: template.template_type,
        default_language: template.default_language || 'en-US',
        default_speakers: template.default_speakers || 'auto',
        default_folder: template.default_folder || '',
        default_tags: template.default_tags || '',
        expected_speakers: template.expected_speakers || [],
        summary_sections: template.summary_sections || [],
        action_item_categories: template.action_item_categories || [],
        icon: template.icon || '📋',
        color: template.color || '#1976d2'
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        template_type: 'custom',
        default_language: 'en-US',
        default_speakers: 'auto',
        default_folder: '',
        default_tags: '',
        expected_speakers: [],
        summary_sections: [],
        action_item_categories: [],
        icon: '📋',
        color: '#1976d2'
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        await api.put(`/api/v1/templates/${editingTemplate.id}`, formData);
      } else {
        await api.post('/api/v1/templates/', formData);
      }
      setDialogOpen(false);
      fetchTemplates();
    } catch (err) {
      setError('Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/api/v1/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  const handleUseTemplate = async (template) => {
    try {
      await api.post(`/api/v1/templates/${template.id}/use`);
      
      // Store template in sessionStorage to be picked up by UploadForm
      sessionStorage.setItem('selectedTemplate', JSON.stringify(template));
      
      // Navigate to dashboard (which includes upload form)
      navigate('/');
      
      if (onSelectTemplate) {
        onSelectTemplate(template);
      }
    } catch (err) {
      console.error('Error recording template usage:', err);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          📋 Meeting Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Template
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Grid container spacing={3}>
        {templates.map(template => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: 4,
                borderColor: template.color || 'primary.main',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="h4" component="span">
                    {template.icon}
                  </Typography>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {template.name}
                    </Typography>
                    {template.is_default && (
                      <Chip label="Default" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
                    )}
                  </Box>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {template.description}
                </Typography>

                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {template.default_folder && (
                    <Chip label={`📁 ${template.default_folder}`} size="small" variant="outlined" />
                  )}
                  {template.summary_sections?.slice(0, 2).map((section, i) => (
                    <Chip key={i} label={section} size="small" variant="outlined" />
                  ))}
                  {template.summary_sections?.length > 2 && (
                    <Chip label={`+${template.summary_sections.length - 2}`} size="small" />
                  )}
                </Stack>
              </CardContent>

              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Button 
                  variant="contained" 
                  size="small"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
                <Box>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleOpenDialog(template)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {!template.is_default && (
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(template.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            <FormControl fullWidth>
              <InputLabel>Template Type</InputLabel>
              <Select
                value={formData.template_type}
                onChange={(e) => {
                  const type = TEMPLATE_TYPES.find(t => t.value === e.target.value);
                  setFormData({ 
                    ...formData, 
                    template_type: e.target.value,
                    icon: type?.icon || '📋'
                  });
                }}
                label="Template Type"
              >
                {TEMPLATE_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Default Folder"
                  value={formData.default_folder}
                  onChange={(e) => setFormData({ ...formData, default_folder: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Default Tags"
                  value={formData.default_tags}
                  onChange={(e) => setFormData({ ...formData, default_tags: e.target.value })}
                  fullWidth
                  placeholder="tag1, tag2"
                />
              </Grid>
            </Grid>

            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={formData.summary_sections}
              onChange={(e, value) => setFormData({ ...formData, summary_sections: value })}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} size="small" />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} label="Summary Sections" placeholder="Add section" />
              )}
            />

            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={formData.action_item_categories}
              onChange={(e, value) => setFormData({ ...formData, action_item_categories: value })}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} size="small" />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} label="Action Item Categories" placeholder="Add category" />
              )}
            />

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="Icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                sx={{ width: 100 }}
                inputProps={{ maxLength: 2 }}
              />
              <TextField
                label="Color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                sx={{ width: 100 }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name.trim()}>
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingTemplates;
