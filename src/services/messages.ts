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
import type { Message, MessageAttachment, MessageReference } from '../types';
import { touchConversation } from './conversations';

const messagesPath = (userId: string, conversationId: string) =>
  collection(requireDb(), 'users', userId, 'conversations', conversationId, 'messages');

const messagePath = (userId: string, conversationId: string, messageId: string) =>
  doc(requireDb(), 'users', userId, 'conversations', conversationId, 'messages', messageId);

const sortStep = 1000;

type MessageWriteInput = {
  userId: string;
  conversationId: string;
  text: string;
  searchText?: string;
  attachments?: MessageAttachment[];
  references?: MessageReference[];
  sortOrder: number;
  isForwarded?: boolean;
  transferType?: Message['transferType'];
  forwardedFromConversationId?: string | null;
  forwardedFromMessageId?: string | null;
};

function getMessageTime(message: Message) {
  return message.createdAt?.toMillis?.() ?? 0;
}

function buildMessageWrite({
  userId,
  conversationId,
  text,
  searchText,
  attachments = [],
  references = [],
  sortOrder,
  isForwarded = false,
  transferType = null,
  forwardedFromConversationId = null,
  forwardedFromMessageId = null
}: MessageWriteInput) {
  const message = {
    userId,
    conversationId,
    text,
    searchText: searchText ?? text.toLowerCase(),
    references,
    createdAt: serverTimestamp(),
    updatedAt: null,
    sortOrder,
    isForwarded,
    transferType,
    forwardedFromConversationId,
    forwardedFromMessageId
  };

  return attachments.length > 0 ? { ...message, attachments } : message;
}

function buildTransferredMessageWrite(
  userId: string,
  source: Message,
  targetConversationId: string,
  sortOrder: number,
  transferType: 'forwarded' | 'moved'
) {
  return buildMessageWrite({
    userId,
    conversationId: targetConversationId,
    text: source.text,
    searchText: source.searchText,
    attachments: source.attachments ?? [],
    references: source.references ?? [],
    sortOrder,
    isForwarded: true,
    transferType,
    forwardedFromConversationId: source.conversationId,
    forwardedFromMessageId: source.id
  });
}

function normalizeMessages(messages: Message[]) {
  return messages
    .map((message, index) => ({
      ...message,
      attachments: message.attachments ?? [],
      references: message.references ?? [],
      sortOrder: typeof message.sortOrder === 'number' ? message.sortOrder : (index + 1) * sortStep,
      transferType: message.transferType ?? (message.isForwarded ? 'forwarded' : null)
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
  references: MessageReference[] = []
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
    sortOrder
  }));
  await touchConversation(userId, conversationId, getMessagePreview(cleanText, attachments, references));
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
      forwardedFromConversationId: source.conversationId,
      forwardedFromMessageId: source.id
    }));
    await batch.commit();
    await touchConversation(userId, conversationId, cleanText);
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
    forwardedFromConversationId: source.conversationId,
    forwardedFromMessageId: source.id
  }));
  await batch.commit();
  await touchConversation(userId, conversationId, cleanText);
  return targetMessage;
}

export async function editMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  text: string,
  attachments?: MessageAttachment[],
  references?: MessageReference[]
) {
  const cleanText = text.trim();
  const updates: {
    text: string;
    searchText: string;
    updatedAt: ReturnType<typeof serverTimestamp>;
    attachments?: MessageAttachment[];
    references?: MessageReference[];
  } = {
    text: cleanText,
    searchText: cleanText.toLowerCase(),
    updatedAt: serverTimestamp()
  };
  if (attachments) updates.attachments = attachments;
  if (references) updates.references = references;
  await updateDoc(messagePath(userId, conversationId, messageId), updates);
  await touchConversation(userId, conversationId, getMessagePreview(cleanText, attachments ?? [], references ?? []));
}

export function deleteMessage(userId: string, conversationId: string, messageId: string) {
  return deleteDoc(messagePath(userId, conversationId, messageId));
}

export async function forwardMessage(
  userId: string,
  source: Message,
  targetConversationId: string
) {
  const sortOrder = await getNextSortOrder(userId, targetConversationId);
  const forwarded = await addDoc(
    messagesPath(userId, targetConversationId),
    buildTransferredMessageWrite(userId, source, targetConversationId, sortOrder, 'forwarded')
  );
  await touchConversation(userId, targetConversationId, source.text);
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
  await touchConversation(userId, targetConversationId, source.text);
  return targetMessage;
}

export async function mergeMessages(userId: string, conversationId: string, messages: Message[]) {
  const selectedMessages = normalizeMessages(messages);
  const mergedText = selectedMessages.map((message) => message.text.trim()).filter(Boolean).join('\n\n').trim();
  const mergedAttachments = selectedMessages.flatMap((message) => message.attachments ?? []);
  if (selectedMessages.length < 2 || (!mergedText && mergedAttachments.length === 0)) return null;

  const targetMessage = doc(messagesPath(userId, conversationId));
  const batch = writeBatch(requireDb());
  batch.set(targetMessage, buildMessageWrite({
    userId,
    conversationId,
    text: mergedText,
    attachments: mergedAttachments,
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
