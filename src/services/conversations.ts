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
import type { Conversation } from '../types';

const conversationsPath = (userId: string) => collection(requireDb(), 'users', userId, 'conversations');
const conversationPath = (userId: string, conversationId: string) =>
  doc(requireDb(), 'users', userId, 'conversations', conversationId);

export function listenForConversations(
  userId: string,
  onChange: (conversations: Conversation[]) => void
) {
  const q = query(conversationsPath(userId), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Conversation));
  });
}

export async function createConversation(userId: string, title: string) {
  const now = serverTimestamp();
  return addDoc(conversationsPath(userId), {
    userId,
    title: title.trim(),
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: ''
  });
}

export function renameConversation(userId: string, conversationId: string, title: string) {
  return updateDoc(conversationPath(userId, conversationId), {
    title: title.trim(),
    updatedAt: serverTimestamp()
  });
}

export async function deleteConversation(userId: string, conversationId: string) {
  const batch = writeBatch(requireDb());
  const messages = await getDocs(collection(conversationPath(userId, conversationId), 'messages'));
  messages.forEach((message) => batch.delete(message.ref));
  batch.delete(conversationPath(userId, conversationId));
  await batch.commit();
}

export function touchConversation(userId: string, conversationId: string, preview: string) {
  return updateDoc(conversationPath(userId, conversationId), {
    lastMessagePreview: preview.slice(0, 120),
    updatedAt: serverTimestamp()
  });
}

export function removeConversation(userId: string, conversationId: string) {
  return deleteDoc(conversationPath(userId, conversationId));
}
