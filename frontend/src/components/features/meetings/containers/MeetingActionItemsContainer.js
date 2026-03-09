/**
 * MeetingActionItemsContainer
 * Container that renders the shared KanbanBoard in meeting mode.
 * Mirrors ProjectActionItemsContainer but scoped to a single meeting transcription.
 */
import React from 'react';
import KanbanBoard from '../../kanban/KanbanBoard';

const MeetingActionItemsContainer = ({
  transcriptionId,
  initialItems = [],
  onActionItemsChanged,
}) => (
  <KanbanBoard
    mode="meeting"
    transcriptionId={transcriptionId}
    initialItems={initialItems}
    showHeader={false}
    showFilters={false}
    allowAdd={!!transcriptionId}
    allowEdit
    allowDelete
    defaultShowCompleted
    onActionItemsChanged={onActionItemsChanged}
  />
);

export default MeetingActionItemsContainer;
