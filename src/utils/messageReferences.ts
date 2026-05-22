import type { Conversation, Message, MessageReference } from '../types';

export type MessageReferenceNavigationTarget = {
  conversationId: string;
  messageId?: string;
  range?: {
    startOffset: number;
    endOffset: number;
  };
};

export type MessageBacklink = {
  id: string;
  sourceConversationId: string;
  sourceConversationTitle: string;
  sourceMessageId: string;
  sourceMessagePreview: string;
  reference: Extract<MessageReference, { type: 'block' | 'quote' }>;
};

export type BacklinksByMessageKey = Record<string, MessageBacklink[]>;

export function createReferenceId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getMessageReferenceKey(conversationId: string, messageId: string) {
  return `${conversationId}:${messageId}`;
}

export function createConversationReference(conversation: Conversation): MessageReference {
  return {
    id: createReferenceId(),
    type: 'conversation',
    sourceConversationId: conversation.id,
    sourceConversationTitle: conversation.title
  };
}

export function getMessageReferencePreview(message: Message, maxLength = 120) {
  if (message.text.trim()) return truncateReferenceText(message.text, maxLength);
  const attachmentCount = message.attachments?.length ?? 0;
  if (attachmentCount > 0) return attachmentCount === 1 ? 'Image block' : `Block with ${attachmentCount} images`;
  if (message.blockKind === 'conversation-index') return 'Conversation index block';
  if (message.references.length > 0) {
    return message.references.length === 1 ? 'Reference block' : `Block with ${message.references.length} references`;
  }
  return 'Empty block';
}

export function createBlockReference(conversation: Conversation, message: Message): MessageReference {
  return {
    id: createReferenceId(),
    type: 'block',
    sourceConversationId: conversation.id,
    sourceConversationTitle: conversation.title,
    sourceMessageId: message.id,
    sourceMessagePreview: getMessageReferencePreview(message)
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

export function isDuplicateReference(reference: MessageReference, existingReferences: MessageReference[]) {
  return existingReferences.some((existingReference) => {
    if (existingReference.type !== reference.type) return false;
    if (existingReference.sourceConversationId !== reference.sourceConversationId) return false;

    if (reference.type === 'conversation') return true;
    if (existingReference.type === 'conversation') return false;

    if (existingReference.sourceMessageId !== reference.sourceMessageId) return false;
    if (reference.type === 'block') return true;
    if (existingReference.type === 'block') return false;

    return (
      existingReference.startOffset === reference.startOffset &&
      existingReference.endOffset === reference.endOffset
    );
  });
}

export function appendUniqueReference(references: MessageReference[], reference: MessageReference) {
  return isDuplicateReference(reference, references) ? references : [...references, reference];
}

export function getBacklinksByMessageKey(
  conversations: Conversation[],
  messagesByConversation: Record<string, Message[]>
): BacklinksByMessageKey {
  const conversationTitles = new Map(conversations.map((conversation) => [conversation.id, conversation.title]));
  const backlinks: BacklinksByMessageKey = {};

  conversations.forEach((conversation) => {
    (messagesByConversation[conversation.id] ?? []).forEach((sourceMessage) => {
      sourceMessage.references.forEach((reference) => {
        if (reference.type !== 'block' && reference.type !== 'quote') return;

        const key = getMessageReferenceKey(reference.sourceConversationId, reference.sourceMessageId);
        backlinks[key] = [
          ...(backlinks[key] ?? []),
          {
            id: `${sourceMessage.conversationId}:${sourceMessage.id}:${reference.id}`,
            sourceConversationId: sourceMessage.conversationId,
            sourceConversationTitle: conversationTitles.get(sourceMessage.conversationId) ?? conversation.title,
            sourceMessageId: sourceMessage.id,
            sourceMessagePreview: getMessageReferencePreview(sourceMessage),
            reference
          }
        ];
      });
    });
  });

  return backlinks;
}

export function getReferenceNavigationTarget(reference: MessageReference): MessageReferenceNavigationTarget {
  if (reference.type === 'block') {
    return {
      conversationId: reference.sourceConversationId,
      messageId: reference.sourceMessageId
    };
  }

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
