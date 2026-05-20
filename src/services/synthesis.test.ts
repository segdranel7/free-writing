import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../types';

const firebaseMocks = vi.hoisted(() => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn(async () => 'id-token')
    } as { getIdToken: () => Promise<string> } | null
  }
}));

vi.mock('../firebase', () => firebaseMocks);

import { requestConversationIndex } from './synthesis';

const timestamp = {
  toMillis: () => 1
} as Message['createdAt'];

function message(id: string, text: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    userId: 'user-1',
    conversationId: 'conversation-1',
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
    forwardedFromMessageId: null,
    ...overrides
  };
}

describe('synthesis service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    firebaseMocks.auth.currentUser = {
      getIdToken: vi.fn(async () => 'id-token')
    };
  });

  it('posts all visible blocks with the current Firebase ID token in one request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      entries: [
        {
          sourceMessageId: 'first',
          title: 'Opening',
          summary: 'Starts the conversation.'
        },
        {
          sourceMessageId: 'image-only',
          title: 'Attached image',
          summary: 'Marks the visual reference.'
        }
      ]
    })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestConversationIndex([
      message('first', '  First block  '),
      message('image-only', '', {
        attachments: [
          {
            id: 'image-1',
            type: 'image',
            url: 'data:image/png;base64,aW1hZ2U=',
            name: 'note.png',
            contentType: 'image/png',
            size: 12
          }
        ]
      })
    ], 'Inbox');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/synthesize-index', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationTitle: 'Inbox',
        blocks: [
          { id: 'first', position: 1, text: 'First block' },
          { id: 'image-only', position: 2, text: '[1 image attachment]' }
        ]
      })
    });
    expect(result.entries.map((entry) => entry.sourceMessageId)).toEqual(['first', 'image-only']);
  });

  it('can use an explicit synthesis endpoint', async () => {
    vi.stubEnv('VITE_SYNTHESIS_API_URL', 'https://worker.example/api/synthesize-index');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      entries: [
        {
          sourceMessageId: 'first',
          title: 'Opening',
          summary: 'Starts the conversation.'
        }
      ]
    })));
    vi.stubGlobal('fetch', fetchMock);

    await requestConversationIndex([message('first', 'First')], 'Inbox');

    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/api/synthesize-index', expect.any(Object));
  });

  it('derives the synthesis path from an existing translation worker URL', async () => {
    vi.stubEnv('VITE_TRANSLATION_API_URL', 'https://worker.example/api/to-english');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      entries: [
        {
          sourceMessageId: 'first',
          title: 'Opening',
          summary: 'Starts the conversation.'
        }
      ]
    })));
    vi.stubGlobal('fetch', fetchMock);

    await requestConversationIndex([message('first', 'First')], 'Inbox');

    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/api/synthesize-index', expect.any(Object));
  });

  it('rejects invalid or incomplete synthesis responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      entries: [
        {
          sourceMessageId: 'unknown',
          title: 'Unknown',
          summary: 'Does not map to a block.'
        }
      ]
    }))));

    await expect(requestConversationIndex([message('first', 'First')], 'Inbox')).rejects.toThrow('no usable conversation index');
  });

  it('uses API error messages when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Groq unavailable' }), { status: 502 })));

    await expect(requestConversationIndex([message('first', 'First')], 'Inbox')).rejects.toThrow('Groq unavailable');
  });

  it('requires a signed-in Firebase user', async () => {
    firebaseMocks.auth.currentUser = null;

    await expect(requestConversationIndex([message('first', 'First')], 'Inbox')).rejects.toThrow('Sign in again');
  });
});
