import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { requireDb } from '../firebase';
import type { ConversationIndexEntry, Message, MessageAttachment, MessageReference } from '../types';
import { touchConversation } from './conversations';
import { getSelectedTextFromRanges, removeTextRanges, type TextSelectionRange } from '../utils/textSelection';
import { normalizeTags } from '../utils/tags';

const messagesPath = (userId: string, conversationId: string) =>
  collection(requireDb(), 'users', userId, 'conversations', conversationId, 'messages');

const messagePath = (userId: string, conversationId: string, messageId: string) =>
  doc(requireDb(), 'users', userId, 'conversations', conversationId, 'messages', messageId);

const sortStep = 1000;

type ScheduledAtWriteValue = Date | Message['scheduledAt'] | null;

export type MessageKanbanPlacement = {
  columnId: string | null;
  sortOrder?: number;
};

type MessageWriteInput = {
  userId: string;
  conversationId: string;
  text: string;
  searchText?: string;
  tags?: string[];
  attachments?: MessageAttachment[];
  references?: MessageReference[];
  scheduledAt?: ScheduledAtWriteValue;
  sortOrder: number;
  kanbanPlacement?: MessageKanbanPlacement | null;
  isForwarded?: boolean;
  transferType?: Message['transferType'];
  forwardedFromConversationId?: string | null;
  forwardedFromConversationTitle?: string | null;
  forwardedFromMessageId?: string | null;
  blockKind?: Message['blockKind'];
  indexEntries?: ConversationIndexEntry[];
};

function getMessageTime(message: Message) {
  return message.createdAt?.toMillis?.() ?? 0;
}

function buildMessageWrite({
  userId,
  conversationId,
  text,
  searchText,
  tags = [],
  attachments = [],
  references = [],
  scheduledAt = null,
  sortOrder,
  kanbanPlacement = null,
  isForwarded = false,
  transferType = null,
  forwardedFromConversationId = null,
  forwardedFromConversationTitle = null,
  forwardedFromMessageId = null,
  blockKind,
  indexEntries
}: MessageWriteInput) {
  const normalizedTags = normalizeTags(tags);
  const message = {
    userId,
    conversationId,
    text,
    searchText: searchText ?? text.toLowerCase(),
    references,
    createdAt: serverTimestamp(),
    updatedAt: null,
    scheduledAt,
    sortOrder,
    ...(kanbanPlacement?.columnId
      ? {
          kanbanColumnId: kanbanPlacement.columnId,
          kanbanSortOrder: kanbanPlacement.sortOrder ?? sortOrder
        }
      : {}),
    isForwarded,
    transferType,
    forwardedFromConversationId,
    forwardedFromConversationTitle,
    forwardedFromMessageId
  };

  return {
    ...message,
    ...(normalizedTags.length > 0 ? { tags: normalizedTags } : {}),
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(blockKind ? { blockKind } : {}),
    ...(indexEntries ? { indexEntries } : {})
  };
}

function buildTransferredMessageWrite(
  userId: string,
  source: Message,
  targetConversationId: string,
  sortOrder: number,
  transferType: 'forwarded' | 'moved',
  sourceConversationTitle: string | null = null
) {
  return buildMessageWrite({
    userId,
    conversationId: targetConversationId,
    text: source.text,
    searchText: source.searchText,
    tags: source.tags ?? [],
    attachments: source.attachments ?? [],
    references: source.references ?? [],
    scheduledAt: source.scheduledAt ?? null,
    sortOrder,
    isForwarded: true,
    transferType,
    forwardedFromConversationId: source.conversationId,
    forwardedFromConversationTitle: transferType === 'forwarded' ? sourceConversationTitle : null,
    forwardedFromMessageId: source.id
  });
}

function normalizeMessages(messages: Message[]) {
  return messages
    .map((message, index) => ({
      ...message,
      attachments: message.attachments ?? [],
      references: message.references ?? [],
      tags: normalizeTags(message.tags ?? []),
      scheduledAt: message.scheduledAt ?? null,
      indexEntries: message.indexEntries ?? [],
      sortOrder: typeof message.sortOrder === 'number' ? message.sortOrder : (index + 1) * sortStep,
      kanbanColumnId: typeof message.kanbanColumnId === 'string' ? message.kanbanColumnId : null,
      kanbanSortOrder:
        typeof message.kanbanSortOrder === 'number'
          ? message.kanbanSortOrder
          : typeof message.sortOrder === 'number'
            ? message.sortOrder
            : (index + 1) * sortStep,
      transferType: message.transferType ?? (message.isForwarded ? 'forwarded' : null),
      forwardedFromConversationTitle: message.forwardedFromConversationTitle ?? null
    }))
    .sort(
      (first, second) =>
        first.sortOrder - second.sortOrder || getMessageTime(first) - getMessageTime(second) || first.id.localeCompare(second.id)
    );
}

