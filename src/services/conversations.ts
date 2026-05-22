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
import { rewriteInlineConversationLinkTitles } from '../utils/inlineConversationLinks';

const conversationsPath = (userId: string) => collection(requireDb(), 'users', userId, 'conversations');
const conversationPath = (userId: string, conversationId: string) =>
  doc(requireDb(), 'users', userId, 'conversations', conversationId);
const messagesPath = (userId: string, conversationId: string) =>
  collection(requireDb(), 'users', userId, 'conversations', conversationId, 'messages');
const messagePath = (userId: string, conversationId: string, messageId: string) =>
  doc(requireDb(), 'users', userId, 'conversations', conversationId, 'messages', messageId);
const sortStep = 1000;
const batchWriteLimit = 450;

type TouchConversationOptions = {
  moveToTop?: boolean;
};

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

async function rewriteConversationTitleLinks(userId: string, oldTitle: string, newTitle: string) {
  const conversations = await getDocs(conversationsPath(userId));
  const updates: Array<{ conversationId: string; messageId: string; text: string }> = [];

  for (const conversation of conversations.docs) {
    const messages = await getDocs(messagesPath(userId, conversation.id));
    messages.docs.forEach((message) => {
      const data = message.data() as { text?: unknown };
      if (typeof data.text !== 'string') return;
      const nextText = rewriteInlineConversationLinkTitles(data.text, oldTitle, newTitle);
      if (nextText === data.text) return;
      updates.push({
        conversationId: conversation.id,
        messageId: message.id,
        text: nextText
      });
    });
  }

  let batch = writeBatch(requireDb());
  let pendingWrites = 0;

  for (const update of updates) {
    batch.update(messagePath(userId, update.conversationId, update.messageId), {
      text: update.text,
      searchText: update.text.toLowerCase(),
      updatedAt: serverTimestamp()
    });
    pendingWrites += 1;

    if (pendingWrites === batchWriteLimit) {
      await batch.commit();
      batch = writeBatch(requireDb());
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) await batch.commit();
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string,
  previousTitle?: string
) {
  const nextTitle = title.trim();
  await updateDoc(conversationPath(userId, conversationId), {
    title: nextTitle,
    updatedAt: serverTimestamp()
  });

  if (previousTitle?.trim() && previousTitle.trim() !== nextTitle) {
    await rewriteConversationTitleLinks(userId, previousTitle, nextTitle);
  }
}

export async function deleteConversation(userId: string, conversationId: string) {
  const batch = writeBatch(requireDb());
  const messages = await getDocs(collection(conversationPath(userId, conversationId), 'messages'));
  messages.forEach((message) => batch.delete(message.ref));
  batch.delete(conversationPath(userId, conversationId));
  await batch.commit();
}

export async function touchConversation(
  userId: string,
  conversationId: string,
  preview: string,
  options: TouchConversationOptions = {}
) {
  const updates: {
    lastMessagePreview: string;
    updatedAt: ReturnType<typeof serverTimestamp>;
    sortOrder?: number;
  } = {
    lastMessagePreview: preview.slice(0, 120),
    updatedAt: serverTimestamp()
  };

  if (options.moveToTop) {
    updates.sortOrder = await getNextConversationSortOrder(userId);
  }

  return updateDoc(conversationPath(userId, conversationId), updates);
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
