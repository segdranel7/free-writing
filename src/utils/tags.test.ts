import { describe, expect, it } from 'vitest';
import { normalizeTags } from './tags';

describe('normalizeTags', () => {
  it('trims empty tags and dedupes case-insensitively while preserving first casing', () => {
    expect(normalizeTags(['  Urgent ', '', 'urgent', 'Idea', ' idea  ', 'Flag'])).toEqual(['Urgent', 'Idea', 'Flag']);
  });
});
