import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, Message } from '../types';

const firestoreMocks = vi.hoisted(() => {
  const batch = {
    update: vi.fn(),
    commit: vi.fn(async () => undefined)
  };

  return {
    db: { name: 'test-db' },
    batch,
    addDoc: vi.fn(async () => ({ id: 'new-conversation' })),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
    deleteField: vi.fn(() => 'DELETE_FIELD'),
    deleteDoc: vi.fn(async () => undefined),
    doc: vi.fn((base: { path?: string }, ...segments: string[]) => ({
      type: 'doc',
      path:
        segments.length > 0
          ? [base.path, ...segments].filter(Boolean).join('/')
          : `${base.path ?? ''}/auto-id`
    })),
    getDocs: vi.fn(),
    onSnapshot: vi.fn(),
    orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
    query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    updateDoc: vi.fn(async () => undefined),
    writeBatch: vi.fn(() => batch)
  };
});

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../firebase', () => ({
  requireDb: () => firestoreMocks.db
}));

import {
  createConversation,
  addKanbanColumn,
  deleteKanbanColumn,
  listenForConversations,
  renameConversation,
  renameKanbanColumn,
  reorderKanbanColumns,
  reorderConversations,
  touchConversation,
  updateConversationVisualizationView
} from './conversations';

const timestamp = (millis: number) =>
  ({
    toDate: () => new Date(millis),
    toMillis: () => millis
  }) as Conversation['createdAt'];

function sourceConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'source-conversation',
    userId: 'user-1',
    title: 'Source',
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    lastMessagePreview: '',
    ...overrides
  };
}

function docsWithConversations(conversations: Conversation[]) {
  return {
    docs: conversations.map((conversation) => ({
      id: conversation.id,
      data: () => {
        const { id: _id, ...data } = conversation;
        return data;
      }
    }))
  };
}

function sourceMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'source-message',
    userId: 'user-1',
    conversationId: 'source-conversation',
    text: 'Message text',
    searchText: 'message text',
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
    forwardedFromMessageId: null,
    ...overrides
  };
}

function docsWithMessages(messages: Message[]) {
  return {
    docs: messages.map((message) => ({
      id: message.id,
      ref: { path: `users/user-1/conversations/${message.conversationId}/messages/${message.id}` },
      data: () => {
        const { id: _id, ...data } = message;
        return data;
      }
    }))
  };
}

