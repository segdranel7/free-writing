import type { Conversation, Message, MessageReference } from '../types';

export type MessageReferenceNavigationTarget = {
  conversationId: string;
  messageId?: string;
  range?: {
    startOffset: number;
    endOffset: number;
  };
};

export function createReferenceId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createConversationReference(conversation: Conversation): MessageReference {
  return {
    id: createReferenceId(),
    type: 'conversation',
    sourceConversationId: conversation.id,
    sourceConversationTitle: conversation.title
  };
}

export function createQuoteReference(
  conversation: Conversation,
  message: Message,
  startOffset: number,
  endOffset: number
): MessageReference | null {
  const start = Math.max(0, Math.min(startOffset, message.text.length));
  const end = Math.max(start, Math.min(endOffset, message.text.length));
  const quoteText = message.text.slice(start, end).trim();
  if (!quoteText) return null;

  return {
    id: createReferenceId(),
    type: 'quote',
    sourceConversationId: conversation.id,
    sourceConversationTitle: conversation.title,
    sourceMessageId: message.id,
    quoteText,
    startOffset: start,
    endOffset: end
  };
}

export function truncateReferenceText(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function getReferenceNavigationTarget(reference: MessageReference): MessageReferenceNavigationTarget {
  if (reference.type === 'quote') {
    return {
      conversationId: reference.sourceConversationId,
      messageId: reference.sourceMessageId,
      range: {
        startOffset: reference.startOffset,
        endOffset: reference.endOffset
      }
    };
  }

  return {
    conversationId: reference.sourceConversationId
  };
}
