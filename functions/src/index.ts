import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

initializeApp();

const groqApiKey = defineSecret('GROQ_API_KEY');
const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

type EnglishSegment = {
  original: string;
  options: [string, string, string];
};

type EnglishConversion = {
  segments: EnglishSegment[];
};

function setCorsHeaders(response: { set(field: string, value: string): unknown }) {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function getBearerToken(authorizationHeader: string | undefined) {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isEnglishSegment(value: unknown): value is EnglishSegment {
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

function parseEnglishConversion(content: string): EnglishConversion {
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Groq returned a non-object response.');
  }

  const segments = (parsed as { segments?: unknown }).segments;
  if (!Array.isArray(segments) || segments.length === 0 || !segments.every(isEnglishSegment)) {
    throw new Error('Groq returned no usable English segments.');
  }

  return {
    segments: segments.map((segment) => ({
      original: segment.original.trim(),
      options: segment.options.map((option) => option.trim()) as [string, string, string]
    }))
  };
}

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

export const toEnglish = onRequest(
  {
    region: 'us-central1',
    secrets: [groqApiKey],
    timeoutSeconds: 60,
    memory: '256MiB'
  },
  async (request, response) => {
    setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Use POST for English conversion.' });
      return;
    }

    const token = getBearerToken(request.get('authorization'));
    if (!token) {
      response.status(401).json({ error: 'Sign in before converting text to English.' });
      return;
    }

    try {
      await getAuth().verifyIdToken(token);
    } catch (error) {
      logger.warn('Rejected unauthenticated English conversion request.', error);
      response.status(401).json({ error: 'Sign in again before converting text to English.' });
      return;
    }

    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
    if (!text) {
      response.status(400).json({ error: 'Text is required.' });
      return;
    }

    const apiKey = groqApiKey.value();
    if (!apiKey) {
      response.status(500).json({ error: 'The English conversion service is not configured.' });
      return;
    }

    try {
      const groqResponse = await fetch(groqEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        logger.error('Groq English conversion failed.', groqBody);
        response.status(502).json({ error: groqBody.error?.message ?? 'Unable to convert this text to English.' });
        return;
      }

      const content = groqBody.choices?.[0]?.message?.content;
      if (!content) {
        response.status(502).json({ error: 'The English conversion service returned no content.' });
        return;
      }

      response.json(parseEnglishConversion(content));
    } catch (error) {
      logger.error('English conversion request failed.', error);
      response.status(502).json({ error: 'Unable to convert this text to English.' });
    }
  }
);
