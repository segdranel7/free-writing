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
import type { Message } from '../types';
import { touchConversation } from './conversations';

const messagesPath = (userId: string, conversationId: string) =>
  collection(requireDb(), 'users', userId, 'conversations', conversationId, 'messages');

const messagePath = (userId: string, conversationId: string, messageId: string) =>
  doc(requireDb(), 'users', userId, 'conversations', conversationId, 'messages', messageId);

const sortStep = 1000;

function getMessageTime(message: Message) {
  return message.createdAt?.toMillis?.() ?? 0;
}

function normalizeMessages(messages: Message[]) {
  return messages
    .map((message, index) => ({
      ...message,
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

export async function createMessage(userId: string, conversationId: string, text: string) {
  const cleanText = text.trim();
  const sortOrder = await getNextSortOrder(userId, conversationId);
  const message = await addDoc(messagesPath(userId, conversationId), {
    userId,
    conversationId,
    text: cleanText,
    searchText: cleanText.toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: null,
    sortOrder,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null
  });
  await touchConversation(userId, conversationId, cleanText);
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
    batch.set(targetMessage, {
      userId,
      conversationId,
      text: cleanText,
      searchText: cleanText.toLowerCase(),
      createdAt: serverTimestamp(),
      updatedAt: null,
      sortOrder: insertion.sortOrder,
      isForwarded: false,
      transferType: null,
      forwardedFromConversationId: source.conversationId,
      forwardedFromMessageId: source.id
    });
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
  batch.set(targetMessage, {
    userId,
    conversationId,
    text: cleanText,
    searchText: cleanText.toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: null,
    sortOrder: (insertion.sourceIndex + 2) * sortStep,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: source.conversationId,
    forwardedFromMessageId: source.id
  });
  await batch.commit();
  await touchConversation(userId, conversationId, cleanText);
  return targetMessage;
}

export async function editMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  text: string
) {
  const cleanText = text.trim();
  await updateDoc(messagePath(userId, conversationId, messageId), {
    text: cleanText,
    searchText: cleanText.toLowerCase(),
    updatedAt: serverTimestamp()
  });
  await touchConversation(userId, conversationId, cleanText);
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
  const forwarded = await addDoc(messagesPath(userId, targetConversationId), {
    userId,
    conversationId: targetConversationId,
    text: source.text,
    searchText: source.searchText,
    createdAt: serverTimestamp(),
    updatedAt: null,
    sortOrder,
    isForwarded: true,
    transferType: 'forwarded',
    forwardedFromConversationId: source.conversationId,
    forwardedFromMessageId: source.id
  });
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
  batch.set(targetMessage, {
    userId,
    conversationId: targetConversationId,
    text: source.text,
    searchText: source.searchText,
    createdAt: serverTimestamp(),
    updatedAt: null,
    sortOrder,
    isForwarded: true,
    transferType: 'moved',
    forwardedFromConversationId: source.conversationId,
    forwardedFromMessageId: source.id
  });
  batch.delete(messagePath(userId, source.conversationId, source.id));
  await batch.commit();
  await touchConversation(userId, targetConversationId, source.text);
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
