import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type WorkerEnv } from './index';

const env: WorkerEnv = {
  FIREBASE_API_KEY: 'firebase-api-key',
  GROQ_API_KEY: 'groq-api-key',
  ALLOWED_ORIGINS: 'https://free-writing-e29a1.web.app,http://localhost:5173'
};

function request(init: RequestInit = {}) {
  return new Request('https://free-writing-translation.example.workers.dev/api/to-english', {
    method: 'POST',
    headers: {
      Origin: 'https://free-writing-e29a1.web.app',
      Authorization: 'Bearer id-token',
      'Content-Type': 'application/json',
      ...init.headers
    },
    body: JSON.stringify({ text: ' Olá ' }),
    ...init
  });
}

function selectedTextRequest() {
  return request({
    body: JSON.stringify({
      text: 'mundo',
      contextBefore: 'Olá',
      contextAfter: 'bonito'
    })
  });
}

function synthesisRequest(init: RequestInit = {}) {
  return new Request('https://free-writing-translation.example.workers.dev/api/synthesize-index', {
    method: 'POST',
    headers: {
      Origin: 'https://free-writing-e29a1.web.app',
      Authorization: 'Bearer id-token',
      'Content-Type': 'application/json',
      ...init.headers
    },
    body: JSON.stringify({
      conversationTitle: 'Inbox',
      blocks: [
        { id: 'first', position: 1, text: 'First block' },
        { id: 'second', position: 2, text: 'Second block' }
      ]
    }),
    ...init
  });
}

