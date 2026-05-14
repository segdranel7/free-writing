import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'node:http';

const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

type DevEnglishSegment = {
  original: string;
  options: [string, string, string];
};

function buildPrompt(text: string) {
  return `
You are a translation editor. Convert the provided text to English.

Task:
1. Divide the text into logical, readable segments. Use sentences or short meaningful phrases.
2. If a sentence is long, break it into individual phrases.
3. For each segment, provide exactly three distinct, natural English versions.

Return ONLY valid JSON with this exact structure:
{
  "segments": [
    {
      "original": "Original segment",
      "options": ["First English version", "Second English version", "Third English version"]
    }
  ]
}

Text to process:
${text}
`.trim();
}

function getBearerToken(authorizationHeader: string | undefined) {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isDevEnglishSegment(value: unknown): value is DevEnglishSegment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { original?: unknown; options?: unknown };
  return (
    typeof candidate.original === 'string' &&
    candidate.original.trim().length > 0 &&
    Array.isArray(candidate.options) &&
    candidate.options.length === 3 &&
    candidate.options.every((option) => typeof option === 'string' && option.trim().length > 0)
  );
}

function parseGroqJson(content: string) {
  const parsed = JSON.parse(content) as unknown;
  const segments = parsed && typeof parsed === 'object' ? (parsed as { segments?: unknown }).segments : null;
  if (!Array.isArray(segments) || segments.length === 0 || !segments.every(isDevEnglishSegment)) {
    throw new Error('Groq returned no usable English segments.');
  }

  return {
    segments: segments.map((segment) => ({
      original: segment.original.trim(),
      options: segment.options.map((option) => option.trim()) as [string, string, string]
    }))
  };
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) as unknown : null;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

async function verifyFirebaseTokenForDev(firebaseApiKey: string, token: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  return response.ok;
}

function localEnglishApi(env: Record<string, string>): Plugin {
  return {
    name: 'local-english-api',
    configureServer(server) {
      server.middlewares.use('/api/to-english', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Use POST for English conversion.' });
          return;
        }

        const token = getBearerToken(request.headers.authorization);
        if (!token) {
          sendJson(response, 401, { error: 'Sign in before converting text to English.' });
          return;
        }

        if (!env.VITE_FIREBASE_API_KEY || !await verifyFirebaseTokenForDev(env.VITE_FIREBASE_API_KEY, token)) {
          sendJson(response, 401, { error: 'Sign in again before converting text to English.' });
          return;
        }

        if (!env.GROQ_API_KEY) {
          sendJson(response, 500, { error: 'Add GROQ_API_KEY to .env and restart the dev server.' });
          return;
        }

        try {
          const body = await readJsonBody(request);
          const text = body && typeof body === 'object' && typeof (body as { text?: unknown }).text === 'string'
            ? (body as { text: string }).text.trim()
            : '';

          if (!text) {
            sendJson(response, 400, { error: 'Text is required.' });
            return;
          }

          const groqResponse = await fetch(groqEndpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [{ role: 'user', content: buildPrompt(text) }],
              temperature: 1,
              max_completion_tokens: 4096,
              top_p: 1,
              reasoning_effort: 'medium',
              stream: false,
              response_format: { type: 'json_object' }
            })
          });

          const groqBody = await groqResponse.json() as {
            error?: { message?: string };
            choices?: Array<{ message?: { content?: string } }>;
          };

          if (!groqResponse.ok) {
            sendJson(response, 502, { error: groqBody.error?.message ?? 'Unable to convert this text to English.' });
            return;
          }

          const content = groqBody.choices?.[0]?.message?.content;
          if (!content) {
            sendJson(response, 502, { error: 'The English conversion service returned no content.' });
            return;
          }

          sendJson(response, 200, parseGroqJson(content));
        } catch (error) {
          console.error('Local English conversion failed.', error);
          sendJson(response, 502, { error: 'Unable to convert this text to English.' });
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts'
    },
    plugins: [
      localEnglishApi(env),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-192.svg', 'pwa-512.svg'],
        manifest: {
          name: 'My Messages',
          short_name: 'Messages',
          description: 'Private conversations for your own notes and text blocks.',
          theme_color: '#101719',
          background_color: '#101719',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: '/pwa-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}']
        }
      })
    ]
  };
});
