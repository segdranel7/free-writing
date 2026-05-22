import type { Conversation } from '../types';

export type InlineConversationLinkSegment =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'conversation-link';
      text: string;
      title: string;
      conversationId: string;
    };

export type InlineConversationLinkDraft = {
  startOffset: number;
  endOffset: number;
  query: string;
};

export type InlineConversationLinkSuggestion = {
  conversationId: string;
  title: string;
};

const inlineConversationLinkPattern = /\[\[([^\[\]]*)\]\]/g;

function addTextSegment(segments: InlineConversationLinkSegment[], text: string) {
  if (!text) return;
  const previous = segments.at(-1);
  if (previous?.type === 'text') {
    previous.text += text;
    return;
  }
  segments.push({ type: 'text', text });
}

function getUniqueConversationIdByTitle(conversations: Conversation[]) {
  const titleCounts = new Map<string, number>();
  const titleIds = new Map<string, string>();

  conversations.forEach((conversation) => {
    titleCounts.set(conversation.title, (titleCounts.get(conversation.title) ?? 0) + 1);
    titleIds.set(conversation.title, conversation.id);
  });

  return (title: string) => {
    if (titleCounts.get(title) !== 1) return null;
    return titleIds.get(title) ?? null;
  };
}

export function parseInlineConversationLinks(text: string, conversations: Conversation[]) {
  const segments: InlineConversationLinkSegment[] = [];
  const getConversationId = getUniqueConversationIdByTitle(conversations);
  let lastIndex = 0;

  while (lastIndex < text.length) {
    const matchIndex = text.indexOf('[[', lastIndex);
    if (matchIndex < 0) break;
    const closeIndex = text.indexOf(']]', matchIndex + 2);
    if (closeIndex < 0) break;

    const rawTitle = text.slice(matchIndex + 2, closeIndex);
    const nestedOpenIndex = rawTitle.indexOf('[[');
    if (nestedOpenIndex >= 0) {
      const nextCloseIndex = text.indexOf(']]', closeIndex + 2);
      const nestedMarkerEnd = nextCloseIndex >= 0 ? nextCloseIndex + 2 : closeIndex + 2;
      addTextSegment(segments, text.slice(lastIndex, nestedMarkerEnd));
      lastIndex = nestedMarkerEnd;
      continue;
    }

    const marker = text.slice(matchIndex, closeIndex + 2);
    const title = rawTitle.trim();

    addTextSegment(segments, text.slice(lastIndex, matchIndex));

    const conversationId = title ? getConversationId(title) : null;
    if (conversationId) {
      segments.push({
        type: 'conversation-link',
        text: marker,
        title,
        conversationId
      });
    } else {
      addTextSegment(segments, marker);
    }

    lastIndex = closeIndex + 2;
  }

  addTextSegment(segments, text.slice(lastIndex));
  return segments;
}

export function rewriteInlineConversationLinkTitles(text: string, oldTitle: string, newTitle: string) {
  const normalizedOldTitle = oldTitle.trim();
  const normalizedNewTitle = newTitle.trim();
  if (!normalizedOldTitle || !normalizedNewTitle) return text;

  return text.replace(inlineConversationLinkPattern, (marker, rawTitle: string) => {
    return rawTitle.trim() === normalizedOldTitle ? `[[${normalizedNewTitle}]]` : marker;
  });
}

export function getActiveInlineConversationLinkDraft(
  text: string,
  cursorOffset: number
): InlineConversationLinkDraft | null {
  const safeCursorOffset = Math.max(0, Math.min(cursorOffset, text.length));
  const textBeforeCursor = text.slice(0, safeCursorOffset);
  const startOffset = textBeforeCursor.lastIndexOf('[[');
  if (startOffset < 0) return null;

  const query = textBeforeCursor.slice(startOffset + 2);
  if (query.includes(']') || query.includes('\n')) return null;

  return {
    startOffset,
    endOffset: safeCursorOffset,
    query
  };
}

export function getInlineConversationLinkSuggestions(
  conversations: Conversation[],
  query: string,
  maxSuggestions = 8
): InlineConversationLinkSuggestion[] {
  const titleCounts = new Map<string, number>();
  conversations.forEach((conversation) => {
    titleCounts.set(conversation.title, (titleCounts.get(conversation.title) ?? 0) + 1);
  });

  const normalizedQuery = query.trim().toLowerCase();
  const uniqueMatches = conversations.filter((conversation) => {
    if (titleCounts.get(conversation.title) !== 1) return false;
    if (!normalizedQuery) return true;
    return conversation.title.toLowerCase().includes(normalizedQuery);
  });

  return uniqueMatches
    .sort((first, second) => {
      if (!normalizedQuery) return 0;
      const firstStartsWithQuery = first.title.toLowerCase().startsWith(normalizedQuery);
      const secondStartsWithQuery = second.title.toLowerCase().startsWith(normalizedQuery);
      if (firstStartsWithQuery === secondStartsWithQuery) return 0;
      return firstStartsWithQuery ? -1 : 1;
    })
    .slice(0, maxSuggestions)
    .map((conversation) => ({
      conversationId: conversation.id,
      title: conversation.title
    }));
}

export function completeInlineConversationLinkDraft(
  text: string,
  draft: InlineConversationLinkDraft,
  conversationTitle: string
) {
  const completion = `[[${conversationTitle}]]`;
  const nextText = `${text.slice(0, draft.startOffset)}${completion}${text.slice(draft.endOffset)}`;

  return {
    text: nextText,
    cursorOffset: draft.startOffset + completion.length
  };
}
