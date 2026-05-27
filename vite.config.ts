import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createVerify, randomUUID } from 'node:crypto';

const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

type DevEnglishSegment = {
  original: string;
  options: [string, string, string];
  separatorAfter?: 'space' | 'line' | 'blankLine';
};

type DevConversationIndexBlock = {
  id: string;
  position: number;
  text: string;
};

type DevConversationIndexEntry = {
  id: string;
  sourceMessageId: string;
  title: string;
  summary: string;
};

type FirebaseTokenHeader = {
  alg?: unknown;
  kid?: unknown;
};

type FirebaseTokenPayload = {
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  sub?: unknown;
};

let firebaseCertCache: {
  expiresAt: number;
  certs: Record<string, string>;
} | null = null;

const englishSegmentSeparators = new Set(['space', 'line', 'blankLine']);

function buildEnglishPrompt(text: string) {
  return `
You are a translation editor. Convert the provided text to English.

Task:
1. Preserve Markdown-like structure from the original text, including bullet points, numbered lists, dashes, headings, line breaks, and paragraph breaks.
2. Divide the text into sentence-level or line-level segments. Prefer one segment per complete sentence, list item, heading, quote, or short standalone line.
3. Do not merge separate sentences, list items, headings, quotes, or lines into one segment.
4. Split a very long or compound sentence when it contains multiple ideas.
5. Preserve the original order and meaning across all segments.
6. For each segment, provide exactly three distinct, natural English versions.
7. If the original segment is a Markdown structure, keep that structure in every option, such as "- item", "1. item", "> quote", or "# Heading".
8. Set separatorAfter to the spacing that should follow this segment before the next segment:
   - "space" for normal sentence flow in the same paragraph.
   - "line" for a single line break, including between list items or standalone lines.
   - "blankLine" for a paragraph break.

Return ONLY valid JSON with this exact structure:
{
  "segments": [
    {
      "original": "Original segment",
      "options": ["First English version", "Second English version", "Third English version"],
      "separatorAfter": "space"
    }
  ]
}

Text to process:
${text}
`.trim();
}

function buildEnglishFormattingPrompt(text: string) {
  return `
You are an English writing editor. Organize the selected English text into a clear Markdown block before it is submitted.

Task:
1. Keep the user's meaning and wording as intact as possible.
2. Arrange the selected English into a readable structure using Markdown when helpful.
3. You may add concise Markdown elements such as "# Title", "## Subtitle", "- bullet", "1. numbered item", and "> quote" to organize the existing ideas.
4. Preserve all facts, nuance, and ordering from the selected English text.
5. Do not add new facts, conclusions, examples, calls to action, or decorative filler.
6. Prefer readable paragraphs and lists over one flat paragraph.
7. Do not wrap the result in a Markdown code fence.

Return ONLY valid JSON with this exact structure:
{
  "text": "Final Markdown text"
}

Selected English text:
${text}
`.trim();
}

function buildConversationIndexPrompt(conversationTitle: string, blocks: DevConversationIndexBlock[]) {
  return `
You are a conversation cartographer. Create a clickable index for the whole conversation.

Conversation title: ${conversationTitle || 'Untitled conversation'}

Task:
1. First consider the full surrounding context and the progression across all blocks.
2. Then write exactly one index entry for every provided block ID.
3. Do not summarize each block in isolation. Each entry should describe the block's role in the conversation map using nearby and overall context.
4. Preserve the provided block IDs exactly in sourceMessageId.
5. Do not skip, merge, invent, or duplicate entries.
6. Keep titles concise and summaries useful for navigating back to the source block.

Return ONLY valid JSON with this exact structure:
{
  "entries": [
    {
      "sourceMessageId": "source block id",
      "title": "Short index title",
      "summary": "Context-aware navigation summary"
    }
  ]
}

Blocks to index:
${JSON.stringify(blocks, null, 2)}
`.trim();
}