async function getNextSortOrder(userId: string, conversationId: string) {
  const snapshot = await getDocs(query(messagesPath(userId, conversationId), orderBy('createdAt', 'asc')));
  const messages = normalizeMessages(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Message));
  return (messages.at(-1)?.sortOrder ?? 0) + sortStep;
}

export function listenForMessages(
  userId: string,
  conversationId: string,
  onChange: (messages: Message[]) => void
) {
  const q = query(messagesPath(userId, conversationId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    onChange(normalizeMessages(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Message)));
  });
}

function getMessagePreview(text: string, attachments: MessageAttachment[], references: MessageReference[] = []) {
  if (text) return text;
  if (attachments.length > 0) return attachments.length === 1 ? 'Image' : `${attachments.length} images`;
  if (references.length > 0) return references.length === 1 ? 'Reference' : `${references.length} references`;
  return '';
}

export async function createMessage(
  userId: string,
  conversationId: string,
  text: string,
  attachments: MessageAttachment[] = [],
  references: MessageReference[] = [],
  scheduledAt: Date | null = null,
  kanbanPlacement: MessageKanbanPlacement | null = null
) {
  const cleanText = text.trim();
  if (!cleanText && attachments.length === 0 && references.length === 0) return null;
  const sortOrder = await getNextSortOrder(userId, conversationId);
  const message = await addDoc(messagesPath(userId, conversationId), buildMessageWrite({
    userId,
    conversationId,
    text: cleanText,
    attachments,
    references,
    scheduledAt,
    sortOrder,
    kanbanPlacement
  }));
  await touchConversation(userId, conversationId, getMessagePreview(cleanText, attachments, references), {
    moveToTop: true
  });
  return message;
}

export function reserveMessageId(userId: string, conversationId: string) {
  return doc(messagesPath(userId, conversationId)).id;
}

export async function createMessageWithId(
  userId: string,
  conversationId: string,
  messageId: string,
  text: string,
  sortOrder: number,
  attachments: MessageAttachment[] = [],
  references: MessageReference[] = [],
  scheduledAt: Date | null = null,
  kanbanPlacement: MessageKanbanPlacement | null = null
) {
  const cleanText = text.trim();
  if (!messageId || (!cleanText && attachments.length === 0 && references.length === 0)) return null;
  const message = messagePath(userId, conversationId, messageId);
  const batch = writeBatch(requireDb());
  batch.set(message, buildMessageWrite({
    userId,
    conversationId,
    text: cleanText,
    attachments,
    references,
    scheduledAt,
    sortOrder,
    kanbanPlacement
  }));
  await batch.commit();
  await touchConversation(userId, conversationId, getMessagePreview(cleanText, attachments, references), {
    moveToTop: true
  });
  return message;
}

export async function createConversationIndexMessage(
  userId: string,
  conversationId: string,
  text: string,
  indexEntries: ConversationIndexEntry[]
) {
  const cleanText = text.trim();
  if (!cleanText || indexEntries.length === 0) return null;
  const sortOrder = await getNextSortOrder(userId, conversationId);
  const message = await addDoc(messagesPath(userId, conversationId), buildMessageWrite({
    userId,
    conversationId,
    text: cleanText,
    sortOrder,
    blockKind: 'conversation-index',
    indexEntries
  }));
  await touchConversation(userId, conversationId, cleanText, { moveToTop: true });
  return message;
}

function getSortOrderAfterSource(messages: Message[], source: Message) {
  const sourceIndex = messages.findIndex((message) => message.id === source.id);
  const normalizedSourceIndex = sourceIndex >= 0 ? sourceIndex : messages.length - 1;
  const previousSortOrder = messages[normalizedSourceIndex]?.sortOrder ?? source.sortOrder ?? 0;
  const nextSortOrder = messages[normalizedSourceIndex + 1]?.sortOrder;

  if (typeof nextSortOrder !== 'number') {
    return { sortOrder: previousSortOrder + sortStep, needsRebalance: false, sourceIndex: normalizedSourceIndex };
  }

  const midpoint = Math.floor((previousSortOrder + nextSortOrder) / 2);
  return {
    sortOrder: midpoint,
    needsRebalance: midpoint <= previousSortOrder,
    sourceIndex: normalizedSourceIndex
  };
}

