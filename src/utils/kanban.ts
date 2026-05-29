import type { KanbanColumn, Message } from '../types';

const sortStep = 1000;

export function sortKanbanColumns(columns: readonly KanbanColumn[]) {
  return [...columns].sort((first, second) => first.sortOrder - second.sortOrder || first.title.localeCompare(second.title));
}

export function getKanbanColumnMessages(messages: readonly Message[], columnId: string) {
  return messages
    .filter((message) => message.kanbanColumnId === columnId)
    .sort(
      (first, second) =>
        (first.kanbanSortOrder ?? first.sortOrder) - (second.kanbanSortOrder ?? second.sortOrder) ||
        first.sortOrder - second.sortOrder ||
        first.id.localeCompare(second.id)
    );
}

export function getNextKanbanSortOrder(messages: readonly Message[], columnId: string) {
  const columnMessages = getKanbanColumnMessages(messages, columnId);
  return Math.max(0, ...columnMessages.map((message) => message.kanbanSortOrder ?? message.sortOrder ?? 0)) + sortStep;
}

export function applyKanbanSortOrder(messages: readonly Message[], columnId: string) {
  return messages.map((message, index) => ({
    ...message,
    kanbanColumnId: columnId,
    kanbanSortOrder: (index + 1) * sortStep
  }));
}
