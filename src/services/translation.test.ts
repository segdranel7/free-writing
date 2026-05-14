import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn(async () => 'id-token')
    } as { getIdToken: () => Promise<string> } | null
  }
}));

vi.mock('../firebase', () => firebaseMocks);

import { requestEnglishVersions } from './translation';

describe('translation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    firebaseMocks.auth.currentUser = {
      getIdToken: vi.fn(async () => 'id-token')
    };
  });

  it('posts trimmed text with the current Firebase ID token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      segments: [
        {
          original: 'Olá',
          options: ['Hello', 'Hi', 'Hey']
        }
      ]
    })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestEnglishVersions('  Olá  ');

    expect(fetchMock).toHaveBeenCalledWith('/api/to-english', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: 'Olá' })
    });
    expect(result.segments[0].options).toEqual(['Hello', 'Hi', 'Hey']);
  });

  it('rejects invalid or empty translation responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ segments: [] }))));

    await expect(requestEnglishVersions('Olá')).rejects.toThrow('no usable English options');
  });

  it('uses API error messages when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Groq unavailable' }), { status: 502 })));

    await expect(requestEnglishVersions('Olá')).rejects.toThrow('Groq unavailable');
  });

  it('requires a signed-in Firebase user', async () => {
    firebaseMocks.auth.currentUser = null;

    await expect(requestEnglishVersions('Olá')).rejects.toThrow('Sign in again');
  });
});