describe('conversation service writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.getDocs.mockResolvedValue(docsWithConversations([]));
  });

  it('normalizes listened conversations into persisted or current visible order', () => {
    const onChange = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_query: unknown, callback: (snapshot: unknown) => void) => {
      callback(
        docsWithConversations([
          sourceConversation({ id: 'recent', title: 'Recent', updatedAt: timestamp(3) }),
          sourceConversation({ id: 'old', title: 'Old', updatedAt: timestamp(1), sortOrder: 2000 }),
          sourceConversation({ id: 'pinned', title: 'Pinned', updatedAt: timestamp(2), sortOrder: 1000 })
        ])
      );
      return vi.fn();
    });

    listenForConversations('user-1', onChange);

    expect(onChange.mock.calls[0][0].map((conversation: Conversation) => conversation.id)).toEqual([
      'recent',
      'pinned',
      'old'
    ]);
  });

  it('deduplicates repeated Kanban columns from listened conversation data', () => {
    const onChange = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_query: unknown, callback: (snapshot: unknown) => void) => {
      callback(
        docsWithConversations([
          sourceConversation({
            id: 'source-conversation',
            kanbanColumns: [
              { id: 'duplicate', title: 'First', sortOrder: 1000 },
              { id: 'duplicate', title: 'Second', sortOrder: 2000 },
              { id: 'unique', title: 'Unique', sortOrder: 3000 }
            ]
          })
        ])
      );
      return vi.fn();
    });

    listenForConversations('user-1', onChange);

    expect(onChange.mock.calls[0][0][0].kanbanColumns).toEqual([
      { id: 'duplicate', title: 'First', sortOrder: 1000 },
      { id: 'unique', title: 'Unique', sortOrder: 3000 }
    ]);
  });

  it('creates new conversations above the current first conversation', async () => {
    firestoreMocks.getDocs.mockResolvedValue(
      docsWithConversations([
        sourceConversation({ id: 'first', sortOrder: 1000 }),
        sourceConversation({ id: 'second', sortOrder: 2000 })
      ])
    );

    await createConversation('user-1', '  Ideas  ');

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations' }), {
      userId: 'user-1',
      title: 'Ideas',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
      lastMessagePreview: '',
      sortOrder: 0,
      visualizationView: 'list',
      kanbanColumns: []
    });
  });

  it('renames conversations and rewrites matching inline wiki links across messages', async () => {
    firestoreMocks.getDocs.mockImplementation(async (ref: { path?: string }) => {
      if (ref.path === 'users/user-1/conversations') {
        return docsWithConversations([
          sourceConversation({ id: 'source-conversation', title: 'Old title' }),
          sourceConversation({ id: 'target-conversation', title: 'Target' })
        ]);
      }

      if (ref.path === 'users/user-1/conversations/source-conversation/messages') {
        return docsWithMessages([
          sourceMessage({
            id: 'linked-message',
            conversationId: 'source-conversation',
            text: 'See [[Old title]] and [[Other]].'
          }),
          sourceMessage({
            id: 'untouched-message',
            conversationId: 'source-conversation',
            text: 'No matching link.'
          })
        ]);
      }

      if (ref.path === 'users/user-1/conversations/target-conversation/messages') {
        return docsWithMessages([
          sourceMessage({
            id: 'spaced-link-message',
            conversationId: 'target-conversation',
            text: 'Also see [[ Old title ]].'
          })
        ]);
      }

      return docsWithMessages([]);
    });

    await renameConversation('user-1', 'source-conversation', 'New title', 'Old title');

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation' }),
      {
        title: 'New title',
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
    expect(firestoreMocks.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation/messages/linked-message' }),
      {
        text: 'See [[New title]] and [[Other]].',
        searchText: 'see [[new title]] and [[other]].',
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
    expect(firestoreMocks.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/target-conversation/messages/spaced-link-message' }),
      {
        text: 'Also see [[New title]].',
        searchText: 'also see [[new title]].',
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
    expect(firestoreMocks.batch.update).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.batch.commit).toHaveBeenCalledTimes(1);
  });

  it('touches conversations with a top sort order when requested', async () => {
    firestoreMocks.getDocs.mockResolvedValue(
      docsWithConversations([
        sourceConversation({ id: 'first', sortOrder: 1000 }),
        sourceConversation({ id: 'second', sortOrder: 2000 })
      ])
    );

    await touchConversation('user-1', 'second', 'New preview', { moveToTop: true });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/second' }),
      {
        lastMessagePreview: 'New preview',
        updatedAt: 'SERVER_TIMESTAMP',
        sortOrder: 0
      }
    );
  });

  it('persists conversation reorder positions with stable numeric sort steps', async () => {
    await reorderConversations('user-1', [
      sourceConversation({ id: 'second' }),
      sourceConversation({ id: 'first' })
    ]);

    expect(firestoreMocks.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/second' }),
      { sortOrder: 1000 }
    );
    expect(firestoreMocks.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/first' }),
      { sortOrder: 2000 }
    );
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
  });

  it('persists the selected visualization view on a conversation', async () => {
    await updateConversationVisualizationView('user-1', 'source-conversation', 'kanban');

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation' }),
      {
        visualizationView: 'kanban',
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
  });

  it('adds, renames, and reorders Kanban columns in conversation metadata', async () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(123);
    const mathRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const column = await addKanbanColumn('user-1', 'source-conversation', [], '  Ideas  ');

    expect(column).toEqual({ id: 'kanban-123-i', title: 'Ideas', sortOrder: 1000 });
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation' }),
      {
        kanbanColumns: [{ id: 'kanban-123-i', title: 'Ideas', sortOrder: 1000 }],
        visualizationView: 'kanban',
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );

    await renameKanbanColumn('user-1', 'source-conversation', [column], column.id, '  Drafting  ');
    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation' }),
      {
        kanbanColumns: [{ id: column.id, title: 'Drafting', sortOrder: 1000 }],
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );

    await reorderKanbanColumns('user-1', 'source-conversation', [
      { id: 'done', title: 'Done', sortOrder: 2000 },
      { id: 'todo', title: 'Todo', sortOrder: 1000 }
    ]);
    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation' }),
      {
        kanbanColumns: [
          { id: 'done', title: 'Done', sortOrder: 1000 },
          { id: 'todo', title: 'Todo', sortOrder: 2000 }
        ],
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );

    dateNow.mockRestore();
    mathRandom.mockRestore();
  });

  it('deletes a Kanban column and unassigns its messages', async () => {
    firestoreMocks.getDocs.mockResolvedValue(
      docsWithMessages([
        sourceMessage({ id: 'first', kanbanColumnId: 'doing', kanbanSortOrder: 1000 }),
        sourceMessage({ id: 'second', kanbanColumnId: 'done', kanbanSortOrder: 1000 })
      ])
    );

    await deleteKanbanColumn(
      'user-1',
      'source-conversation',
      [
        { id: 'doing', title: 'Doing', sortOrder: 1000 },
        { id: 'done', title: 'Done', sortOrder: 2000 }
      ],
      'doing'
    );

    expect(firestoreMocks.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation' }),
      {
        kanbanColumns: [{ id: 'done', title: 'Done', sortOrder: 1000 }],
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
    expect(firestoreMocks.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/source-conversation/messages/first' }),
      {
        kanbanColumnId: 'DELETE_FIELD',
        kanbanSortOrder: 'DELETE_FIELD',
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
  });
});
