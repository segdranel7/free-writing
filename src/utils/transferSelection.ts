import type { MessageSelection } from './transferActions';
import { getSelectedTextFromRanges, type TextSelectionRange } from './textSelection';

export type SelectionUpdateMode = 'toggle' | 'select' | 'unselect';

export type MessageSelectionRanges = Record<string, TextSelectionRange[]>;

type SelectableMessage = {
  id: string;
  text: string;
};

export function isTextRangeSelected(ranges: TextSelectionRange[], startOffset: number, endOffset: number) {
  return ranges.some((range) => range.startOffset === startOffset && range.endOffset === endOffset);
}

export function updateTextSelectionRanges(
  ranges: TextSelectionRange[],
  startOffset: number,
  endOffset: number,
  mode: SelectionUpdateMode
) {
  const isAlreadySelected = isTextRangeSelected(ranges, startOffset, endOffset);

  if (mode === 'unselect' || (mode === 'toggle' && isAlreadySelected)) {
    return ranges.filter((range) => range.startOffset !== startOffset || range.endOffset !== endOffset);
  }

  if (isAlreadySelected) return ranges;

  return [...ranges, { startOffset, endOffset }].sort((first, second) => first.startOffset - second.startOffset);
}

export function getMessageSelectionRangeCount(messageSelectionRanges: MessageSelectionRanges) {
  return Object.values(messageSelectionRanges).reduce((total, ranges) => total + ranges.length, 0);
}

export function getSelectedMessageText(messages: SelectableMessage[], messageSelectionRanges: MessageSelectionRanges) {
  return messages
    .map((message) => getSelectedTextFromRanges(message.text, messageSelectionRanges[message.id] ?? []))
    .filter(Boolean)
    .join('\n\n');
}

export function buildMessageSelections(
  messages: SelectableMessage[],
  messageSelectionRanges: MessageSelectionRanges
): MessageSelection[] {
  return messages
    .map((message) => ({ messageId: message.id, ranges: messageSelectionRanges[message.id] ?? [] }))
    .filter((selection) => selection.ranges.length > 0);
}
