import { useEffect, useState } from 'react';
import { offlinePersistenceReady } from '../firebase';
import { listenForUser } from '../services/auth';
import { listenForConversations } from '../services/conversations';
import { listenForMessages } from '../services/messages';
import type { AppUser, Conversation, Message } from '../types';

export function useMessagingData() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    void offlinePersistenceReady;
    return listenForUser((nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setActiveConversationId(null);
      setMessagesByConversation({});
      return undefined;
    }

    return listenForConversations(user.uid, (nextConversations) => {
      setConversations(nextConversations);
      setActiveConversationId((current) => current ?? nextConversations[0]?.id ?? null);
    });
  }, [user]);

  useEffect(() => {
    if (!user || conversations.length === 0) return undefined;

    const unsubscribers = conversations.map((conversation) =>
      listenForMessages(user.uid, conversation.id, (messages) => {
        setMessagesByConversation((current) => ({
          ...current,
          [conversation.id]: messages
        }));
      })
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, conversations]);

  return {
    user,
    authLoading,
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    messagesByConversation,
    setMessagesByConversation
  };
}
