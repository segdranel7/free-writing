import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn(async () => 'id-token')
    } as { getIdToken: () => Promise<string> } | null
  }
}));

vi.mock('../firebase', () => firebaseMocks);

import { requestEnglishVersions, requestStructuredEnglishText } from './translation';

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
          options: ['Hello', 'Hi', 'Hey'],
          separatorAfter: 'line'
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
    expect(result.segments[0].separatorAfter).toBe('line');
  });

  it('posts selected text with surrounding context', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      segments: [
        {
          original: 'mundo',
          options: ['world', 'earth', 'the world']
        }
      ]
    })));
    vi.stubGlobal('fetch', fetchMock);

    await requestEnglishVersions({
      text: ' mundo ',
      contextBefore: 'Olá ',
      contextAfter: ' bonito '
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/to-english', expect.objectContaining({
      body: JSON.stringify({
        text: 'mundo',
        contextBefore: 'Olá',
        contextAfter: 'bonito'
      })
    }));
  });

  it('rejects invalid or empty translation responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ segments: [] }))));

    await expect(requestEnglishVersions('Olá')).rejects.toThrow('no usable English options');
  });

  it('rejects unsupported segment separators', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      segments: [
        {
          original: 'Olá',
          options: ['Hello', 'Hi', 'Hey'],
          separatorAfter: 'paragraph'
        }
      ]
    }))));

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

  it('posts selected English text to the formatting endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      text: '# Notes\n\n- Ready to send'
    })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestStructuredEnglishText('  Ready to send  ', [' Ready to send ']);

    expect(fetchMock).toHaveBeenCalledWith('/api/format-english', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: 'Ready to send', selectedSegments: ['Ready to send'] })
    });
    expect(result).toBe('# Notes\n\n- Ready to send');
  });

  it('rejects invalid formatting responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: '   ' }))));

    await expect(requestStructuredEnglishText('Ready')).rejects.toThrow('no usable text');
  });
});
