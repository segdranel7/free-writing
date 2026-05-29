import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, Message } from '../types';
import {
  buildAllConversationsExportBundle,
  buildAllConversationsExportMarkdown,
  buildConversationExportBundle,
  buildConversationExportMarkdown,
  compareExportedMessages,
  downloadConversationExport,
  serializeFirestoreValue
} from './conversationExport';

const timestamp = (iso: string, seconds = 1, nanoseconds = 2) => {
  const date = new Date(iso);
  return {
    seconds,
    nanoseconds,
    toDate: () => date,
    toMillis: () => date.getTime()
  } as Message['createdAt'];
};

const conversation = (id = 'conversation-1', title = 'Research Notes'): Conversation => ({
  id,
  userId: 'user-1',
  title,
  createdAt: timestamp('2026-05-01T10:00:00.000Z'),
  updatedAt: timestamp('2026-05-02T10:00:00.000Z'),
  lastMessagePreview: '',
  sortOrder: 1000
});

const message = (id: string, overrides: Partial<Message> = {}): Message => ({
  id,
  userId: 'user-1',
  conversationId: 'conversation-1',
  text: `Text for ${id}`,
  searchText: `text for ${id}`,
  tags: [],
  references: [],
  createdAt: timestamp('2026-05-01T10:00:00.000Z'),
  updatedAt: null,
  scheduledAt: null,
  sortOrder: 1000,
  isForwarded: false,
  transferType: null,
  forwardedFromConversationId: null,
  forwardedFromConversationTitle: null,
  forwardedFromMessageId: null,
  ...overrides
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('conversation export utilities', () => {
  it('serializes Firestore timestamps into portable JSON', () => {
    expect(serializeFirestoreValue({ createdAt: timestamp('2026-05-01T10:00:00.000Z', 1777629600, 123) })).toEqual({
      createdAt: {
        __type: 'timestamp',
        iso: '2026-05-01T10:00:00.000Z',
        seconds: 1777629600,
        nanoseconds: 123
      }
    });
  });

  it('keeps full attachment payloads in the JSON bundle', () => {
    const attachment = {
      id: 'image-1',
      type: 'image' as const,
      url: 'data:image/jpeg;base64,abc123',
      name: 'pasted-image.jpg',
      contentType: 'image/jpeg',
      size: 12345
    };
    const bundle = buildConversationExportBundle({
      userId: 'user-1',
      conversation: {
        id: 'conversation-1',
        path: 'users/user-1/conversations/conversation-1',
        data: conversation()
      },
      messages: [
        {
          id: 'message-1',
          path: 'users/user-1/conversations/conversation-1/messages/message-1',
          data: message('message-1', { attachments: [attachment] })
        }
      ],
      exportedAt: new Date('2026-05-28T12:00:00.000Z')
    });

    expect(bundle.messages[0].data.attachments).toEqual([attachment]);
  });

  it('sorts messages by display order, creation time, and id', () => {
    const first = {
      id: 'b-message',
      path: 'path/b-message',
      data: message('b-message', { sortOrder: 1000, createdAt: timestamp('2026-05-01T10:02:00.000Z') })
    };
    const second = {
      id: 'a-message',
      path: 'path/a-message',
      data: message('a-message', { sortOrder: 1000, createdAt: timestamp('2026-05-01T10:01:00.000Z') })
    };
    const third = {
      id: 'c-message',
      path: 'path/c-message',
      data: message('c-message', { sortOrder: 2000, createdAt: timestamp('2026-05-01T10:00:00.000Z') })
    };

    expect([third, first, second].sort(compareExportedMessages).map((entry) => entry.id)).toEqual([
      'a-message',
      'b-message',
      'c-message'
    ]);
  });

  it('builds single-conversation and all-conversations bundle shapes', () => {
    const single = buildConversationExportBundle({
      userId: 'user-1',
      conversation: { id: 'conversation-1', path: 'users/user-1/conversations/conversation-1', data: conversation() },
      messages: [{ id: 'message-1', path: 'users/user-1/conversations/conversation-1/messages/message-1', data: message('message-1') }],
      exportedAt: new Date('2026-05-28T12:00:00.000Z')
    });
    const all = buildAllConversationsExportBundle({
      userId: 'user-1',
      conversations: [
        {
          id: 'conversation-1',
          path: 'users/user-1/conversations/conversation-1',
          data: conversation(),
          messages: [{ id: 'message-1', path: 'users/user-1/conversations/conversation-1/messages/message-1', data: message('message-1') }]
        }
      ],
      exportedAt: new Date('2026-05-28T12:00:00.000Z')
    });

    expect(single).toMatchObject({ schemaVersion: 1, userId: 'user-1', conversation: { id: 'conversation-1' } });
    expect(all).toMatchObject({
      schemaVersion: 1,
      userId: 'user-1',
      conversations: [{ id: 'conversation-1', messages: [{ id: 'message-1' }] }]
    });
  });

  it('writes readable Markdown without inlining base64 image data', () => {
    const bundle = buildConversationExportBundle({
      userId: 'user-1',
      conversation: { id: 'conversation-1', path: 'users/user-1/conversations/conversation-1', data: conversation() },
      messages: [
        {
          id: 'message-1',
          path: 'users/user-1/conversations/conversation-1/messages/message-1',
          data: message('message-1', {
            text: 'A useful block',
            tags: ['idea', 'agent-test'],
            scheduledAt: timestamp('2026-05-03T09:30:00.000Z'),
            attachments: [
              {
                id: 'image-1',
                type: 'image',
                url: 'data:image/png;base64,secretpayload',
                name: 'clip.png',
                contentType: 'image/png',
                size: 456
              }
            ],
            references: [
              {
                id: 'reference-1',
                type: 'quote',
                sourceConversationId: 'source-conversation',
                sourceConversationTitle: 'Source',
                sourceMessageId: 'source-message',
                quoteText: 'quoted text',
                startOffset: 0,
                endOffset: 11
              }
            ],
            blockKind: 'conversation-index',
            indexEntries: [{ id: 'entry-1', sourceMessageId: 'source-message', title: 'Source entry', summary: 'A summary.' }]
          })
        }
      ],
      exportedAt: new Date('2026-05-28T12:00:00.000Z')
    });
    const markdown = buildConversationExportMarkdown(bundle);
    const allMarkdown = buildAllConversationsExportMarkdown({
      schemaVersion: 1,
      exportedAt: '2026-05-28T12:00:00.000Z',
      userId: 'user-1',
      conversations: [{ ...bundle.conversation, messages: bundle.messages }]
    });

    expect(markdown).toContain('# Research Notes');
    expect(markdown).toContain('A useful block');
    expect(markdown).toContain('- tags: idea, agent-test');
    expect(markdown).toContain('#### References');
    expect(markdown).toContain('#### Attachments');
    expect(markdown).toContain('inline data URL omitted from Markdown; see JSON export');
    expect(markdown).toContain('#### Index Entries');
    expect(markdown).not.toContain('secretpayload');
    expect(allMarkdown).toContain('# Free Writing Export');
  });

  it('downloads JSON and Markdown files for a conversation export', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:download-url');
    const revokeObjectURL = vi.fn<(url: string) => void>();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    try {
      downloadConversationExport(
        buildConversationExportBundle({
          userId: 'user-1',
          conversation: { id: 'conversation-1', path: 'users/user-1/conversations/conversation-1', data: conversation() },
          messages: [],
          exportedAt: new Date('2026-05-28T12:00:00.000Z')
        })
      );

      expect(createObjectURL).toHaveBeenCalledTimes(2);
      expect(click).toHaveBeenCalledTimes(2);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:download-url');
    } finally {
      Object.assign(URL, { createObjectURL: originalCreateObjectURL, revokeObjectURL: originalRevokeObjectURL });
    }
  });
});
