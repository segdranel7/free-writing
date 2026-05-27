import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadMessageAsMarkdown, getMessageMarkdownFilename } from './messageDownload';
import type { Conversation, Message } from '../types';

const timestamp = {
  toDate: () => new Date('2026-05-12T12:00:00Z'),
  toMillis: () => 1
} as Message['createdAt'];

const conversation = {
  id: 'conversation-1',
  userId: 'user-1',
  title: 'Morning Notes / Drafts',
  createdAt: timestamp,
  updatedAt: timestamp,
  lastMessagePreview: ''
} as Conversation;

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'block-1',
    userId: 'user-1',
    conversationId: conversation.id,
    text: '## Heading\n\nA useful note.',
    searchText: 'heading useful note',
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('message markdown downloads', () => {
  it('builds a safe markdown filename from the conversation and block date', () => {
    expect(getMessageMarkdownFilename(message(), conversation.title)).toBe('morning-notes-drafts-2026-05-12-block-1.md');
  });

  it('downloads the block text as a markdown file', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:download-url');
    const revokeObjectURL = vi.fn<(url: string) => void>();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    try {
      downloadMessageAsMarkdown(message(), conversation);

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      await expect(blob.text()).resolves.toBe('## Heading\n\nA useful note.');
      expect(blob.type).toBe('text/markdown;charset=utf-8');
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:download-url');
    } finally {
      Object.assign(URL, {
        createObjectURL: originalCreateObjectURL,
        revokeObjectURL: originalRevokeObjectURL
      });
    }
  });

  it('rejects empty text blocks', () => {
    expect(() => downloadMessageAsMarkdown(message({ text: '   ' }), conversation)).toThrow(
      'This block has no text to download.'
    );
  });
});