function getBearerToken(authorizationHeader: string | undefined) {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function getMaxAgeSeconds(cacheControl: string | null) {
  const match = cacheControl?.match(/(?:^|,\s*)max-age=(\d+)/i);
  return match ? Number(match[1]) : 3600;
}

async function fetchFirebaseCerts() {
  const now = Date.now();
  if (firebaseCertCache && firebaseCertCache.expiresAt > now) {
    return firebaseCertCache.certs;
  }

  const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!response.ok) {
    throw new Error('Unable to load Firebase token certificates.');
  }

  const certs = await response.json() as Record<string, string>;
  const maxAgeSeconds = getMaxAgeSeconds(response.headers.get('cache-control'));
  firebaseCertCache = {
    certs,
    expiresAt: now + maxAgeSeconds * 1000
  };
  return certs;
}

async function verifyFirebaseTokenForDev(projectId: string, token: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) return false;

  try {
    const header = decodeBase64UrlJson<FirebaseTokenHeader>(encodedHeader);
    const payload = decodeBase64UrlJson<FirebaseTokenPayload>(encodedPayload);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;

    const certs = await fetchFirebaseCerts();
    const cert = certs[header.kid];
    if (!cert) return false;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    if (!verifier.verify(cert, Buffer.from(encodedSignature, 'base64url'))) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    return (
      payload.aud === projectId &&
      payload.iss === `https://securetoken.google.com/${projectId}` &&
      typeof payload.sub === 'string' &&
      payload.sub.length > 0 &&
      typeof payload.exp === 'number' &&
      payload.exp > nowSeconds &&
      typeof payload.iat === 'number' &&
      payload.iat <= nowSeconds + 300
    );
  } catch {
    return false;
  }
}

function isDevEnglishSegment(value: unknown): value is DevEnglishSegment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { original?: unknown; options?: unknown; separatorAfter?: unknown };
  return (
    typeof candidate.original === 'string' &&
    candidate.original.trim().length > 0 &&
    Array.isArray(candidate.options) &&
    candidate.options.length === 3 &&
    candidate.options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
    (candidate.separatorAfter === undefined ||
      (typeof candidate.separatorAfter === 'string' && englishSegmentSeparators.has(candidate.separatorAfter)))
  );
}

function isDevConversationIndexEntry(value: unknown): value is DevConversationIndexEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { sourceMessageId?: unknown; title?: unknown; summary?: unknown };
  return (
    typeof candidate.sourceMessageId === 'string' &&
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.summary === 'string' &&
    candidate.summary.trim().length > 0
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
      options: segment.options.map((option) => option.trim()) as [string, string, string],
      ...(segment.separatorAfter ? { separatorAfter: segment.separatorAfter } : {})
    }))
  };
}

function parseFormattedEnglishJson(content: string) {
  const parsed = JSON.parse(content) as unknown;
  const text = parsed && typeof parsed === 'object' ? (parsed as { text?: unknown }).text : null;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Groq returned no usable formatted English text.');
  }

  return { text: text.trim() };
}

