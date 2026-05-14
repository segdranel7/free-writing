import { auth } from '../firebase';
import type { EnglishConversion, EnglishSegment } from '../types';

const defaultTranslationEndpoint = '/api/to-english';

function isEnglishSegment(value: unknown): value is EnglishSegment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { original?: unknown; options?: unknown };
  return (
    typeof candidate.original === 'string' &&
    Array.isArray(candidate.options) &&
    candidate.options.length === 3 &&
    candidate.options.every((option) => typeof option === 'string' && option.trim().length > 0)
  );
}

function parseEnglishConversion(value: unknown): EnglishConversion {
  if (!value || typeof value !== 'object') {
    throw new Error('The translation service returned an invalid response.');
  }

  const segments = (value as { segments?: unknown }).segments;
  if (!Array.isArray(segments) || segments.length === 0 || !segments.every(isEnglishSegment)) {
    throw new Error('The translation service returned no usable English options.');
  }

  return {
    segments: segments.map((segment) => ({
      original: segment.original.trim(),
      options: segment.options.map((option) => option.trim()) as [string, string, string]
    }))
  };
}

export async function requestEnglishVersions(text: string): Promise<EnglishConversion> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('This text block is empty.');
  }

  const token = await auth?.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Sign in again before converting text to English.');
  }

  const endpoint = import.meta.env.VITE_TRANSLATION_API_URL || defaultTranslationEndpoint;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: cleanText })
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new Error('The translation service returned unreadable JSON.');
    }
  }

  if (!response.ok) {
    const message = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : 'Unable to convert this text to English.';
    throw new Error(message);
  }

  return parseEnglishConversion(body);
}