export async function createMessageAfter(
  userId: string,
  conversationId: string,
  source: Message,
  messages: Message[],
  text: string
) {
  const cleanText = text.trim();
  const orderedMessages = normalizeMessages(messages);
  const insertion = getSortOrderAfterSource(orderedMessages, source);
  const targetMessage = doc(messagesPath(userId, conversationId));

  if (!insertion.needsRebalance) {
    const batch = writeBatch(requireDb());
    batch.set(targetMessage, buildMessageWrite({
      userId,
      conversationId,
      text: cleanText,
      sortOrder: insertion.sortOrder,
      tags: source.tags ?? [],
      forwardedFromConversationId: source.conversationId,
      forwardedFromMessageId: source.id
    }));
    await batch.commit();
    await touchConversation(userId, conversationId, cleanText, { moveToTop: true });
    return targetMessage;
  }

  const batch = writeBatch(requireDb());
  orderedMessages.forEach((message, index) => {
    const shiftedIndex = index > insertion.sourceIndex ? index + 1 : index;
    batch.update(messagePath(userId, conversationId, message.id), {
      sortOrder: (shiftedIndex + 1) * sortStep
    });
  });
  batch.set(targetMessage, buildMessageWrite({
    userId,
    conversationId,
    text: cleanText,
    sortOrder: (insertion.sourceIndex + 2) * sortStep,
    tags: source.tags ?? [],
    forwardedFromConversationId: source.conversationId,
    forwardedFromMessageId: source.id
  }));
  await batch.commit();
  await touchConversation(userId, conversationId, cleanText, { moveToTop: true });
  return targetMessage;
}

export async function editMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  text: string,
  attachments?: MessageAttachment[],
  references?: MessageReference[],
  scheduledAt?: Date | null
) {
  const cleanText = text.trim();
  const updates: {
    text: string;
    searchText: string;
    updatedAt: ReturnType<typeof serverTimestamp>;
    attachments?: MessageAttachment[];
    references?: MessageReference[];
    scheduledAt?: Date | null;
  } = {
    text: cleanText,
    searchText: cleanText.toLowerCase(),
    updatedAt: serverTimestamp()
  };
  if (attachments) updates.attachments = attachments;
  if (references) updates.references = references;
  if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt;
  await updateDoc(messagePath(userId, conversationId, messageId), updates);
  await touchConversation(userId, conversationId, getMessagePreview(cleanText, attachments ?? [], references ?? []));
}

export async function updateMessageTags(userId: string, conversationId: string, messageId: string, tags: string[]) {
  await updateDoc(messagePath(userId, conversationId, messageId), {
    tags: normalizeTags(tags),
    updatedAt: serverTimestamp()
  });
}

export async function updateMessageReferences(
  userId: string,
  conversationId: string,
  messageId: string,
  references: MessageReference[]
) {
  await updateDoc(messagePath(userId, conversationId, messageId), {
    references,
    updatedAt: serverTimestamp()
  });
}

export async function updateMessageKanbanPlacement(
  userId: string,
  conversationId: string,
  messageId: string,
  placement: MessageKanbanPlacement | null
) {
  await updateDoc(messagePath(userId, conversationId, messageId), {
    kanbanColumnId: placement?.columnId ?? null,
    kanbanSortOrder: placement?.columnId ? placement.sortOrder ?? sortStep : null,
    updatedAt: serverTimestamp()
  });
}

export function deleteMessage(userId: string, conversationId: string, messageId: string) {
  return deleteDoc(messagePath(userId, conversationId, messageId));
}

export async function forwardMessage(
  userId: string,
  source: Message,
  targetConversationId: string,
  sourceConversationTitle: string | null = null
) {
  const sortOrder = await getNextSortOrder(userId, targetConversationId);
  const forwarded = await addDoc(
    messagesPath(userId, targetConversationId),
    buildTransferredMessageWrite(userId, source, targetConversationId, sortOrder, 'forwarded', sourceConversationTitle)
  );
  await touchConversation(userId, targetConversationId, source.text, { moveToTop: true });
  return forwarded;
}