function parseConversationIndexJson(content: string, blocks: DevConversationIndexBlock[]) {
  const parsed = JSON.parse(content) as unknown;
  const entries = parsed && typeof parsed === 'object' ? (parsed as { entries?: unknown }).entries : null;
  if (!Array.isArray(entries) || entries.length !== blocks.length || !entries.every(isDevConversationIndexEntry)) {
    throw new Error('Groq returned no usable conversation index.');
  }

  const expectedIds = new Set(blocks.map((block) => block.id));
  const seenIds = new Set<string>();
  const entriesByMessageId = new Map<string, DevConversationIndexEntry>();

  entries.forEach((entry) => {
    const sourceMessageId = entry.sourceMessageId.trim();
    if (!expectedIds.has(sourceMessageId) || seenIds.has(sourceMessageId)) {
      throw new Error('Groq returned no usable conversation index.');
    }
    seenIds.add(sourceMessageId);
    entriesByMessageId.set(sourceMessageId, {
      id: randomUUID(),
      sourceMessageId,
      title: entry.title.trim(),
      summary: entry.summary.trim()
    });
  });

  if (seenIds.size !== expectedIds.size) {
    throw new Error('Groq returned no usable conversation index.');
  }

  return {
    entries: blocks.map((block) => entriesByMessageId.get(block.id) as DevConversationIndexEntry)
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

function parseSynthesisBody(body: unknown) {
  const conversationTitle = body && typeof body === 'object' && typeof (body as { conversationTitle?: unknown }).conversationTitle === 'string'
    ? (body as { conversationTitle: string }).conversationTitle.trim()
    : '';
  const rawBlocks = body && typeof body === 'object' && Array.isArray((body as { blocks?: unknown }).blocks)
    ? (body as { blocks: unknown[] }).blocks
    : [];
  const blocks = rawBlocks.flatMap((block): DevConversationIndexBlock[] => {
    if (!block || typeof block !== 'object') return [];
    const candidate = block as { id?: unknown; position?: unknown; text?: unknown };
    if (
      typeof candidate.id !== 'string' ||
      candidate.id.trim().length === 0 ||
      typeof candidate.position !== 'number' ||
      !Number.isFinite(candidate.position) ||
      typeof candidate.text !== 'string'
    ) {
      return [];
    }

    return [{
      id: candidate.id.trim(),
      position: candidate.position,
      text: candidate.text.trim() || '[Empty block]'
    }];
  });

  return { conversationTitle, blocks };
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

        if (!env.VITE_FIREBASE_PROJECT_ID || !await verifyFirebaseTokenForDev(env.VITE_FIREBASE_PROJECT_ID, token)) {
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
              messages: [{ role: 'user', content: buildEnglishPrompt(text) }],
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

      server.middlewares.use('/api/format-english', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Use POST for English formatting.' });
          return;
        }

        const token = getBearerToken(request.headers.authorization);
        if (!token) {
          sendJson(response, 401, { error: 'Sign in before organizing English text.' });
          return;
        }

        if (!env.VITE_FIREBASE_PROJECT_ID || !await verifyFirebaseTokenForDev(env.VITE_FIREBASE_PROJECT_ID, token)) {
          sendJson(response, 401, { error: 'Sign in again before organizing English text.' });
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
              messages: [{ role: 'user', content: buildEnglishFormattingPrompt(text) }],
              temperature: 0.5,
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
            sendJson(response, 502, { error: groqBody.error?.message ?? 'Unable to organize this English text.' });
            return;
          }

          const content = groqBody.choices?.[0]?.message?.content;
          if (!content) {
            sendJson(response, 502, { error: 'The English formatting service returned no content.' });
            return;
          }

          sendJson(response, 200, parseFormattedEnglishJson(content));
        } catch (error) {
          console.error('Local English formatting failed.', error);
          sendJson(response, 502, { error: 'Unable to organize this English text.' });
        }
      });

      server.middlewares.use('/api/synthesize-index', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Use POST for conversation index synthesis.' });
          return;
        }

        const token = getBearerToken(request.headers.authorization);
        if (!token) {
          sendJson(response, 401, { error: 'Sign in before synthesizing a conversation index.' });
          return;
        }

        if (!env.VITE_FIREBASE_PROJECT_ID || !await verifyFirebaseTokenForDev(env.VITE_FIREBASE_PROJECT_ID, token)) {
          sendJson(response, 401, { error: 'Sign in again before synthesizing a conversation index.' });
          return;
        }

        if (!env.GROQ_API_KEY) {
          sendJson(response, 500, { error: 'Add GROQ_API_KEY to .env and restart the dev server.' });
          return;
        }

        try {
          const body = await readJsonBody(request);
          const synthesisRequest = parseSynthesisBody(body);

          if (synthesisRequest.blocks.length === 0) {
            sendJson(response, 400, { error: 'Conversation blocks are required.' });
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
              messages: [{
                role: 'user',
                content: buildConversationIndexPrompt(synthesisRequest.conversationTitle, synthesisRequest.blocks)
              }],
              temperature: 0.7,
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
            sendJson(response, 502, { error: groqBody.error?.message ?? 'Unable to synthesize a conversation index.' });
            return;
          }

          const content = groqBody.choices?.[0]?.message?.content;
          if (!content) {
            sendJson(response, 502, { error: 'The conversation index service returned no content.' });
            return;
          }

          sendJson(response, 200, parseConversationIndexJson(content, synthesisRequest.blocks));
        } catch (error) {
          console.error('Local conversation index synthesis failed.', error);
          sendJson(response, 502, { error: 'Unable to synthesize a conversation index.' });
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
          name: 'Free Writing',
          short_name: 'Free Writing',
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