describe('translation worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('handles CORS preflight requests', async () => {
    const response = await worker.fetch(request({ method: 'OPTIONS', body: null }), env);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://free-writing-e29a1.web.app');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('requires a bearer token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(request({ headers: { Origin: 'https://free-writing-e29a1.web.app' } }), env);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain('Sign in');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid Firebase tokens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'invalid' } }), { status: 400 })));

    const response = await worker.fetch(request(), env);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain('Sign in again');
  });

  it('requires non-empty text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ users: [{ localId: 'user-id' }] }))));

    const response = await worker.fetch(request({ body: JSON.stringify({ text: '   ' }) }), env);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('Text is required');
  });

  it('returns Groq error messages as 502 responses', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'user-id' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Groq unavailable' } }), { status: 503 })));

    const response = await worker.fetch(request(), env);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toBe('Groq unavailable');
  });

  it('returns parsed English segments from Groq', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'user-id' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                segments: [
                  {
                    original: 'Olá',
                    options: ['Hello', 'Hi', 'Hey'],
                    separatorAfter: 'line'
                  }
                ]
              })
            }
          }
        ]
      })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(request(), env);
    const body = await response.json() as {
      segments: Array<{ original: string; options: string[]; separatorAfter?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.segments[0].original).toBe('Olá');
    expect(body.segments[0].options).toEqual(['Hello', 'Hi', 'Hey']);
    expect(body.segments[0]).toEqual(expect.objectContaining({ separatorAfter: 'line' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const groqRequest = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      messages: Array<{ content: string }>;
    };
    expect(groqRequest.messages[0]?.content).toContain('Preserve Markdown-like structure');
    expect(groqRequest.messages[0]?.content).toContain('Process only the selected text');
    expect(groqRequest.messages[0]?.content).toContain('sentence-level or line-level segments');
    expect(groqRequest.messages[0]?.content).toContain('list item, heading, quote, or short standalone line');
    expect(groqRequest.messages[0]?.content).toContain('separatorAfter');
    expect(groqRequest.messages[0]?.content).toContain('"blankLine" for a paragraph break');
  });

  it('uses surrounding context without asking Groq to process it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'user-id' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                segments: [
                  {
                    original: 'mundo',
                    options: ['world', 'earth', 'the world']
                  }
                ]
              })
            }
          }
        ]
      })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(selectedTextRequest(), env);

    expect(response.status).toBe(200);
    const groqRequest = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      messages: Array<{ content: string }>;
    };
    expect(groqRequest.messages[0]?.content).toContain('Context before selected text:\nOlá');
    expect(groqRequest.messages[0]?.content).toContain('Context after selected text:\nbonito');
    expect(groqRequest.messages[0]?.content).toContain('Never translate, rewrite, segment, summarize, or include the surrounding context');
    expect(groqRequest.messages[0]?.content).toContain('Selected text to process:\nmundo');
  });

  it('organizes selected English text into Markdown before submission', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'user-id' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: '# Plan\n\n- Ready to send'
              })
            }
          }
        ]
      })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://free-writing-translation.example.workers.dev/api/format-english', {
      method: 'POST',
      body: JSON.stringify({ text: 'Ready to send', selectedSegments: ['Ready to send'] }),
      headers: {
        Origin: 'https://free-writing-e29a1.web.app',
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json'
      }
    }), env);
    const body = await response.json() as { text: string };

    expect(response.status).toBe(200);
    expect(body.text).toBe('# Plan\n\n- Ready to send');

    const groqRequest = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      messages: Array<{ content: string }>;
      temperature: number;
    };
    expect(groqRequest.messages[0]?.content).toContain('Organize the selected English text');
    expect(groqRequest.messages[0]?.content).toContain('before it is submitted');
    expect(groqRequest.messages[0]?.content).toContain('immutable source text');
    expect(groqRequest.messages[0]?.content).toContain('Every selected segment must appear verbatim');
    expect(groqRequest.messages[0]?.content).toContain('Selected English segments that must be preserved verbatim');
    expect(groqRequest.messages[0]?.content).toContain('You may add concise organizational text and Markdown elements');
    expect(groqRequest.messages[0]?.content).toContain('Do not add new facts');
    expect(groqRequest.temperature).toBe(0.5);
  });

  it('rejects formatted English that removes a selected segment', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'user-id' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: '# Plan\n\n- Ready to send'
              })
            }
          }
        ]
      })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://free-writing-translation.example.workers.dev/api/format-english', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Ready to send\nKeep this exact sentence',
        selectedSegments: ['Ready to send', 'Keep this exact sentence']
      }),
      headers: {
        Origin: 'https://free-writing-e29a1.web.app',
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json'
      }
    }), env);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain('Unable to organize');
  });

  it('returns parsed conversation index entries from Groq', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'user-id' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                entries: [
                  {
                    sourceMessageId: 'first',
                    title: 'Opening',
                    summary: 'Starts the conversation.'
                  },
                  {
                    sourceMessageId: 'second',
                    title: 'Follow-up',
                    summary: 'Builds on the opening.'
                  }
                ]
              })
            }
          }
        ]
      })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(synthesisRequest(), env);
    const body = await response.json() as { entries: Array<{ sourceMessageId: string; title: string; summary: string }> };

    expect(response.status).toBe(200);
    expect(body.entries.map((entry) => entry.sourceMessageId)).toEqual(['first', 'second']);
    expect(body.entries[0].title).toBe('Opening');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const groqRequest = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      messages: Array<{ content: string }>;
    };
    expect(groqRequest.messages[0]?.content).toContain('full surrounding context');
    expect(groqRequest.messages[0]?.content).toContain('Do not summarize each block in isolation');
    expect(groqRequest.messages[0]?.content).toContain('exactly one index entry for every provided block ID');
    expect(groqRequest.messages[0]?.content).toContain('"id": "first"');
    expect(groqRequest.messages[0]?.content).toContain('"id": "second"');
  });

  it('requires conversation blocks for synthesis', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ users: [{ localId: 'user-id' }] }))));

    const response = await worker.fetch(synthesisRequest({ body: JSON.stringify({ conversationTitle: 'Inbox', blocks: [] }) }), env);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('Conversation blocks are required');
  });

  it('rejects synthesis responses that do not cover every submitted block exactly once', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ localId: 'user-id' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                entries: [
                  {
                    sourceMessageId: 'first',
                    title: 'Opening',
                    summary: 'Starts the conversation.'
                  }
                ]
              })
            }
          }
        ]
      })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(synthesisRequest(), env);
    const body = await response.json() as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain('Unable to synthesize');
  });
});
