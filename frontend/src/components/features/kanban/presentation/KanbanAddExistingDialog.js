/**
 * KanbanAddExistingDialog Component
 * Dialog for linking existing action items to a project (project mode only)
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import { ActionItemService, projectService } from '../../../../services';
import logger from '../../../../utils/logger';

const KanbanAddExistingDialog = ({ open = false, projectId = null, onSave, onCancel }) => {
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAvailableItems = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      // Get all action items from calendar
      const allItems = await ActionItemService.getAll();
      // Get currently linked action items for this project
      const linkedResponse = await projectService.getActionItems(projectId);
      const linkedItems = linkedResponse?.data || [];
      const linkedIds = new Set(linkedItems.map((item) => item.id));
      // Filter out already linked items
      const available = allItems.filter((item) => !linkedIds.has(item.id));
      setAvailableItems(available);
      setSelectedItem(null);
    } catch (error) {
      logger.error('Error fetching available action items:', error);
      setAvailableItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && projectId) {
      fetchAvailableItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleSave = () => {
    if (selectedItem) {
      onSave(selectedItem.id);
      setSelectedItem(null);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Add Existing Action Item to Project</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : availableItems.length === 0 ? (
            <Alert severity="info">
              No available action items to link. All action items are either already linked to this
              project or don't exist.
            </Alert>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Select Action Item</InputLabel>
              <Select
                value={selectedItem?.id || ''}
                label="Select Action Item"
                onChange={(e) => {
                  const item = availableItems.find((item) => item.id === e.target.value);
                  setSelectedItem(item);
                }}
              >
                {availableItems.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {item.task}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.owner} • {item.status} •{' '}
                        {item.due_date
                          ? new Date(item.due_date).toLocaleDateString()
                          : 'No due date'}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!selectedItem}>
          Add to Project
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KanbanAddExistingDialog;
