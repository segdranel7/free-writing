import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, Message } from '../types';

const firestoreMocks = vi.hoisted(() => ({
  db: { name: 'test-db' },
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((base: { path?: string }, ...segments: string[]) => ({
    type: 'doc',
    path: [base.path, ...segments].filter(Boolean).join('/')
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints }))
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../firebase', () => ({
  requireDb: () => firestoreMocks.db
}));

import { exportAllConversations, exportConversation } from './exports';

const timestamp = (millis: number) =>
  ({
    toDate: () => new Date(millis),
    toMillis: () => millis
  }) as Conversation['createdAt'];

function conversation(id: string, title: string): Conversation {
  return {
    id,
    userId: 'user-1',
    title,
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    lastMessagePreview: '',
    sortOrder: 1000
  };
}

function message(id: string, conversationId: string): Message {
  return {
    id,
    userId: 'user-1',
    conversationId,
    text: `Message ${id}`,
    searchText: `message ${id}`,
    tags: [],
    references: [],
    createdAt: timestamp(1),
    updatedAt: null,
    scheduledAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromConversationTitle: null,
    forwardedFromMessageId: null
  };
}

function docSnapshot<T extends { id: string }>(path: string, data: T, exists = true) {
  return {
    id: data.id,
    ref: { path },
    exists: () => exists,
    data: () => {
      const { id: _id, ...rest } = data;
      return rest;
    }
  };
}

function querySnapshot<T extends { id: string }>(basePath: string, entries: T[]) {
  return {
    docs: entries.map((entry) => docSnapshot(`${basePath}/${entry.id}`, entry))
  };
}

describe('export service reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports only the requested conversation and its messages', async () => {
    firestoreMocks.getDoc.mockResolvedValue(
      docSnapshot('users/user-1/conversations/first', conversation('first', 'First'))
    );
    firestoreMocks.getDocs.mockResolvedValue(
      querySnapshot('users/user-1/conversations/first/messages', [message('message-1', 'first')])
    );

    const bundle = await exportConversation('user-1', 'first');

    expect(bundle.conversation.id).toBe('first');
    expect(bundle.messages.map((entry) => entry.id)).toEqual(['message-1']);
    expect(firestoreMocks.getDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/first' }));
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.query).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/first/messages' }),
      { field: 'createdAt', direction: 'asc' }
    );
  });

  it('exports all conversations with nested messages', async () => {
    firestoreMocks.getDocs.mockImplementation(async (request: { ref?: { path?: string }; path?: string }) => {
      const path = request.ref?.path ?? request.path;
      if (path === 'users/user-1/conversations') {
        return querySnapshot('users/user-1/conversations', [
          conversation('first', 'First'),
          conversation('second', 'Second')
        ]);
      }
      if (path === 'users/user-1/conversations/first/messages') {
        return querySnapshot(path, [message('first-message', 'first')]);
      }
      if (path === 'users/user-1/conversations/second/messages') {
        return querySnapshot(path, [message('second-message', 'second')]);
      }
      return querySnapshot(path ?? '', []);
    });

    const bundle = await exportAllConversations('user-1');

    expect(bundle.conversations.map((entry) => entry.id)).toEqual(['first', 'second']);
    expect(bundle.conversations[0].messages.map((entry) => entry.id)).toEqual(['first-message']);
    expect(bundle.conversations[1].messages.map((entry) => entry.id)).toEqual(['second-message']);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(3);
  });

  it('throws a clear error for a missing active conversation', async () => {
    firestoreMocks.getDoc.mockResolvedValue({
      id: 'missing',
      ref: { path: 'users/user-1/conversations/missing' },
      exists: () => false,
      data: () => undefined
    });

    await expect(exportConversation('user-1', 'missing')).rejects.toThrow('Conversation not found.');
  });
});
