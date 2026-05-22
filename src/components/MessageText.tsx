import { Fragment } from 'react';
import type { Conversation, Message } from '../types';
import { parseInlineConversationLinks } from '../utils/inlineConversationLinks';
import type { MessageReferenceNavigationTarget } from '../utils/messageReferences';

type MessageTextProps = {
  message: Message;
  activeReferenceTarget: MessageReferenceNavigationTarget | null;
  conversations: Conversation[];
  onNavigateToConversation: (conversationId: string) => void;
};

function isMessageTarget(message: Message, target: MessageReferenceNavigationTarget | null) {
  return target?.messageId === message.id && target.conversationId === message.conversationId;
}

function renderInlineConversationLinks(
  text: string,
  conversations: Conversation[],
  onNavigateToConversation: (conversationId: string) => void
) {
  return parseInlineConversationLinks(text, conversations).map((segment, index) => {
    if (segment.type === 'text') return <Fragment key={`text-${index}`}>{segment.text}</Fragment>;

    return (
      <button
        key={`${segment.conversationId}-${index}`}
        className="inline-conversation-link"
        type="button"
        title={`Open ${segment.title}`}
        onClick={() => onNavigateToConversation(segment.conversationId)}
      >
        {segment.title}
      </button>
    );
  });
}

export function MessageText({ message, activeReferenceTarget, conversations, onNavigateToConversation }: MessageTextProps) {
  if (!message.text) return null;

  const range = isMessageTarget(message, activeReferenceTarget) ? activeReferenceTarget?.range : null;
  if (!range || range.endOffset <= range.startOffset) {
    return <p>{renderInlineConversationLinks(message.text, conversations, onNavigateToConversation)}</p>;
  }

  const start = Math.max(0, Math.min(range.startOffset, message.text.length));
  const end = Math.max(start, Math.min(range.endOffset, message.text.length));

  return (
    <p>
      {renderInlineConversationLinks(message.text.slice(0, start), conversations, onNavigateToConversation)}
      <mark className="reference-highlight">
        {renderInlineConversationLinks(message.text.slice(start, end), conversations, onNavigateToConversation)}
      </mark>
      {renderInlineConversationLinks(message.text.slice(end), conversations, onNavigateToConversation)}
    </p>
  );
}
