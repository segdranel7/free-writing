import type { Conversation, Message } from '../types';

export const conversationExportSchemaVersion = 1;

const maxFilenameTitleLength = 64;

export type ExportedDocument<TData> = {
  id: string;
  path: string;
  data: TData;
};

export type ConversationExportBundle = {
  schemaVersion: number;
  exportedAt: string;
  userId: string;
  conversation: ExportedDocument<Record<string, unknown>>;
  messages: Array<ExportedDocument<Record<string, unknown>>>;
};

export type AllConversationsExportBundle = {
  schemaVersion: number;
  exportedAt: string;
  userId: string;
  conversations: Array<ExportedDocument<Record<string, unknown>> & {
    messages: Array<ExportedDocument<Record<string, unknown>>>;
  }>;
};

type ExportConversationInput = {
  userId: string;
  conversation: ExportedDocument<Conversation>;
  messages: Array<ExportedDocument<Message>>;
  exportedAt?: Date;
};

type ExportAllConversationsInput = {
  userId: string;
  conversations: Array<ExportedDocument<Conversation> & { messages: Array<ExportedDocument<Message>> }>;
  exportedAt?: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

type TimestampLike = Record<string, unknown> & {
  toDate: () => Date;
  toMillis?: () => number;
};

function isFirestoreTimestamp(value: unknown): value is TimestampLike {
  return isRecord(value) && typeof value.toDate === 'function';
}

function getTimestampMillis(value: unknown) {
  if (!value) return 0;
  if (isRecord(value) && typeof value.toMillis === 'function') return value.toMillis();
  if (isFirestoreTimestamp(value)) return value.toDate().getTime();
  if (isRecord(value) && typeof value.iso === 'string') return Date.parse(value.iso) || 0;
  return 0;
}

function serializeTimestamp(value: TimestampLike) {
  const date = value.toDate();
  const seconds = typeof value.seconds === 'number' ? value.seconds : value._seconds;
  const nanoseconds = typeof value.nanoseconds === 'number' ? value.nanoseconds : value._nanoseconds;

  return {
    __type: 'timestamp',
    iso: date?.toISOString() ?? '',
    ...(typeof seconds === 'number' ? { seconds } : {}),
    ...(typeof nanoseconds === 'number' ? { nanoseconds } : {})
  };
}

export function serializeFirestoreValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (isFirestoreTimestamp(value)) return serializeTimestamp(value);
  if (value instanceof Date) return { __type: 'date', iso: value.toISOString() };
  if (Array.isArray(value)) return value.map((item) => serializeFirestoreValue(item));
  if (value instanceof Uint8Array) return { __type: 'bytes', base64: bytesToBase64(value) };

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [key, serializeFirestoreValue(entryValue)])
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function compareExportedMessages(
  first: ExportedDocument<{ sortOrder?: unknown; createdAt?: unknown }>,
  second: ExportedDocument<{ sortOrder?: unknown; createdAt?: unknown }>
) {
  const firstOrder = first.data.sortOrder;
  const secondOrder = second.data.sortOrder;
  const firstHasOrder = typeof firstOrder === 'number';
  const secondHasOrder = typeof secondOrder === 'number';

  if (firstHasOrder && secondHasOrder && firstOrder !== secondOrder) return firstOrder - secondOrder;
  if (firstHasOrder !== secondHasOrder) return firstHasOrder ? -1 : 1;

  const timeDelta = getTimestampMillis(first.data.createdAt) - getTimestampMillis(second.data.createdAt);
  if (timeDelta !== 0) return timeDelta;

  return first.id.localeCompare(second.id);
}

function compareExportedConversations(
  first: ExportedDocument<{ sortOrder?: unknown; updatedAt?: unknown; createdAt?: unknown }>,
  second: ExportedDocument<{ sortOrder?: unknown; updatedAt?: unknown; createdAt?: unknown }>
) {
  const firstOrder = first.data.sortOrder;
  const secondOrder = second.data.sortOrder;
  if (typeof firstOrder === 'number' && typeof secondOrder === 'number' && firstOrder !== secondOrder) {
    return firstOrder - secondOrder;
  }

  const timeDelta =
    getTimestampMillis(second.data.updatedAt ?? second.data.createdAt) -
    getTimestampMillis(first.data.updatedAt ?? first.data.createdAt);
  if (timeDelta !== 0) return timeDelta;

  return first.id.localeCompare(second.id);
}

