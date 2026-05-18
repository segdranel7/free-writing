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
const sortStep = 1000;

function getConversationTime(conversation: Conversation) {
  return conversation.updatedAt?.toMillis?.() ?? conversation.createdAt?.toMillis?.() ?? 0;
}

function normalizeConversations(conversations: Conversation[]) {
  return conversations
    .map((conversation, index) => ({
      ...conversation,
      sortOrder: typeof conversation.sortOrder === 'number' ? conversation.sortOrder : (index + 1) * sortStep
    }))
    .sort(
      (first, second) =>
        first.sortOrder - second.sortOrder ||
        getConversationTime(second) - getConversationTime(first) ||
        first.id.localeCompare(second.id)
    );
}

async function getNextConversationSortOrder(userId: string) {
  const snapshot = await getDocs(query(conversationsPath(userId), orderBy('updatedAt', 'desc')));
  const conversations = normalizeConversations(
    snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Conversation)
  );
  return (conversations[0]?.sortOrder ?? sortStep) - sortStep;
}

export function listenForConversations(
  userId: string,
  onChange: (conversations: Conversation[]) => void
) {
  const q = query(conversationsPath(userId), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onChange(normalizeConversations(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Conversation)));
  });
}

export async function createConversation(userId: string, title: string) {
  const now = serverTimestamp();
  const sortOrder = await getNextConversationSortOrder(userId);
  return addDoc(conversationsPath(userId), {
    userId,
    title: title.trim(),
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: '',
    sortOrder
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

export async function reorderConversations(userId: string, conversations: Conversation[]) {
  const batch = writeBatch(requireDb());
  conversations.forEach((conversation, index) => {
    batch.update(conversationPath(userId, conversation.id), {
      sortOrder: (index + 1) * sortStep
    });
  });
  await batch.commit();
}
