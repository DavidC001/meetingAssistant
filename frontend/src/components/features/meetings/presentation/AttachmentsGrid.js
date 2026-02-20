/**
 * AttachmentsGrid Component
 * Displays meeting attachments with upload, download and delete actions
 */

import React, { useRef, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Box,
  Button,
  IconButton,
  Stack,
  Chip,
  Alert,
  TextField,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Attachment as AttachmentIcon,
  Upload as UploadIcon,
  Visibility as PreviewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { formatFileSize } from '../../../../utils';
import AttachmentService from '../../../../services/attachmentService';

/** MIME types that browsers can preview inline */
const PREVIEWABLE = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
];

const isPreviewable = (mimeType) =>
  mimeType && PREVIEWABLE.some((t) => mimeType.startsWith(t.split('/')[0]) || mimeType === t);

/**
 * AttachmentsGrid Component
 * @param {Object} props
 * @param {Array} props.attachments - Array of attachment objects
 * @param {boolean} props.isLoading - Whether attachments are loading
 * @param {Function} props.onDownload - Callback to download an attachment (attachmentId) => Promise<void>
 * @param {Function} props.onDelete - Callback to delete an attachment (attachmentId) => Promise<void>
 * @param {Function} props.onUpload - Callback to upload a new attachment (file, description) => Promise<boolean>
 */
export const AttachmentsGrid = ({
  attachments = [],
  isLoading = false,
  onDownload,
  onDelete,
  onUpload,
}) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    // reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !onUpload) return;
    setIsUploading(true);
    const ok = await onUpload(selectedFile, description);
    if (ok) {
      setSelectedFile(null);
      setDescription('');
    }
    setIsUploading(false);
  };

  return (
    <>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Attachments {attachments.length > 0 && `(${attachments.length})`}
          </Typography>

          {/* Upload section */}
          {onUpload && (
            <>
              <Box
                sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', mb: 2, flexWrap: 'wrap' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? selectedFile.name : 'Choose File'}
                </Button>
                {selectedFile && (
                  <TextField
                    size="small"
                    label="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    sx={{ flex: 1, minWidth: 180 }}
                  />
                )}
                {selectedFile && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<UploadIcon />}
                    onClick={handleUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading…' : 'Upload'}
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
            </>
          )}

          {isLoading ? (
            <Typography color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>
              Loading attachments...
            </Typography>
          ) : attachments.length === 0 ? (
            <Alert severity="info">No attachments yet.</Alert>
          ) : (
            <Grid container spacing={2}>
              {attachments.map((attachment) => (
                <Grid item xs={12} sm={6} md={4} key={attachment.id}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                      <AttachmentIcon
                        fontSize="small"
                        sx={{ mr: 1, mt: 0.5, color: 'primary.main' }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight="bold"
                          noWrap
                          title={attachment.filename || attachment.name}
                        >
                          {attachment.filename || attachment.name}
                        </Typography>
                        {attachment.description && (
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {attachment.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* File Info */}
                    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                      {attachment.file_size && (
                        <Chip
                          size="small"
                          label={formatFileSize(attachment.file_size)}
                          variant="outlined"
                        />
                      )}
                      {attachment.file_type && (
                        <Chip size="small" label={attachment.file_type} variant="outlined" />
                      )}
                    </Stack>

                    {/* Upload Date */}
                    {attachment.created_at && (
                      <Typography variant="caption" color="textSecondary" sx={{ mb: 2 }}>
                        {new Date(attachment.created_at).toLocaleDateString()}
                      </Typography>
                    )}

                    {/* Actions */}
                    <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                      {isPreviewable(attachment.mime_type) && (
                        <Tooltip title="Preview">
                          <IconButton
                            size="small"
                            onClick={() => setPreviewAttachment(attachment)}
                            color="info"
                          >
                            <PreviewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => onDownload?.(attachment.id)}
                        fullWidth
                      >
                        Download
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => onDelete?.(attachment.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {previewAttachment && (
        <Dialog
          open
          onClose={() => setPreviewAttachment(null)}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { height: '90vh' } }}
        >
          <DialogTitle
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
              <AttachmentIcon color="primary" />
              <Typography noWrap variant="h6" title={previewAttachment.filename}>
                {previewAttachment.filename}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Download">
                <IconButton onClick={() => onDownload?.(previewAttachment.id)}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close">
                <IconButton onClick={() => setPreviewAttachment(null)}>
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
            {previewAttachment.mime_type?.startsWith('image/') ? (
              <Box
                component="img"
                src={AttachmentService.getPreviewUrl(previewAttachment.id)}
                alt={previewAttachment.filename}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  m: 'auto',
                  display: 'block',
                  p: 2,
                }}
              />
            ) : (
              <Box
                component="iframe"
                src={AttachmentService.getPreviewUrl(previewAttachment.id)}
                title={previewAttachment.filename}
                sx={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default AttachmentsGrid;