function serializeDocument<TData>(document: ExportedDocument<TData>) {
  return {
    id: document.id,
    path: document.path,
    data: serializeFirestoreValue(document.data) as Record<string, unknown>
  };
}

export function buildConversationExportBundle({
  userId,
  conversation,
  messages,
  exportedAt = new Date()
}: ExportConversationInput): ConversationExportBundle {
  return {
    schemaVersion: conversationExportSchemaVersion,
    exportedAt: exportedAt.toISOString(),
    userId,
    conversation: serializeDocument(conversation),
    messages: [...messages].sort(compareExportedMessages).map(serializeDocument)
  };
}

export function buildAllConversationsExportBundle({
  userId,
  conversations,
  exportedAt = new Date()
}: ExportAllConversationsInput): AllConversationsExportBundle {
  return {
    schemaVersion: conversationExportSchemaVersion,
    exportedAt: exportedAt.toISOString(),
    userId,
    conversations: [...conversations].sort(compareExportedConversations).map((conversation) => ({
      ...serializeDocument(conversation),
      messages: [...conversation.messages].sort(compareExportedMessages).map(serializeDocument)
    }))
  };
}

export function sanitizeFilenamePart(value: string | null | undefined, fallback = 'conversation') {
  const sanitized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxFilenameTitleLength)
    .replace(/-+$/g, '');

  return sanitized || fallback;
}

function getExportDate(value: string) {
  return value.slice(0, 10);
}

export function getConversationExportBaseName(bundle: ConversationExportBundle) {
  const title = typeof bundle.conversation.data.title === 'string' ? bundle.conversation.data.title : bundle.conversation.id;
  return `${sanitizeFilenamePart(title)}-${getExportDate(bundle.exportedAt)}-${bundle.conversation.id}`;
}

export function getAllConversationsExportBaseName(bundle: AllConversationsExportBundle) {
  return `free-writing-export-${getExportDate(bundle.exportedAt)}`;
}

function formatSerializedTimestamp(value: unknown) {
  return isRecord(value) && typeof value.iso === 'string' ? value.iso : '';
}

function formatKeyValueRows(entries: Array<[string, unknown]>) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join('\n');
}

function formatAttachmentForMarkdown(attachment: Record<string, unknown>, index: number) {
  const url =
    typeof attachment.url === 'string' && attachment.url.startsWith('data:')
      ? 'inline data URL omitted from Markdown; see JSON export'
      : attachment.url;

  return formatKeyValueRows([
    ['attachment', index + 1],
    ['id', attachment.id],
    ['type', attachment.type],
    ['name', attachment.name],
    ['contentType', attachment.contentType],
    ['size', attachment.size],
    ['url', url]
  ]);
}

function formatReferenceForMarkdown(reference: Record<string, unknown>, index: number) {
  return formatKeyValueRows([
    ['reference', index + 1],
    ['id', reference.id],
    ['type', reference.type],
    ['sourceConversationId', reference.sourceConversationId],
    ['sourceConversationTitle', reference.sourceConversationTitle],
    ['sourceMessageId', reference.sourceMessageId],
    ['sourceMessagePreview', reference.sourceMessagePreview],
    ['quoteText', reference.quoteText],
    ['startOffset', reference.startOffset],
    ['endOffset', reference.endOffset]
  ]);
}

function formatIndexEntryForMarkdown(entry: Record<string, unknown>, index: number) {
  return formatKeyValueRows([
    ['indexEntry', index + 1],
    ['id', entry.id],
    ['sourceMessageId', entry.sourceMessageId],
    ['title', entry.title],
    ['summary', entry.summary]
  ]);
}

function formatMessageMetadata(message: ExportedDocument<Record<string, unknown>>) {
  const data = message.data;
  return formatKeyValueRows([
    ['id', message.id],
    ['path', message.path],
    ['createdAt', formatSerializedTimestamp(data.createdAt)],
    ['updatedAt', formatSerializedTimestamp(data.updatedAt)],
    ['scheduledAt', formatSerializedTimestamp(data.scheduledAt)],
    ['sortOrder', data.sortOrder],
    ['kanbanColumnId', data.kanbanColumnId],
    ['kanbanSortOrder', data.kanbanSortOrder],
    ['tags', data.tags],
    ['blockKind', data.blockKind],
    ['transferType', data.transferType],
    ['isForwarded', data.isForwarded],
    ['forwardedFromConversationId', data.forwardedFromConversationId],
    ['forwardedFromConversationTitle', data.forwardedFromConversationTitle],
    ['forwardedFromMessageId', data.forwardedFromMessageId]
  ]);
}

