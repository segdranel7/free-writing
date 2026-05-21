import { describe, expect, it } from 'vitest';
import {
  buildMessageSelections,
  getMessageSelectionRangeCount,
  getSelectedMessageText,
  isTextRangeSelected,
  updateTextSelectionRanges
} from './transferSelection';

describe('transfer selection helpers', () => {
  it('adds, sorts, and removes selected ranges', () => {
    const selected = updateTextSelectionRanges([], 8, 12, 'select');
    const sorted = updateTextSelectionRanges(selected, 0, 4, 'toggle');
    const withoutDuplicate = updateTextSelectionRanges(sorted, 0, 4, 'select');
    const removed = updateTextSelectionRanges(withoutDuplicate, 8, 12, 'unselect');

    expect(sorted).toEqual([
      { startOffset: 0, endOffset: 4 },
      { startOffset: 8, endOffset: 12 }
    ]);
    expect(withoutDuplicate).toBe(sorted);
    expect(removed).toEqual([{ startOffset: 0, endOffset: 4 }]);
  });

  it('detects exact selected ranges', () => {
    const ranges = [{ startOffset: 3, endOffset: 7 }];

    expect(isTextRangeSelected(ranges, 3, 7)).toBe(true);
    expect(isTextRangeSelected(ranges, 3, 8)).toBe(false);
  });

  it('builds selected message text and transfer payloads from per-message ranges', () => {
    const messages = [
      { id: 'first', text: 'First selected block' },
      { id: 'second', text: 'Second selected block' },
      { id: 'third', text: 'Third block' }
    ];
    const rangesByMessageId = {
      first: [{ startOffset: 0, endOffset: 5 }],
      second: [{ startOffset: 7, endOffset: 15 }]
    };

    expect(getMessageSelectionRangeCount(rangesByMessageId)).toBe(2);
    expect(getSelectedMessageText(messages, rangesByMessageId)).toBe('First\n\nselected');
    expect(buildMessageSelections(messages, rangesByMessageId)).toEqual([
      { messageId: 'first', ranges: [{ startOffset: 0, endOffset: 5 }] },
      { messageId: 'second', ranges: [{ startOffset: 7, endOffset: 15 }] }
    ]);
  });
});
