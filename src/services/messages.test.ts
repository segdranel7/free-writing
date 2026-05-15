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

import { createMessage, createMessageAfter, forwardMessage, mergeMessages, moveMessage, reorderMessages } from './messages';

const timestamp = (millis: number) => ({ toMillis: () => millis }) as Message['createdAt'];

function sourceMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'source-message',
    userId: 'user-1',
    conversationId: 'source-conversation',
    text: 'Transfer this',
    searchText: 'transfer this',
    createdAt: timestamp(1),
    updatedAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
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
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
      sortOrder: 4000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromMessageId: null
    });
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'Hello There');
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
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
      sortOrder: 1000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromMessageId: null
    });
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'Image');
  });

  it('forwards a message as a new target message without deleting the source', async () => {
    await forwardMessage('user-1', sourceMessage(), 'target-conversation');

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/target-conversation/messages' }), {
      userId: 'user-1',
      conversationId: 'target-conversation',
      text: 'Transfer this',
      searchText: 'transfer this',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
      sortOrder: 1000,
      isForwarded: true,
      transferType: 'forwarded',
      forwardedFromConversationId: 'source-conversation',
      forwardedFromMessageId: 'source-message'
    });
    expect(firestoreMocks.deleteDoc).not.toHaveBeenCalled();
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
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
      sortOrder: 2000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: 'conversation-1',
      forwardedFromMessageId: 'first'
    });
    expect(firestoreMocks.batch.update).not.toHaveBeenCalled();
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'English text');
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
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
      sortOrder: 1000,
      isForwarded: true,
      transferType: 'moved',
      forwardedFromConversationId: 'source-conversation',
      forwardedFromMessageId: 'source-message'
    });
    expect(firestoreMocks.batch.delete).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/source-conversation/messages/source-message' }));
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
  });

  it('merges selected messages into one replacement block and deletes the originals', async () => {
    const first = sourceMessage({ id: 'first', conversationId: 'conversation-1', text: 'First block', sortOrder: 3000 });
    const second = sourceMessage({ id: 'second', conversationId: 'conversation-1', text: 'Second block', sortOrder: 1000 });

    await mergeMessages('user-1', 'conversation-1', [first, second]);

    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/auto-id' }), {
      userId: 'user-1',
      conversationId: 'conversation-1',
      text: 'Second block\n\nFirst block',
      searchText: 'second block\n\nfirst block',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: null,
      sortOrder: 1000,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: null,
      forwardedFromMessageId: null
    });
    expect(firestoreMocks.batch.delete).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/second' }));
    expect(firestoreMocks.batch.delete).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: 'users/user-1/conversations/conversation-1/messages/first' }));
    expect(firestoreMocks.batch.commit).toHaveBeenCalled();
    expect(conversationMocks.touchConversation).toHaveBeenCalledWith('user-1', 'conversation-1', 'Second block\n\nFirst block');
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
});
