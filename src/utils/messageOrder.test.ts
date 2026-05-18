import { describe, expect, it } from 'vitest';
import type { Message } from '../types';
import { moveMessageByDirection, moveMessageToDropPosition, moveMessageToDropTarget } from './messageOrder';

function message(id: string): Message {
  return {
    id,
    userId: 'user-1',
    conversationId: 'conversation-1',
    text: id,
    searchText: id,
    references: [],
    createdAt: { toDate: () => new Date('2026-05-12T12:00:00Z'), toMillis: () => 1 } as Message['createdAt'],
    updatedAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null
  };
}

const messages = [message('first'), message('second'), message('third')];

describe('message order helpers', () => {
  it('moves a message one step by direction without mutating the original list', () => {
    const nextMessages = moveMessageByDirection(messages, 0, 1);

    expect(nextMessages?.map((item) => item.id)).toEqual(['second', 'first', 'third']);
    expect(messages.map((item) => item.id)).toEqual(['first', 'second', 'third']);
  });

  it('returns null for out-of-range directional moves', () => {
    expect(moveMessageByDirection(messages, 0, -1)).toBeNull();
    expect(moveMessageByDirection(messages, 2, 1)).toBeNull();
  });

  it('moves a dragged message to the current target index', () => {
    const nextMessages = moveMessageToDropTarget(messages, 'first', 'third');

    expect(nextMessages?.map((item) => item.id)).toEqual(['second', 'third', 'first']);
  });

  it('moves a dragged message before or after a target position', () => {
    expect(moveMessageToDropPosition(messages, 'third', 'first', 'before')?.map((item) => item.id)).toEqual([
      'third',
      'first',
      'second'
    ]);
    expect(moveMessageToDropPosition(messages, 'first', 'second', 'after')?.map((item) => item.id)).toEqual([
      'second',
      'first',
      'third'
    ]);
  });

  it('returns null for no-op or missing drag targets', () => {
    expect(moveMessageToDropTarget(messages, 'first', 'first')).toBeNull();
    expect(moveMessageToDropTarget(messages, 'missing', 'first')).toBeNull();
    expect(moveMessageToDropTarget(messages, 'first', 'missing')).toBeNull();
    expect(moveMessageToDropPosition(messages, 'first', 'second', 'before')).toBeNull();
  });
});
