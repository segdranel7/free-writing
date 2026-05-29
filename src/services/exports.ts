import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { requireDb } from '../firebase';
import type { Conversation, Message } from '../types';
import {
  buildAllConversationsExportBundle,
  buildConversationExportBundle,
  type AllConversationsExportBundle,
  type ConversationExportBundle,
  type ExportedDocument
} from '../utils/conversationExport';

function conversationsPath(userId: string) {
  return collection(requireDb(), 'users', userId, 'conversations');
}

function conversationPath(userId: string, conversationId: string) {
  return doc(requireDb(), 'users', userId, 'conversations', conversationId);
}

function messagesPath(userId: string, conversationId: string) {
  return collection(requireDb(), 'users', userId, 'conversations', conversationId, 'messages');
}

function conversationDocument(snapshot: Awaited<ReturnType<typeof getDoc>>): ExportedDocument<Conversation> {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    path: snapshot.ref.path,
    data: { id: snapshot.id, ...(data as Record<string, unknown>) } as Conversation
  };
}

async function getExportMessages(userId: string, conversationId: string) {
  const snapshot = await getDocs(query(messagesPath(userId, conversationId), orderBy('createdAt', 'asc')));
  return snapshot.docs.map((message) => ({
    id: message.id,
    path: message.ref.path,
    data: { id: message.id, ...(message.data() as Record<string, unknown>) } as Message
  }));
}

export async function exportConversation(userId: string, conversationId: string): Promise<ConversationExportBundle> {
  const snapshot = await getDoc(conversationPath(userId, conversationId));
  if (!snapshot.exists()) throw new Error('Conversation not found.');

  return buildConversationExportBundle({
    userId,
    conversation: conversationDocument(snapshot),
    messages: await getExportMessages(userId, conversationId)
  });
}

export async function exportAllConversations(userId: string): Promise<AllConversationsExportBundle> {
  const snapshot = await getDocs(query(conversationsPath(userId), orderBy('updatedAt', 'desc')));
  const conversations = await Promise.all(
    snapshot.docs.map(async (conversation) => ({
      id: conversation.id,
      path: conversation.ref.path,
      data: { id: conversation.id, ...(conversation.data() as Record<string, unknown>) } as Conversation,
      messages: await getExportMessages(userId, conversation.id)
    }))
  );

  return buildAllConversationsExportBundle({
    userId,
    conversations
  });
}
