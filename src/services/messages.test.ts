import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, MessageImageAttachment } from '../types';

const firestoreMocks = vi.hoisted(() => {
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async () => undefined)
  };

  return {
    db: { name: 'test-db' },
    batch,
    addDoc: vi.fn(async () => ({ id: 'new-message' })),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
    deleteDoc: vi.fn(async () => undefined),
    doc: vi.fn((base: { path?: string }, ...segments: string[]) => ({
      type: 'doc',
      path: segments.length > 0 ? segments.join('/') : `${base.path}/auto-id`
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

const conversationMocks = vi.hoisted(() => ({
  touchConversation: vi.fn(async () => undefined)
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../firebase', () => ({
  requireDb: () => firestoreMocks.db
}));
vi.mock('./conversations', () => conversationMocks);

import {
  createMessage,
  createConversationIndexMessage,
  createMessageAfter,
  editMessage,
  forwardMessage,
  listenForMessages,
  mergeMessages,
  moveMessage,
  moveMessageTextSelection,
  reorderKanbanMessages,
  reorderMessages,
  updateMessageKanbanPlacement,
  updateMessageReferences,
  updateMessageTags
} from './messages';

const timestamp = (millis: number) => ({ toMillis: () => millis }) as Message['createdAt'];

function sourceMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'source-message',
    userId: 'user-1',
    conversationId: 'source-conversation',
    text: 'Transfer this',
    searchText: 'transfer this',
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
      data: () => {
        const { id: _id, ...data } = message;
        return data;
      }
    }))
  };
}

