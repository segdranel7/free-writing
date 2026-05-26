import type { Conversation, Message } from '../types';

const MAX_FILENAME_TITLE_LENGTH = 48;

function getMessageDate(message: Message) {
  return message.createdAt.toDate().toISOString().slice(0, 10);
}

function sanitizeFilenamePart(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_FILENAME_TITLE_LENGTH)
    .replace(/-+$/g, '');

  return sanitized || 'block';
}

export function getMessageMarkdownFilename(message: Message, conversationTitle?: string | null) {
  const titlePart = sanitizeFilenamePart(conversationTitle ?? 'block');
  return `${titlePart}-${getMessageDate(message)}-${message.id}.md`;
}

export function downloadMessageAsMarkdown(message: Message, conversation?: Conversation | null) {
  if (!message.text.trim()) throw new Error('This block has no text to download.');

  const blob = new Blob([message.text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = getMessageMarkdownFilename(message, conversation?.title);
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
