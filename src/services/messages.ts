import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { requireDb } from '../firebase';
import type { Message } from '../types';
import { touchConversation } from './conversations';

const messagesPath = (userId: string, conversationId: string) =>
  collection(requireDb(), 'users', userId, 'conversations', conversationId, 'messages');

const messagePath = (userId: string, conversationId: string, messageId: string) =>
  doc(requireDb(), 'users', userId, 'conversations', conversationId, 'messages', messageId);

export function listenForMessages(
  userId: string,
  conversationId: string,
  onChange: (messages: Message[]) => void
) {
  const q = query(messagesPath(userId, conversationId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Message));
  });
}

export async function createMessage(userId: string, conversationId: string, text: string) {
  const cleanText = text.trim();
  const message = await addDoc(messagesPath(userId, conversationId), {
    userId,
    conversationId,
    text: cleanText,
    searchText: cleanText.toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: null,
    isForwarded: false,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null
  });
  await touchConversation(userId, conversationId, cleanText);
  return message;
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
  const forwarded = await addDoc(messagesPath(userId, targetConversationId), {
    userId,
    conversationId: targetConversationId,
    text: source.text,
    searchText: source.searchText,
    createdAt: serverTimestamp(),
    updatedAt: null,
    isForwarded: true,
    forwardedFromConversationId: source.conversationId,
    forwardedFromMessageId: source.id
  });
  await touchConversation(userId, targetConversationId, source.text);
  return forwarded;
}
