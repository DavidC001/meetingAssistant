import React from 'react';
import ReactDOM from 'react-dom';
import { Box, IconButton, Paper, Typography, alpha } from '@mui/material';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { Add as AddIcon } from '@mui/icons-material';
import ActionItemCard from './ActionItemCard';

const PortalAwareItem = ({ provided, snapshot, children }) => {
  const usePortal = snapshot.isDragging;

  const child = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={provided.draggableProps.style}
    >
      {children}
    </div>
  );

  if (!usePortal) {
    return child;
  }

  return ReactDOM.createPortal(child, document.body);
};

const KanbanColumn = ({
  columnId,
  tasks,
  config,
  allowAdd,
  onAdd,
  allowEdit,
  allowDelete,
  showOnlyMyTasks,
  filterUserName,
  priorityConfig,
  isDarkMode,
  onMenuOpen,
  formatDate,
}) => {
  const Icon = config.icon;

  return (
    <Paper
      elevation={0}
      sx={{
        minWidth: 340,
        maxWidth: 380,
        flex: '1 1 340px',
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          p: 2,
          background: config.gradient,
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon />
            <Typography variant="h6" fontWeight={700}>
              {config.label}
            </Typography>
          </Box>
          {allowAdd && (
            <IconButton
              size="small"
              onClick={() => onAdd(columnId)}
              sx={{
                color: 'white',
                opacity: 0.8,
                '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </Typography>
      </Box>

      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              p: 1.5,
              flex: 1,
              minHeight: 400,
              bgcolor: snapshot.isDraggingOver
                ? alpha(
                    config.gradient.includes('#667eea')
                      ? '#667eea'
                      : config.gradient.includes('#f093fb')
                        ? '#f093fb'
                        : '#4facfe',
                    0.08
                  )
                : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 6,
                  opacity: 0.5,
                }}
              >
                <Icon sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No tasks here
                </Typography>
              </Box>
            )}
            {tasks.map((task, index) => {
              const isMyTask =
                !showOnlyMyTasks &&
                filterUserName &&
                task.owner &&
                task.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim();

              return (
                <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <PortalAwareItem provided={dragProvided} snapshot={dragSnapshot}>
                      <ActionItemCard
                        task={task}
                        isMyTask={isMyTask}
                        isDarkMode={isDarkMode}
                        allowEdit={allowEdit}
                        allowDelete={allowDelete}
                        priorityConfig={priorityConfig}
                        onMenuOpen={onMenuOpen}
                        formatDate={formatDate}
                        isDragging={dragSnapshot.isDragging}
                      />
                    </PortalAwareItem>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Paper>
  );
};

export default KanbanColumn;
