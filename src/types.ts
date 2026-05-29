import type { Timestamp } from 'firebase/firestore';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type Conversation = {
  id: string;
  userId: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessagePreview: string;
  sortOrder?: number;
  visualizationView?: ConversationVisualizationView;
  kanbanColumns?: KanbanColumn[];
};

export type ConversationVisualizationView = 'list' | 'kanban';

export type KanbanColumn = {
  id: string;
  title: string;
  sortOrder: number;
};

export type MessageTransferType = 'forwarded' | 'moved' | null;

export type MessageImageAttachment = {
  id: string;
  type: 'image';
  url: string;
  name: string;
  contentType: string;
  size: number;
};

export type MessageAttachment = MessageImageAttachment;

export type MessageReferenceBase = {
  id: string;
  sourceConversationId: string;
  sourceConversationTitle: string;
};

export type ConversationMessageReference = MessageReferenceBase & {
  type: 'conversation';
};

export type BlockMessageReference = MessageReferenceBase & {
  type: 'block';
  sourceMessageId: string;
  sourceMessagePreview: string;
};

export type QuoteMessageReference = MessageReferenceBase & {
  type: 'quote';
  sourceMessageId: string;
  quoteText: string;
  startOffset: number;
  endOffset: number;
};

export type MessageReference = ConversationMessageReference | BlockMessageReference | QuoteMessageReference;

export type ConversationIndexEntry = {
  id: string;
  sourceMessageId: string;
  title: string;
  summary: string;
};

export type Message = {
  id: string;
  userId: string;
  conversationId: string;
  text: string;
  searchText: string;
  tags: string[];
  attachments?: MessageAttachment[];
  references: MessageReference[];
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  scheduledAt: Timestamp | null;
  sortOrder: number;
  kanbanColumnId?: string | null;
  kanbanSortOrder?: number;
  isForwarded: boolean;
  transferType?: MessageTransferType;
  forwardedFromConversationId: string | null;
  forwardedFromConversationTitle?: string | null;
  forwardedFromMessageId: string | null;
  blockKind?: 'conversation-index';
  indexEntries?: ConversationIndexEntry[];
  isPending?: boolean;
};

export type EnglishSegment = {
  original: string;
  options: [string, string, string];
  separatorAfter?: 'space' | 'line' | 'blankLine';
};

export type EnglishConversion = {
  segments: EnglishSegment[];
};

export type EnglishConversionRequest = {
  text: string;
  contextBefore?: string;
  contextAfter?: string;
};
