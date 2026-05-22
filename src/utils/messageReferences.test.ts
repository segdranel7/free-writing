import { describe, expect, it } from 'vitest';
import type { Conversation, Message } from '../types';
import {
  appendUniqueReference,
  createBlockReference,
  createQuoteReference,
  getBacklinksByMessageKey,
  getMessageReferencePreview,
  getMessageReferenceKey,
  getReferenceNavigationTarget,
  isDuplicateReference
} from './messageReferences';

const timestamp = { toMillis: () => 1 } as Message['createdAt'];

const conversation: Conversation = {
  id: 'conversation-1',
  userId: 'user-1',
  title: 'Inbox',
  createdAt: timestamp,
  updatedAt: timestamp,
  lastMessagePreview: ''
};

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    userId: 'user-1',
    conversationId: conversation.id,
    text: 'Connected block text',
    searchText: 'connected block text',
    tags: [],
    references: [],
    createdAt: timestamp,
    updatedAt: null,
    scheduledAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null,
    ...overrides
  };
}

describe('message reference helpers', () => {
  it('creates whole-block references with a stored preview', () => {
    const reference = createBlockReference(conversation, message({ id: 'target-message' }));

    expect(reference).toEqual(expect.objectContaining({
      type: 'block',
      sourceConversationId: conversation.id,
      sourceConversationTitle: 'Inbox',
      sourceMessageId: 'target-message',
      sourceMessagePreview: 'Connected block text'
    }));
  });

  it('creates readable previews for non-text blocks', () => {
    expect(getMessageReferencePreview(message({ text: '', attachments: [{ id: 'image-1', type: 'image', url: 'data:', name: 'x.png', contentType: 'image/png', size: 1 }] }))).toBe('Image block');
    expect(getMessageReferencePreview(message({ text: '', references: [createBlockReference(conversation, message())] }))).toBe('Reference block');
  });

  it('navigates whole-block and quote references to the target block', () => {
    const blockReference = createBlockReference(conversation, message({ id: 'target-message' }));
    const quoteReference = createQuoteReference(conversation, message({ id: 'target-message' }), 0, 9);

    expect(getReferenceNavigationTarget(blockReference)).toEqual({
      conversationId: conversation.id,
      messageId: 'target-message'
    });
    expect(getReferenceNavigationTarget(quoteReference!)).toEqual({
      conversationId: conversation.id,
      messageId: 'target-message',
      range: { startOffset: 0, endOffset: 9 }
    });
  });

  it('detects duplicate exact references before appending', () => {
    const existingBlockReference = createBlockReference(conversation, message({ id: 'target-message' }));
    const duplicateBlockReference = {
      ...createBlockReference(conversation, message({ id: 'target-message' })),
      id: 'different-id'
    };
    const differentQuoteReference = createQuoteReference(conversation, message({ id: 'target-message' }), 0, 9)!;

    expect(isDuplicateReference(duplicateBlockReference, [existingBlockReference])).toBe(true);
    expect(appendUniqueReference([existingBlockReference], duplicateBlockReference)).toEqual([existingBlockReference]);
    expect(isDuplicateReference(differentQuoteReference, [existingBlockReference])).toBe(false);
    expect(appendUniqueReference([existingBlockReference], differentQuoteReference)).toEqual([
      existingBlockReference,
      differentQuoteReference
    ]);
  });

  it('groups loaded block and quote backlinks by target message key', () => {
    const targetMessage = message({ id: 'target-message', text: 'Target' });
    const sourceMessage = message({
      id: 'source-message',
      text: 'Source',
      references: [
        createBlockReference(conversation, targetMessage),
        createQuoteReference(conversation, targetMessage, 0, 6)!
      ]
    });

    const backlinks = getBacklinksByMessageKey([conversation], {
      [conversation.id]: [sourceMessage, targetMessage]
    });

    expect(backlinks[getMessageReferenceKey(conversation.id, 'target-message')]).toEqual([
      expect.objectContaining({
        sourceConversationId: conversation.id,
        sourceConversationTitle: 'Inbox',
        sourceMessageId: 'source-message',
        sourceMessagePreview: 'Source',
        reference: expect.objectContaining({ type: 'block' })
      }),
      expect.objectContaining({
        sourceMessageId: 'source-message',
        reference: expect.objectContaining({ type: 'quote' })
      })
    ]);
  });
});
