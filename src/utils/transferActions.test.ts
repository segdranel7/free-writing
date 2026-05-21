import { describe, expect, it, vi } from 'vitest';
import { executeTransferAction, type TransferAction, type TransferOutcome } from './transferActions';
import type { Message } from '../types';

describe('executeTransferAction', () => {
  const sourceMessage: Message = {
    id: 'msg-1',
    userId: 'user-1',
    conversationId: 'source',
    text: 'Hello world',
    searchText: 'hello world',
    tags: [],
    attachments: [],
    references: [],
    createdAt: { toMillis: () => 1, toDate: () => new Date() } as Message['createdAt'],
    updatedAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromConversationTitle: null,
    forwardedFromMessageId: null
  };

  const deps = {
    forwardMessage: vi.fn(async () => undefined),
    moveMessage: vi.fn(async () => undefined),
    moveMessageTextSelection: vi.fn(async () => undefined),
    getConversationTitle: vi.fn((conversationId: string) => (conversationId === 'source' ? 'Source chat' : 'Target chat'))
  };

  it('forwards a message and returns navigateToTarget true', async () => {
    const action: TransferAction = { mode: 'forward', message: sourceMessage };
    const result = await executeTransferAction('user-1', action, 'target', undefined, undefined, deps);

    expect(deps.forwardMessage).toHaveBeenCalledWith('user-1', sourceMessage, 'target', 'Source chat');
    expect(result).toEqual({ navigateToTarget: true });
  });

  it('moves a message and returns a moveNoticeTarget', async () => {
    const action: TransferAction = { mode: 'move', message: sourceMessage };
    const result = await executeTransferAction('user-1', action, 'target', undefined, undefined, deps);

    expect(deps.moveMessage).toHaveBeenCalledWith('user-1', sourceMessage, 'target');
    expect(result).toEqual({
      navigateToTarget: false,
      moveNoticeTarget: {
        targetConversationId: 'target',
        targetConversationTitle: 'Target chat'
      }
    });
  });

  it('forwards selected ranges from a single message', async () => {
    const action: TransferAction = { mode: 'forward', message: sourceMessage };
    const ranges = [{ startOffset: 0, endOffset: 5 }];

    const result = await executeTransferAction('user-1', action, 'target', ranges, undefined, deps);

    expect(deps.forwardMessage).toHaveBeenCalledWith(
      'user-1',
      { ...sourceMessage, text: 'Hello' },
      'target',
      'Source chat'
    );
    expect(result.navigateToTarget).toBe(true);
  });
});