describe('message service writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.getDocs.mockResolvedValue(docsWithMessages([]));
  });

  it('creates trimmed searchable messages at the next persisted sort order', async () => {
    firestoreMocks.getDocs.mockResolvedValue(
      docsWithMessages([
        sourceMessage({ id: 'first', sortOrder: 1000 }),
        sourceMessage({ id: 'second', sortOrder: 3000 })
      ])
    );

    await createMessage('user-1', 'conversation-1', '  Hello There  ');

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages' }), {
      userId: 'user-1',
      conversationId: 'conversation-1',
      text: 'Hello There',
      searchText: 'hello there',
      references: [],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      sortOrder: 4000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: null
    });
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'Hello There', {
      moveToTop: true
    });
  });

  it('creates image-only messages with attachment metadata and an image preview', async () => {
    const attachment: MessageImageAttachment = {
      id: 'image-1',
      type: 'image',
      url: 'https://example.com/image.png',
      name: 'image.png',
      contentType: 'image/png',
      size: 2048
    };

    await createMessage('user-1', 'conversation-1', '   ', [attachment]);

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages' }), {
      userId: 'user-1',
      conversationId: 'conversation-1',
      text: '',
      searchText: '',
      attachments: [attachment],
      references: [],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      sortOrder: 1000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: null
    });
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'Image', {
      moveToTop: true
    });
  });

  it('stores a scheduled date when creating a message', async () => {
    const scheduledAt = new Date('2026-05-21T16:30:00');

    await createMessage('user-1', 'conversation-1', ' Scheduled note ', [], [], scheduledAt);

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages' }),
      expect.objectContaining({
        text: 'Scheduled note',
        scheduledAt
      })
    );
  });

  it('stores Kanban placement when creating a message', async () => {
    await createMessage('user-1', 'conversation-1', 'Card text', [], [], null, {
      columnId: 'doing',
      sortOrder: 2000
    });

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages' }),
      expect.objectContaining({
        text: 'Card text',
        kanbanColumnId: 'doing',
        kanbanSortOrder: 2000
      })
    );
  });

  it('creates reference-only messages with structured metadata', async () => {
    await createMessage('user-1', 'conversation-1', '   ', [], [
      {
        id: 'reference-1',
        type: 'conversation',
        sourceConversationId: 'source-conversation',
        sourceConversationTitle: 'Source chat'
      }
    ]);

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages' }), {
      userId: 'user-1',
      conversationId: 'conversation-1',
      text: '',
      searchText: '',
      references: [
        {
          id: 'reference-1',
          type: 'conversation',
          sourceConversationId: 'source-conversation',
          sourceConversationTitle: 'Source chat'
        }
      ],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      sortOrder: 1000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: null
    });
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'Reference', {
      moveToTop: true
    });
  });

  it('creates conversation index messages with structured entries at the next sort order', async () => {
    firestoreMocks.getDocs.mockResolvedValue(
      docsWithMessages([
        sourceMessage({ id: 'first', sortOrder: 1000 }),
        sourceMessage({ id: 'second', sortOrder: 3000 })
      ])
    );
    const entries = [
      {
        id: 'entry-1',
        sourceMessageId: 'first',
        title: 'Opening',
        summary: 'Starts the conversation.'
      },
      {
        id: 'entry-2',
        sourceMessageId: 'second',
        title: 'Follow-up',
        summary: 'Builds on the opening.'
      }
    ];

    await createConversationIndexMessage('user-1', 'conversation-1', '  1. Opening  ', entries);

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages' }), {
      userId: 'user-1',
      conversationId: 'conversation-1',
      text: '1. Opening',
      searchText: '1. opening',
      references: [],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      sortOrder: 4000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: null,
      blockKind: 'conversation-index',
      indexEntries: entries
    });
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', '1. Opening', {
      moveToTop: true
    });
  });

  it('edits message text while preserving provided references', async () => {
    const references = [
      {
        id: 'reference-1',
        type: 'quote' as const,
        sourceConversationId: 'source-conversation',
        sourceConversationTitle: 'Source chat',
        sourceMessageId: 'source-message',
        quoteText: 'Quoted source',
        startOffset: 0,
        endOffset: 13
      }
    ];

    await editMessage('user-1', 'conversation-1', 'message-1', ' Edited text ', undefined, references);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/message-1' }), {
      text: 'Edited text',
      searchText: 'edited text',
      updatedAt: 'SERVER_TIMESTAMP',
      references
    });
  });

  it('updates or clears a scheduled date while editing a message', async () => {
    const scheduledAt = new Date('2026-05-22T09:15:00');

    await editMessage('user-1', 'conversation-1', 'message-1', 'Edited text', undefined, undefined, scheduledAt);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/message-1' }),
      expect.objectContaining({ scheduledAt })
    );

    await editMessage('user-1', 'conversation-1', 'message-1', 'Edited text', undefined, undefined, null);

    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/message-1' }),
      expect.objectContaining({ scheduledAt: null })
    );
  });

  it('normalizes older message records without references or tags', () => {
    const oldMessage = sourceMessage();
    const { references: _references, tags: _tags, scheduledAt: _scheduledAt, ...legacyMessage } = oldMessage;
    const onChange = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_query, callback) => {
      callback(docsWithMessages([legacyMessage as Message]));
      return vi.fn();
    });

    listenForMessages('user-1', 'conversation-1', onChange);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'source-message',
        references: [],
        tags: [],
        scheduledAt: null
      })
    ]);
  });

  it('updates tags with normalized values only', async () => {
    await updateMessageTags('user-1', 'conversation-1', 'message-1', ['  Urgent ', 'urgent', '', 'Idea']);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/message-1' }),
      {
        tags: ['Urgent', 'Idea'],
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
  });

  it('updates references without changing message text or attachments', async () => {
    const references = [
      {
        id: 'reference-1',
        type: 'block' as const,
        sourceConversationId: 'conversation-1',
        sourceConversationTitle: 'Inbox',
        sourceMessageId: 'message-2',
        sourceMessagePreview: 'Target block'
      }
    ];

    await updateMessageReferences('user-1', 'conversation-1', 'message-1', references);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/message-1' }),
      {
        references,
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
  });

  it('updates and clears a message Kanban placement', async () => {
    await updateMessageKanbanPlacement('user-1', 'conversation-1', 'message-1', {
      columnId: 'doing',
      sortOrder: 3000
    });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/message-1' }),
      {
        kanbanColumnId: 'doing',
        kanbanSortOrder: 3000,
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );

    await updateMessageKanbanPlacement('user-1', 'conversation-1', 'message-1', null);

    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/message-1' }),
      {
        kanbanColumnId: null,
        kanbanSortOrder: null,
        updatedAt: 'SERVER_TIMESTAMP'
      }
    );
  });

  it('forwards a message as a new target message without deleting the source', async () => {
    await forwardMessage('user-1', sourceMessage(), 'target-conversation', 'Source chat');

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/target-conversation/messages' }), {
      userId: 'user-1',
      conversationId: 'target-conversation',
      text: 'Transfer this',
      searchText: 'transfer this',
      references: [],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      sortOrder: 1000,
      isForwarded: true,
      transferType: 'forwarded',
      forwardedFromConversationId: 'source-conversation',
      forwardedFromConversationTitle: 'Source chat',
      forwardedFromMessageId: 'source-message'
    });
    expect(firestoreMocks.deleteDoc).not.toHaveBeenCalled();
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'target-conversation', 'Transfer this', {
      moveToTop: true
    });
  });

  it('preserves tags when forwarding whole blocks', async () => {
    await forwardMessage('user-1', sourceMessage({ tags: ['Urgent', 'Idea'] }), 'target-conversation', 'Source chat');

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tags: ['Urgent', 'Idea']
    }));
  });

  it('preserves scheduled dates when forwarding whole blocks', async () => {
    const scheduledAt = timestamp(5000);

    await forwardMessage('user-1', sourceMessage({ scheduledAt }), 'target-conversation', 'Source chat');

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scheduledAt
      })
    );
  });

  it('creates an English block directly after the source message with a midpoint sort order', async () => {
    const first = sourceMessage({ id: 'first', conversationId: 'conversation-1', sortOrder: 1000 });
    const second = sourceMessage({ id: 'second', conversationId: 'conversation-1', sortOrder: 3000 });

    await createMessageAfter('user-1', 'conversation-1', first, [first, second], '  English text  ');

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/auto-id' }), {
      userId: 'user-1',
      conversationId: 'conversation-1',
      text: 'English text',
      searchText: 'english text',
      references: [],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      sortOrder: 2000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: 'conversation-1',
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: 'first'
    });
    expect(firestoreMocks.batch.update).not.toHaveBeenCalled();
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'English text', {
      moveToTop: true
    });
  });

  it('preserves tags when creating an English block after the source', async () => {
    const first = sourceMessage({ id: 'first', conversationId: 'conversation-1', sortOrder: 1000, tags: ['Keep'] });

    await createMessageAfter('user-1', 'conversation-1', first, [first], 'English text');

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tags: ['Keep']
    }));
  });

  it('rebalances message order when inserting an English block without a sort gap', async () => {
    const first = sourceMessage({ id: 'first', conversationId: 'conversation-1', sortOrder: 1000 });
    const second = sourceMessage({ id: 'second', conversationId: 'conversation-1', sortOrder: 1001 });

    await createMessageAfter('user-1', 'conversation-1', first, [first, second], 'English text');

    expect(firestoreMocks.batch.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/first' }), {
      sortOrder: 1000
    });
    expect(firestoreMocks.batch.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/second' }), {
      sortOrder: 3000
    });
    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/auto-id' }), expect.objectContaining({
      text: 'English text',
      sortOrder: 2000
    }));
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
  });

  it('moves a message by writing the target and deleting the source in one batch', async () => {
    await moveMessage('user-1', sourceMessage(), 'target-conversation');

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/target-conversation/messages/auto-id' }), {
      userId: 'user-1',
      conversationId: 'target-conversation',
      text: 'Transfer this',
      searchText: 'transfer this',
      references: [],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      sortOrder: 1000,
      isForwarded: true,
      transferType: 'moved',
      forwardedFromConversationId: 'source-conversation',
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: 'source-message'
    });
    expect(firestoreMocks.batch.delete).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/source-conversation/messages/source-message' }));
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'target-conversation', 'Transfer this', {
      moveToTop: true
    });
  });

  it('preserves tags when moving whole blocks', async () => {
    await moveMessage('user-1', sourceMessage({ tags: ['Later'] }), 'target-conversation');

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tags: ['Later']
    }));
  });

  it('preserves scheduled dates when moving whole blocks', async () => {
    const scheduledAt = timestamp(5000);

    await moveMessage('user-1', sourceMessage({ scheduledAt }), 'target-conversation');

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scheduledAt
      })
    );
  });

  it('moves selected text to the top of the target conversation without moving the source conversation', async () => {
    await moveMessageTextSelection('user-1', sourceMessage({ text: 'Transfer this text', tags: ['Source only'] }), 'target-conversation', [
      { startOffset: 0, endOffset: 8 }
    ]);

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({
      tags: expect.any(Array)
    }));
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'target-conversation', 'Transfer', {
      moveToTop: true
    });
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'source-conversation', 'this text');
  });

  it('merges selected messages into one replacement block and deletes the originals', async () => {
    const first = sourceMessage({ id: 'first', conversationId: 'conversation-1', text: 'First block', sortOrder: 3000, tags: ['Idea'] });
    const second = sourceMessage({ id: 'second', conversationId: 'conversation-1', text: 'Second block', sortOrder: 1000, tags: ['Urgent', 'idea'] });

    await mergeMessages('user-1', 'conversation-1', [first, second]);

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/auto-id' }), {
      userId: 'user-1',
      conversationId: 'conversation-1',
      text: 'Second block\n\nFirst block',
      searchText: 'second block\n\nfirst block',
      references: [],
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
    scheduledAt: null,
      tags: ['Urgent', 'idea'],
      sortOrder: 1000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: null
    });
    expect(firestoreMocks.batch.delete).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/second' }));
    expect(firestoreMocks.batch.delete).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/first' }));
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'Second block\n\nFirst block');
  });

  it('keeps the earliest scheduled date when merging selected messages', async () => {
    const later = sourceMessage({ id: 'later', conversationId: 'conversation-1', scheduledAt: timestamp(3000) });
    const earlier = sourceMessage({ id: 'earlier', conversationId: 'conversation-1', scheduledAt: timestamp(2000) });

    await mergeMessages('user-1', 'conversation-1', [later, earlier]);

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scheduledAt: earlier.scheduledAt
      })
    );
  });

  it('persists reorder positions with stable numeric sort steps', async () => {
    await reorderMessages('user-1', 'conversation-1', [
      sourceMessage({ id: 'second' }),
      sourceMessage({ id: 'first' })
    ]);

    expect(firestoreMocks.batch.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/second' }), {
      sortOrder: 1000
    });
    expect(firestoreMocks.batch.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/first' }), {
      sortOrder: 2000
    });
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
  });

  it('reorders Kanban cards within a column', async () => {
    await reorderKanbanMessages('user-1', 'conversation-1', 'doing', [
      sourceMessage({ id: 'second' }),
      sourceMessage({ id: 'first' })
    ]);

    expect(firestoreMocks.batch.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/second' }),
      { kanbanColumnId: 'doing', kanbanSortOrder: 1000 }
    );
    expect(firestoreMocks.batch.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/first' }),
      { kanbanColumnId: 'doing', kanbanSortOrder: 2000 }
    );
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
  });
});
