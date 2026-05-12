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
};

export type MessageTransferType = 'forwarded' | 'moved' | null;

export type Message = {
  id: string;
  userId: string;
  conversationId: string;
  text: string;
  searchText: string;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  sortOrder: number;
  isForwarded: boolean;
  transferType?: MessageTransferType;
  forwardedFromConversationId: string | null;
  forwardedFromMessageId: string | null;
};
