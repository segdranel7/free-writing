import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Conversation, Message } from '../types';
import { parseInlineConversationLinks } from '../utils/inlineConversationLinks';
import type { MessageReferenceNavigationTarget } from '../utils/messageReferences';

const LARGE_TEXT_CHARACTER_LIMIT = 280;
const LARGE_TEXT_LINE_LIMIT = 3;
const COLLAPSED_TEXT_CHARACTER_LIMIT = 210;

type MessageTextProps = {
  message: Message;
  activeReferenceTarget: MessageReferenceNavigationTarget | null;
  conversations: Conversation[];
  onNavigateToConversation: (conversationId: string) => void;
};

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] };

function isMessageTarget(message: Message, target: MessageReferenceNavigationTarget | null) {
  return target?.messageId === message.id && target.conversationId === message.conversationId;
}

function isLargeText(text: string) {
  return text.length > LARGE_TEXT_CHARACTER_LIMIT || text.split('\n').length > LARGE_TEXT_LINE_LIMIT;
}

function createCollapsedText(text: string) {
  const linePreview = text.split('\n').slice(0, LARGE_TEXT_LINE_LIMIT).join('\n');
  const preview = linePreview.length > COLLAPSED_TEXT_CHARACTER_LIMIT
    ? linePreview.slice(0, COLLAPSED_TEXT_CHARACTER_LIMIT).trimEnd()
    : linePreview.trimEnd();

  return `${preview}...`;
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

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = text.trim().split('\n');
  let index = 0;

  function readParagraph() {
    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      if (isMarkdownBoundary(lines[index]) && paragraphLines.length > 0) break;
      paragraphLines.push(lines[index]);
      index += 1;
      if (paragraphLines.length === 1 && isMarkdownBoundary(paragraphLines[0])) break;
    }
    return paragraphLines.join('\n').trim();
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      index += 1;
      continue;
    }

    const heading = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim()
      });
      index += 1;
      continue;
    }

    if (/^>\s+/.test(trimmedLine)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s+/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n').trim() });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmedLine)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const paragraph = readParagraph();
    if (paragraph) blocks.push({ type: 'paragraph', text: paragraph });
  }

  return blocks;
}

function isMarkdownBoundary(line: string) {
  const trimmedLine = line.trim();
  return /^(#{1,3})\s+/.test(trimmedLine) ||
    /^>\s+/.test(trimmedLine) ||
    /^[-*+]\s+/.test(trimmedLine) ||
    /^\d+\.\s+/.test(trimmedLine);
}

function renderLinkedTextWithBreaks(
  text: string,
  conversations: Conversation[],
  onNavigateToConversation: (conversationId: string) => void
) {
  return text.split('\n').map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 && <br />}
      {renderInlineConversationLinks(line, conversations, onNavigateToConversation)}
    </Fragment>
  ));
}

function renderMarkdownText(
  text: string,
  conversations: Conversation[],
  onNavigateToConversation: (conversationId: string) => void
) {
  return (
    <div className="message-markdown">
      {parseMarkdownBlocks(text).map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${block.level}` as 'h1' | 'h2' | 'h3';
          return (
            <HeadingTag key={`heading-${index}`}>
              {renderInlineConversationLinks(block.text, conversations, onNavigateToConversation)}
            </HeadingTag>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={`blockquote-${index}`}>
              {renderLinkedTextWithBreaks(block.text, conversations, onNavigateToConversation)}
            </blockquote>
          );
        }

        if (block.type === 'unordered-list') {
          return (
            <ul key={`ul-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>
                  {renderLinkedTextWithBreaks(item, conversations, onNavigateToConversation)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={`ol-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>
                  {renderLinkedTextWithBreaks(item, conversations, onNavigateToConversation)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`paragraph-${index}`}>
            {renderLinkedTextWithBreaks(block.text, conversations, onNavigateToConversation)}
          </p>
        );
      })}
    </div>
  );
}

export function MessageText({ message, activeReferenceTarget, conversations, onNavigateToConversation }: MessageTextProps) {
  const isReferenceTarget = isMessageTarget(message, activeReferenceTarget);
  const range = isReferenceTarget ? activeReferenceTarget?.range : null;
  const shouldTruncate = useMemo(() => isLargeText(message.text), [message.text]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [message.id, message.text]);

  useEffect(() => {
    if (isReferenceTarget) setIsExpanded(true);
  }, [isReferenceTarget]);

  if (!message.text) return null;

  const displayedText = shouldTruncate && !isExpanded ? createCollapsedText(message.text) : message.text;

  function renderTextContent() {
    if (shouldTruncate && !isExpanded) {
      return renderInlineConversationLinks(displayedText, conversations, onNavigateToConversation);
    }

    if (!range || range.endOffset <= range.startOffset) {
      return renderInlineConversationLinks(displayedText, conversations, onNavigateToConversation);
    }

    const start = Math.max(0, Math.min(range.startOffset, displayedText.length));
    const end = Math.max(start, Math.min(range.endOffset, displayedText.length));

    return (
      <>
        {renderInlineConversationLinks(displayedText.slice(0, start), conversations, onNavigateToConversation)}
        <mark className="reference-highlight">
          {renderInlineConversationLinks(displayedText.slice(start, end), conversations, onNavigateToConversation)}
        </mark>
        {renderInlineConversationLinks(displayedText.slice(end), conversations, onNavigateToConversation)}
      </>
    );
  }

  if (!shouldTruncate) {
    if (!range || range.endOffset <= range.startOffset) {
      return renderMarkdownText(displayedText, conversations, onNavigateToConversation);
    }

    return <p>{renderTextContent()}</p>;
  }

  return (
    <div className="message-text-block">
      {isExpanded && (!range || range.endOffset <= range.startOffset) ? (
        renderMarkdownText(displayedText, conversations, onNavigateToConversation)
      ) : (
        <p>{renderTextContent()}</p>
      )}
      <button
        className="message-expand-button"
        type="button"
        title={isExpanded ? 'Collapse text block' : 'Expand text block'}
        aria-label={isExpanded ? 'Collapse text block' : 'Expand text block'}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
