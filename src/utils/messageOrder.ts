import type { Message } from '../types';

type OrderedItem = {
  id: string;
};

export type DropPosition = 'before' | 'after';

function moveItemByDirection<TItem>(items: TItem[], itemIndex: number, direction: -1 | 1) {
  const targetIndex = itemIndex + direction;
  if (itemIndex < 0 || itemIndex >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return null;
  }

  const nextItems = [...items];
  [nextItems[itemIndex], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[itemIndex]];
  return nextItems;
}

export function moveItemToDropTarget<TItem extends OrderedItem>(
  items: TItem[],
  draggedItemId: string,
  targetItemId: string
) {
  if (draggedItemId === targetItemId) return null;

  const draggedIndex = items.findIndex((item) => item.id === draggedItemId);
  const targetIndex = items.findIndex((item) => item.id === targetItemId);
  if (draggedIndex === -1 || targetIndex === -1) return null;

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(draggedIndex, 1);
  nextItems.splice(targetIndex, 0, draggedItem);
  return nextItems;
}

export function moveItemToDropPosition<TItem extends OrderedItem>(
  items: TItem[],
  draggedItemId: string,
  targetItemId: string,
  position: DropPosition
) {
  if (draggedItemId === targetItemId) return null;

  const draggedIndex = items.findIndex((item) => item.id === draggedItemId);
  const targetIndex = items.findIndex((item) => item.id === targetItemId);
  if (draggedIndex === -1 || targetIndex === -1) return null;

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(draggedIndex, 1);
  const targetIndexAfterRemoval = nextItems.findIndex((item) => item.id === targetItemId);
  const insertIndex = position === 'before' ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;
  nextItems.splice(insertIndex, 0, draggedItem);

  return nextItems.every((item, index) => item.id === items[index]?.id) ? null : nextItems;
}

export function moveMessageByDirection(messages: Message[], messageIndex: number, direction: -1 | 1) {
  return moveItemByDirection(messages, messageIndex, direction);
}

export function moveMessageToDropTarget(messages: Message[], draggedMessageId: string, targetMessageId: string) {
  return moveItemToDropTarget(messages, draggedMessageId, targetMessageId);
}

export function moveMessageToDropPosition(
  messages: Message[],
  draggedMessageId: string,
  targetMessageId: string,
  position: DropPosition
) {
  return moveItemToDropPosition(messages, draggedMessageId, targetMessageId, position);
}
