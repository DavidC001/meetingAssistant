/**
 * MeetingActionItems Component
 * Renders the Kanban board for a meeting's action items, reusing KanbanBoard.
 * Props:
 *   transcriptionId {number} – ID of the meeting transcription
 *   initialItems    {Array}  – action_items array from meeting.transcription
 */
import React from 'react';
import KanbanBoard from '../../kanban/KanbanBoard';

const MeetingActionItems = ({ transcriptionId, initialItems = [] }) => (
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
  />
);

export default MeetingActionItems;
