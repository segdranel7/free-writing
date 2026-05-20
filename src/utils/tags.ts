import type { Message } from '../types';

export type TagSummary = {
  name: string;
  count: number;
};

export type TaggedMessageResult = {
  message: Message;
  tag: string;
};

export function normalizeTags(tags: readonly string[] = []) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  tags.forEach((tag) => {
    const cleanTag = tag.trim();
    if (!cleanTag) return;

    const key = cleanTag.toLocaleLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    normalized.push(cleanTag);
  });

  return normalized;
}

export function getTagKey(tag: string) {
  return tag.trim().toLocaleLowerCase();
}

export function messageMatchesAnyTag(message: Message, selectedTags: readonly string[]) {
  if (selectedTags.length === 0) return true;
  const messageTagKeys = new Set((message.tags ?? []).map(getTagKey));
  return selectedTags.some((tag) => messageTagKeys.has(getTagKey(tag)));
}

export function getTagSummaries(messages: readonly Message[]): TagSummary[] {
  const tagCounts = new Map<string, { name: string; count: number }>();

  messages.forEach((message) => {
    normalizeTags(message.tags ?? []).forEach((tag) => {
      const key = getTagKey(tag);
      const current = tagCounts.get(key);
      tagCounts.set(key, {
        name: current?.name ?? tag,
        count: (current?.count ?? 0) + 1
      });
    });
  });

  return Array.from(tagCounts.values()).sort(
    (first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
  );
}