export async function moveMessage(
  userId: string,
  source: Message,
  targetConversationId: string
) {
  const sortOrder = await getNextSortOrder(userId, targetConversationId);
  const targetMessage = doc(messagesPath(userId, targetConversationId));
  const batch = writeBatch(requireDb());
  batch.set(targetMessage, buildTransferredMessageWrite(userId, source, targetConversationId, sortOrder, 'moved'));
  batch.delete(messagePath(userId, source.conversationId, source.id));
  await batch.commit();
  await touchConversation(userId, targetConversationId, source.text, { moveToTop: true });
  return targetMessage;
}

export async function moveMessageTextSelection(
  userId: string,
  source: Message,
  targetConversationId: string,
  ranges: TextSelectionRange[]
) {
  const selectedText = getSelectedTextFromRanges(source.text, ranges);
  if (!selectedText) return null;

  const remainingText = removeTextRanges(source.text, ranges);
  const sortOrder = await getNextSortOrder(userId, targetConversationId);
  const targetMessage = doc(messagesPath(userId, targetConversationId));
  const batch = writeBatch(requireDb());

  batch.set(
    targetMessage,
    buildMessageWrite({
      userId,
      conversationId: targetConversationId,
      text: selectedText,
      sortOrder,
      isForwarded: true,
      transferType: 'moved',
      forwardedFromConversationId: source.conversationId,
      forwardedFromConversationTitle: null,
      forwardedFromMessageId: source.id
    })
  );

  if (!remainingText && (source.attachments?.length ?? 0) === 0 && source.references.length === 0) {
    batch.delete(messagePath(userId, source.conversationId, source.id));
  } else {
    batch.update(messagePath(userId, source.conversationId, source.id), {
      text: remainingText,
      searchText: remainingText.toLowerCase(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
  await touchConversation(userId, targetConversationId, selectedText, { moveToTop: true });
  await touchConversation(
    userId,
    source.conversationId,
    getMessagePreview(remainingText, source.attachments ?? [], source.references)
  );
  return targetMessage;
}

export async function mergeMessages(userId: string, conversationId: string, messages: Message[]) {
  const selectedMessages = normalizeMessages(messages);
  const mergedText = selectedMessages.map((message) => message.text.trim()).filter(Boolean).join('\n\n').trim();
  const mergedAttachments = selectedMessages.flatMap((message) => message.attachments ?? []);
  const mergedTags = normalizeTags(selectedMessages.flatMap((message) => message.tags ?? []));
  const earliestScheduledAt =
    selectedMessages
      .map((message) => message.scheduledAt)
      .filter((scheduledAt): scheduledAt is NonNullable<Message['scheduledAt']> => Boolean(scheduledAt))
      .sort((first, second) => first.toMillis() - second.toMillis())[0] ?? null;
  if (selectedMessages.length < 2 || (!mergedText && mergedAttachments.length === 0)) return null;

  const targetMessage = doc(messagesPath(userId, conversationId));
  const batch = writeBatch(requireDb());
  batch.set(targetMessage, buildMessageWrite({
    userId,
    conversationId,
    text: mergedText,
    attachments: mergedAttachments,
    tags: mergedTags,
    scheduledAt: earliestScheduledAt,
    sortOrder: selectedMessages[0].sortOrder
  }));
  selectedMessages.forEach((message) => {
    batch.delete(messagePath(userId, conversationId, message.id));
  });
  await batch.commit();
  await touchConversation(userId, conversationId, getMessagePreview(mergedText, mergedAttachments));
  return targetMessage;
}

export async function reorderMessages(userId: string, conversationId: string, messages: Message[]) {
  const batch = writeBatch(requireDb());
  messages.forEach((message, index) => {
    batch.update(messagePath(userId, conversationId, message.id), {
      sortOrder: (index + 1) * sortStep
    });
  });
  await batch.commit();
}

export async function reorderKanbanMessages(
  userId: string,
  conversationId: string,
  columnId: string,
  messages: Message[]
) {
  const batch = writeBatch(requireDb());
  messages.forEach((message, index) => {
    batch.update(messagePath(userId, conversationId, message.id), {
      kanbanColumnId: columnId,
      kanbanSortOrder: (index + 1) * sortStep
    });
  });
  await batch.commit();
}
