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
                    options: ['Hello', 'Hi', 'Hey']
                  }
                ]
              })
            }
          }
        ]
      })));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(request(), env);
    const body = await response.json() as { segments: Array<{ original: string; options: string[] }> };

    expect(response.status).toBe(200);
    expect(body.segments[0].original).toBe('Olá');
    expect(body.segments[0].options).toEqual(['Hello', 'Hi', 'Hey']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
