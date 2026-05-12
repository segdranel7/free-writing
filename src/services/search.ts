import type { Conversation, Message } from '../types';

export type SearchResult = {
  message: Message;
  conversation: Conversation;
};

export function searchLoadedMessages(
  term: string,
  conversations: Conversation[],
  messagesByConversation: Record<string, Message[]>
): SearchResult[] {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];

  return conversations.flatMap((conversation) => {
    const messages = messagesByConversation[conversation.id] ?? [];
    return messages
      .filter((message) => message.searchText.includes(normalized))
      .map((message) => ({ conversation, message }));
  });
}
