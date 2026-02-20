import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

/**
 * Content for the RAG & Embeddings tab (tab index 1).
 * Handles embedding config list, new config form, and worker scaling.
 */
const EmbeddingTab = ({
  // Embedding config
  embeddingConfigs,
  activeEmbeddingId,
  embeddingForm,
  modelValidation,
  embeddingLoading,
  onEmbeddingFormChange,
  onCreateEmbeddingConfig,
  onValidateModel,
  onActivateConfig,
  onDeleteConfig,
  onRecomputeEmbeddings,
  // Worker config
  workerConfig,
  setWorkerConfig,
  workerSaving,
  onWorkerSave,
}) => {
  const [recomputeLoading, setRecomputeLoading] = useState(false);

  return (
    <Box sx={{ p: 4 }}>
      <Grid container spacing={4}>
        {/* Embedding Configuration */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <MemoryIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" fontWeight="600" gutterBottom>
                    Embedding Models
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure models for semantic search and RAG
                  </Typography>
                </Box>
                <Box sx={{ ml: 'auto' }}>
                  <Button
                    variant="outlined"
                    startIcon={recomputeLoading ? <CircularProgress size={18} /> : <RefreshIcon />}
                    onClick={() => onRecomputeEmbeddings(setRecomputeLoading)}
                    disabled={recomputeLoading}
                    sx={{ borderRadius: 2 }}
                  >
                    {recomputeLoading ? 'Recomputing...' : 'Recompute All'}
                  </Button>
                </Box>
              </Box>

              {embeddingLoading ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container spacing={3}>
                  {/* Active Configurations List */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom fontWeight="600">
                      Active Configurations
                    </Typography>
                    <List sx={{ bgcolor: 'action.hover', borderRadius: 2 }}>
                      {embeddingConfigs.length === 0 && (
                        <ListItem>
                          <ListItemText
                            primary="No embedding configurations"
                            secondary="Create a configuration to enable RAG features"
                          />
                        </ListItem>
                      )}
                      {embeddingConfigs.map((config) => (
                        <ListItem key={config.id} alignItems="flex-start" divider>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                  {config.model_name}
                                </Typography>
                                {config.id === activeEmbeddingId && (
                                  <Chip label="Active" color="success" size="small" />
                                )}
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  Provider: {config.provider} • Dimension: {config.dimension}
                                </Typography>
                                {config.base_url && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                  >
                                    Base URL: {config.base_url}
                                  </Typography>
                                )}
                              </>
                            }
                          />
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={config.id === activeEmbeddingId}
                              onClick={() => onActivateConfig(config.id)}
                            >
                              Activate
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              onClick={() => onDeleteConfig(config.id)}
                            >
                              Delete
                            </Button>
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  </Grid>

                  {/* Add New Configuration Form */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom fontWeight="600">
                      Add New Configuration
                    </Typography>
                    <Paper sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel id="embedding-provider-label">Provider</InputLabel>
                            <Select
                              labelId="embedding-provider-label"
                              label="Provider"
                              value={embeddingForm.provider}
                              onChange={(e) => onEmbeddingFormChange('provider', e.target.value)}
                            >
                              <MenuItem value="sentence-transformers">
                                Sentence Transformers
                              </MenuItem>
                              <MenuItem value="openai">OpenAI</MenuItem>
                              <MenuItem value="ollama">Ollama</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <TextField
                              label="Model name"
                              fullWidth
                              size="small"
                              value={embeddingForm.model_name}
                              onChange={(e) => onEmbeddingFormChange('model_name', e.target.value)}
                              placeholder={
                                embeddingForm.provider === 'sentence-transformers'
                                  ? 'e.g., sentence-transformers/all-MiniLM-L6-v2'
                                  : embeddingForm.provider === 'openai'
                                    ? 'e.g., text-embedding-3-small'
                                    : 'e.g., nomic-embed-text'
                              }
                            />
                            {embeddingForm.provider === 'sentence-transformers' && (
                              <Button
                                variant="contained"
                                size="small"
                                onClick={onValidateModel}
                                disabled={modelValidation.status === 'checking'}
                                sx={{ minWidth: 100, height: 40 }}
                              >
                                {modelValidation.status === 'checking' ? 'Checking…' : 'Validate'}
                              </Button>
                            )}
                          </Box>
                          {embeddingForm.provider === 'sentence-transformers' && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.5 }}
                            >
                              Click Validate to auto-detect dimension from HuggingFace
                            </Typography>
                          )}
                          {embeddingForm.provider === 'sentence-transformers' &&
                            modelValidation.status !== 'idle' && (
                              <Typography
                                variant="caption"
                                sx={{ display: 'block', mt: 0.5 }}
                                color={
                                  modelValidation.status === 'valid'
                                    ? 'success.main'
                                    : modelValidation.status === 'checking'
                                      ? 'text.secondary'
                                      : 'error.main'
                                }
                              >
                                {modelValidation.message}
                              </Typography>
                            )}
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Vector dimension"
                            type="number"
                            fullWidth
                            size="small"
                            value={embeddingForm.dimension}
                            onChange={(e) => onEmbeddingFormChange('dimension', e.target.value)}
                            helperText={
                              embeddingForm.provider === 'sentence-transformers'
                                ? 'Auto-filled when model is validated'
                                : 'Enter manually for this provider'
                            }
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ height: 40 }} />
                        </Grid>

                        {embeddingForm.provider === 'ollama' && (
                          <Grid item xs={12}>
                            <TextField
                              label="Base URL"
                              fullWidth
                              size="small"
                              value={embeddingForm.base_url}
                              onChange={(e) => onEmbeddingFormChange('base_url', e.target.value)}
                              placeholder="http://worker:11434"
                            />
                          </Grid>
                        )}

                        <Grid item xs={12}>
                          <TextField
                            label="Extra settings (JSON)"
                            fullWidth
                            size="small"
                            multiline
                            minRows={2}
                            value={embeddingForm.settings}
                            onChange={(e) => onEmbeddingFormChange('settings', e.target.value)}
                            placeholder='{ "device": "cpu" }'
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={embeddingForm.is_active}
                                onChange={(e) =>
                                  onEmbeddingFormChange('is_active', e.target.checked)
                                }
                              />
                            }
                            label="Activate immediately"
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <Button
                            variant="contained"
                            onClick={onCreateEmbeddingConfig}
                            sx={{ borderRadius: 2 }}
                            fullWidth
                          >
                            Save Configuration
                          </Button>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Worker Scaling */}
        <Grid item xs={12}>
          <Card elevation={2} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <StorageIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" fontWeight="600" gutterBottom>
                    Worker Scaling
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Control parallel embedding computation workers
                  </Typography>
                </Box>
              </Box>
              <Paper sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current workers: {workerConfig.max_workers}
                </Typography>
                <Slider
                  value={workerConfig.max_workers}
                  min={1}
                  max={10}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_, value) =>
                    setWorkerConfig({ max_workers: Array.isArray(value) ? value[0] : value })
                  }
                />
                <Button
                  variant="contained"
                  sx={{ mt: 2, borderRadius: 2 }}
                  onClick={onWorkerSave}
                  disabled={workerSaving}
                  startIcon={workerSaving ? <CircularProgress size={18} /> : <SaveIcon />}
                >
                  {workerSaving ? 'Updating...' : 'Apply Worker Limit'}
                </Button>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmbeddingTab;