function renderConversationMarkdown(
  conversation: ExportedDocument<Record<string, unknown>>,
  messages: Array<ExportedDocument<Record<string, unknown>>>,
  level = 1
) {
  const title = typeof conversation.data.title === 'string' ? conversation.data.title : conversation.id;
  const heading = '#'.repeat(level);
  const messageHeading = '#'.repeat(level + 1);
  const lines = [
    `${heading} ${title}`,
    '',
    formatKeyValueRows([
      ['conversationId', conversation.id],
      ['conversationPath', conversation.path],
      ['createdAt', formatSerializedTimestamp(conversation.data.createdAt)],
      ['updatedAt', formatSerializedTimestamp(conversation.data.updatedAt)],
      ['sortOrder', conversation.data.sortOrder],
      ['visualizationView', conversation.data.visualizationView],
      ['messageCount', messages.length]
    ]),
    ''
  ];

  messages.forEach((message, index) => {
    const data = message.data;
    lines.push(`${messageHeading} ${index + 1}. ${message.id}`, '', formatMessageMetadata(message), '');

    if (typeof data.text === 'string' && data.text.trim()) {
      lines.push(data.text, '');
    } else {
      lines.push('_No text content._', '');
    }

    if (Array.isArray(data.references) && data.references.length > 0) {
      lines.push(`${messageHeading}# References`, '');
      data.references.forEach((reference, referenceIndex) => {
        if (isRecord(reference)) lines.push(formatReferenceForMarkdown(reference, referenceIndex), '');
      });
    }

    if (Array.isArray(data.attachments) && data.attachments.length > 0) {
      lines.push(`${messageHeading}# Attachments`, '');
      data.attachments.forEach((attachment, attachmentIndex) => {
        if (isRecord(attachment)) lines.push(formatAttachmentForMarkdown(attachment, attachmentIndex), '');
      });
    }

    if (Array.isArray(data.indexEntries) && data.indexEntries.length > 0) {
      lines.push(`${messageHeading}# Index Entries`, '');
      data.indexEntries.forEach((entry, entryIndex) => {
        if (isRecord(entry)) lines.push(formatIndexEntryForMarkdown(entry, entryIndex), '');
      });
    }
  });

  return lines.join('\n');
}

export function buildConversationExportMarkdown(bundle: ConversationExportBundle) {
  const title = typeof bundle.conversation.data.title === 'string' ? bundle.conversation.data.title : bundle.conversation.id;
  const lines = [
    `# ${title}`,
    '',
    formatKeyValueRows([
      ['schemaVersion', bundle.schemaVersion],
      ['exportedAt', bundle.exportedAt],
      ['userId', bundle.userId]
    ]),
    '',
    renderConversationMarkdown(bundle.conversation, bundle.messages, 2)
  ];

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function buildAllConversationsExportMarkdown(bundle: AllConversationsExportBundle) {
  const lines = [
    '# Free Writing Export',
    '',
    formatKeyValueRows([
      ['schemaVersion', bundle.schemaVersion],
      ['exportedAt', bundle.exportedAt],
      ['userId', bundle.userId],
      ['conversationCount', bundle.conversations.length]
    ]),
    ''
  ];

  bundle.conversations.forEach((conversation) => {
    lines.push(renderConversationMarkdown(conversation, conversation.messages, 2), '');
  });

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function downloadTextFile(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadConversationExport(bundle: ConversationExportBundle) {
  const baseName = getConversationExportBaseName(bundle);
  downloadTextFile(`${baseName}.json`, `${JSON.stringify(bundle, null, 2)}\n`, 'application/json;charset=utf-8');
  downloadTextFile(`${baseName}.md`, buildConversationExportMarkdown(bundle), 'text/markdown;charset=utf-8');
}

export function downloadAllConversationsExport(bundle: AllConversationsExportBundle) {
  const baseName = getAllConversationsExportBaseName(bundle);
  downloadTextFile(`${baseName}.json`, `${JSON.stringify(bundle, null, 2)}\n`, 'application/json;charset=utf-8');
  downloadTextFile(`${baseName}.md`, buildAllConversationsExportMarkdown(bundle), 'text/markdown;charset=utf-8');
}
