import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../types';
import { copyMessageToClipboard } from './messageClipboard';

const timestamp = {
  toDate: () => new Date('2026-05-12T12:00:00Z'),
  toMillis: () => 1
} as Message['createdAt'];

const originalClipboard = navigator.clipboard;
const originalClipboardItem = globalThis.ClipboardItem;

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    userId: 'user-1',
    conversationId: 'conversation-1',
    text: 'Message text',
    searchText: 'message text',
    tags: [],
    references: [],
    createdAt: timestamp,
    updatedAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null,
    ...overrides
  };
}

function imageAttachment(overrides: Partial<NonNullable<Message['attachments']>[number]> = {}) {
  return {
    id: 'image-1',
    type: 'image' as const,
    url: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=',
    name: 'note.png',
    contentType: 'image/png',
    size: 11,
    ...overrides
  };
}

function mockRichClipboard(write = vi.fn().mockResolvedValue(undefined)) {
  const clipboardItems: Array<Record<string, Blob>> = [];

  class MockClipboardItem {
    constructor(items: Record<string, Blob>) {
      clipboardItems.push(items);
    }
  }

  Object.assign(globalThis, { ClipboardItem: MockClipboardItem });
  Object.assign(navigator, {
    clipboard: {
      write,
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });

  return { clipboardItems, write, writeText: navigator.clipboard.writeText as ReturnType<typeof vi.fn> };
}

afterEach(() => {
  Object.assign(globalThis, { ClipboardItem: originalClipboardItem });
  Object.assign(navigator, { clipboard: originalClipboard });
});

describe('copyMessageToClipboard', () => {
  it('escapes message text and attachment alt text in rich clipboard HTML', async () => {
    const { clipboardItems } = mockRichClipboard();
    const richMessage = message({
      text: '<b>Fish & "chips"</b>\nline two',
      attachments: [
        imageAttachment({
          name: 'bad "alt" <tag> & value'
        })
      ]
    });

    await copyMessageToClipboard(richMessage);

    const html = await clipboardItems[0]['text/html'].text();
    expect(html).toContain('&lt;b&gt;Fish &amp; &quot;chips&quot;&lt;/b&gt;<br>line two');
    expect(html).toContain('alt="bad &quot;alt&quot; &lt;tag&gt; &amp; value"');
  });

  it('falls back to plain text when rich clipboard APIs are unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(globalThis, { ClipboardItem: undefined });
    Object.assign(navigator, {
      clipboard: {
        writeText
      }
    });

    await copyMessageToClipboard(message({ text: 'Plain text only', attachments: [imageAttachment()] }));

    expect(writeText).toHaveBeenCalledWith('Plain text only');
  });

  it('falls back to plain text when rich clipboard writes fail for a text block', async () => {
    const write = vi.fn().mockRejectedValue(new Error('Rich clipboard unavailable'));
    const { writeText } = mockRichClipboard(write);

    await copyMessageToClipboard(message({ text: 'Fallback text', attachments: [imageAttachment()] }));

    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('Fallback text');
  });

  it('throws when an image-only block cannot be written through rich clipboard APIs', async () => {
    const write = vi.fn().mockRejectedValue(new Error('Rich clipboard unavailable'));
    const { writeText } = mockRichClipboard(write);

    await expect(copyMessageToClipboard(message({ text: '', attachments: [imageAttachment()] }))).rejects.toThrow(
      'Rich clipboard unavailable'
    );

    expect(writeText).not.toHaveBeenCalled();
  });
});
