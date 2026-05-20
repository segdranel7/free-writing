import { describe, expect, it } from 'vitest';
import { searchLoadedMessages } from './search';
import type { Conversation, Message } from '../types';

const timestamp = { toMillis: () => 1 } as Conversation['createdAt'];

const conversations: Conversation[] = [
  {
    id: 'personal',
    userId: 'user-1',
    title: 'Personal',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: ''
  },
  {
    id: 'work',
    userId: 'user-1',
    title: 'Work',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: ''
  }
];

function message(id: string, conversationId: string, text: string): Message {
  return {
    id,
    userId: 'user-1',
    conversationId,
    text,
    searchText: text.toLowerCase(),
    tags: [],
    references: [],
    createdAt: timestamp,
    updatedAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null
  };
}

describe('searchLoadedMessages', () => {
  it('finds matching loaded messages across conversations', () => {
    const results = searchLoadedMessages(' ALPHA ', conversations, {
      personal: [message('m1', 'personal', 'Alpha note')],
      work: [message('m2', 'work', 'Follow up')]
    });

    expect(results).toEqual([
      {
        conversation: conversations[0],
        message: expect.objectContaining({ id: 'm1' })
      }
    ]);
  });

  it('returns no results for blank searches', () => {
    expect(searchLoadedMessages('   ', conversations, { personal: [message('m1', 'personal', 'Alpha note')] })).toEqual([]);
  });
});
