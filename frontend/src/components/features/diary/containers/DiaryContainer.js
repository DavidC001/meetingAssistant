import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  BarChart as StatisticsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import useDiaryEntry from '../hooks/useDiaryEntry';
import DiaryEditor from '../presentation/DiaryEditor';
import DiaryTimeTracking from '../presentation/DiaryTimeTracking';
import DiaryActionItems from '../presentation/DiaryActionItems';
import ConfirmDialog from '../../../common/ConfirmDialog';
import '../Diary.css';

const DiaryContainer = () => {
  const navigate = useNavigate();

  const {
    entry,
    loading,
    saving,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    content,
    setContent,
    previewMode,
    setPreviewMode,
    productivity,
    setProductivity,
    arrivalTime,
    setArrivalTime,
    departureTime,
    setDepartureTime,
    hoursWorked,
    setHoursWorked,
    actionItemsExpanded,
    setActionItemsExpanded,
    actionItemsSummary,
    showOnlyMyTasks,
    setShowOnlyMyTasks,
    filterUserName,
    setFilterUserName,
    draggedItem,
    isDragging,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    displayDate,
    handleSave,
    handleDeleteConfirmed,
    handlePreviousDay,
    handleNextDay,
    handleToday,
    handleActionItemDragStart,
    handleDragEnd,
    handleContentDrop,
    handleContentDragOver,
    calculateHours,
    filterActionItems,
  } = useDiaryEntry();

  return (
    <Box className="diary-container" p={3}>
      <Paper elevation={2} sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Daily Diary
          </Typography>

          {/* Date Navigation */}
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton
              onClick={() => navigate('/diary/statistics')}
              color="primary"
              title="View Statistics"
            >
              <StatisticsIcon />
            </IconButton>

            <IconButton onClick={handlePreviousDay} title="Previous Day">
              <ChevronLeftIcon />
            </IconButton>

            <Button
              variant="outlined"
              onClick={handleToday}
              startIcon={<TodayIcon />}
              sx={{ minWidth: 120 }}
            >
              Today
            </Button>

            <IconButton onClick={handleNextDay} title="Next Day">
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom color="primary">
          {displayDate}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Left Column */}
            <Grid item xs={12} md={7}>
              <DiaryEditor
                content={content}
                onContentChange={setContent}
                previewMode={previewMode}
                onTogglePreview={() => setPreviewMode(!previewMode)}
                isDragging={isDragging}
                onContentDrop={handleContentDrop}
                onContentDragOver={handleContentDragOver}
                productivity={productivity}
                onProductivityChange={setProductivity}
              />

              <DiaryTimeTracking
                arrivalTime={arrivalTime}
                onArrivalChange={setArrivalTime}
                departureTime={departureTime}
                onDepartureChange={setDepartureTime}
                hoursWorked={hoursWorked}
                onHoursChange={setHoursWorked}
                onBlurCalculate={calculateHours}
              />

              {/* Action Buttons */}
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {entry && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={saving}
                  >
                    Delete
                  </Button>
                )}
              </Box>
            </Grid>

            {/* Right Column - Action Items */}
            <Grid item xs={12} md={5}>
              <DiaryActionItems
                actionItemsSummary={actionItemsSummary}
                actionItemsExpanded={actionItemsExpanded}
                onToggleExpanded={() => setActionItemsExpanded(!actionItemsExpanded)}
                showOnlyMyTasks={showOnlyMyTasks}
                onToggleShowOnlyMine={setShowOnlyMyTasks}
                filterUserName={filterUserName}
                onFilterUserNameChange={setFilterUserName}
                draggedItem={draggedItem}
                onDragStart={handleActionItemDragStart}
                onDragEnd={handleDragEnd}
                filterActionItems={filterActionItems}
              />
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Diary Entry"
        message="Are you sure you want to delete this diary entry? This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </Box>
  );
};

export default DiaryContainer;
