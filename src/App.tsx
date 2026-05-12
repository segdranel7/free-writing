import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Edit3,
  Forward,
  LogOut,
  MessageCirclePlus,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { hasFirebaseConfig, offlinePersistenceReady } from './firebase';
import { listenForUser, signInWithGoogle, signOutUser } from './services/auth';
import {
  createConversation,
  deleteConversation,
  listenForConversations,
  renameConversation
} from './services/conversations';
import {
  createMessage,
  deleteMessage,
  editMessage,
  forwardMessage,
  listenForMessages
} from './services/messages';
import { searchLoadedMessages } from './services/search';
import type { AppUser, Conversation, Message } from './types';

function formatDate(value: { toDate: () => Date } | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(value.toDate());
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function SignInScreen() {
  const [authError, setAuthError] = useState('');

  async function handleSignIn() {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    }
  }

  return (
    <main className="signin">
      <section className="signin-panel">
        <div className="brand-mark">
          <MessageCirclePlus size={34} />
        </div>
        <h1>My Messages</h1>
        <p>Private conversations for your own notes and text blocks.</p>
        {!hasFirebaseConfig && (
          <div className="notice">
            Add Firebase values to <code>.env</code>, then restart the dev server.
          </div>
        )}
        {authError && <div className="notice error">{authError}</div>}
        <button className="primary-button" onClick={() => void handleSignIn()} disabled={!hasFirebaseConfig}>
          Continue with Google
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  useEffect(() => {
    void offlinePersistenceReady;
    return listenForUser((nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
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

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];
  const searchResults = useMemo(
    () => searchLoadedMessages(searchTerm, conversations, messagesByConversation),
    [searchTerm, conversations, messagesByConversation]
  );

  async function handleCreateConversation() {
    if (!user) return;
    const title = window.prompt('Conversation name');
    if (!title?.trim()) return;
    const conversation = await createConversation(user.uid, title);
    setActiveConversationId(conversation.id);
  }

  async function handleRenameConversation(conversation: Conversation) {
    if (!user || !renameDraft.trim()) return;
    await renameConversation(user.uid, conversation.id, renameDraft);
    setRenamingId(null);
    setRenameDraft('');
  }

  async function handleDeleteConversation(conversation: Conversation) {
    if (!user) return;
    if (!window.confirm(`Delete "${conversation.title}"? Messages in this conversation will be removed from the list.`)) {
      return;
    }
    await deleteConversation(user.uid, conversation.id);
    setActiveConversationId((current) => (current === conversation.id ? conversations[0]?.id ?? null : current));
  }

  async function handleSubmitMessage() {
    if (!user || !activeConversationId || !draft.trim()) return;
    if (editingMessage) {
      await editMessage(user.uid, activeConversationId, editingMessage.id, draft);
      setEditingMessage(null);
    } else {
      await createMessage(user.uid, activeConversationId, draft);
    }
    setDraft('');
  }

  async function handleDeleteMessage(message: Message) {
    if (!user || !window.confirm('Delete this message?')) return;
    await deleteMessage(user.uid, message.conversationId, message.id);
  }

  async function handleForwardMessage(targetConversationId: string) {
    if (!user || !forwardingMessage) return;
    await forwardMessage(user.uid, forwardingMessage, targetConversationId);
    setForwardingMessage(null);
    setActiveConversationId(targetConversationId);
  }

  if (authLoading) {
    return <div className="loading">Loading My Messages...</div>;
  }

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${activeConversation ? 'has-active' : ''}`}>
        <header className="app-header">
          <div>
            <p className="eyebrow">Private notebook</p>
            <h1>My Messages</h1>
          </div>
          <button className="icon-button" title="Sign out" onClick={() => void signOutUser()}>
            <LogOut size={19} />
          </button>
        </header>

        <div className="search-box">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search messages"
          />
          {searchTerm && (
            <button className="icon-button bare" title="Clear search" onClick={() => setSearchTerm('')}>
              <X size={17} />
            </button>
          )}
        </div>

        {searchTerm ? (
          <section className="search-results">
            {searchResults.map(({ conversation, message }) => (
              <button
                key={message.id}
                className="conversation-row"
                onClick={() => {
                  setActiveConversationId(conversation.id);
                  setSearchTerm('');
                }}
              >
                <strong>{conversation.title}</strong>
                <span>{message.text}</span>
                <time>{formatDate(message.createdAt)}</time>
              </button>
            ))}
            {searchResults.length === 0 && <p className="empty-state">No loaded messages match that search.</p>}
          </section>
        ) : (
          <section className="conversation-list">
            <button className="new-conversation" onClick={() => void handleCreateConversation()}>
              <Plus size={18} />
              New conversation
            </button>
            {conversations.map((conversation) => (
              <article
                key={conversation.id}
                className={`conversation-row ${conversation.id === activeConversationId ? 'active' : ''}`}
              >
                {renamingId === conversation.id ? (
                  <form
                    className="rename-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleRenameConversation(conversation);
                    }}
                  >
                    <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} autoFocus />
                    <button className="text-button" type="submit">Save</button>
                  </form>
                ) : (
                  <button className="conversation-main" onClick={() => setActiveConversationId(conversation.id)}>
                    <strong>{conversation.title}</strong>
                    <span>{conversation.lastMessagePreview || 'No messages yet'}</span>
                    <time>{formatDate(conversation.updatedAt)}</time>
                  </button>
                )}
                <div className="row-actions">
                  <button
                    className="icon-button bare"
                    title="Rename"
                    onClick={() => {
                      setRenamingId(conversation.id);
                      setRenameDraft(conversation.title);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="icon-button bare"
                    title="Delete"
                    onClick={() => void handleDeleteConversation(conversation)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {conversations.length === 0 && <p className="empty-state">Create your first conversation.</p>}
          </section>
        )}
      </aside>

      <section className={`conversation-pane ${activeConversation ? 'open' : ''}`}>
        {activeConversation ? (
          <>
            <header className="conversation-header">
              <button className="icon-button back-button" title="Back" onClick={() => setActiveConversationId(null)}>
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2>{activeConversation.title}</h2>
                <p>{activeMessages.length} messages</p>
              </div>
            </header>

            <div className="messages">
              {activeMessages.map((message) => (
                <article className="message-bubble" key={message.id}>
                  <div className="message-meta">
                    {message.isForwarded && <span>Forwarded</span>}
                    {message.updatedAt && <span>edited</span>}
                    <time>{formatDate(message.createdAt)}</time>
                  </div>
                  <p>{message.text}</p>
                  <div className="message-actions">
                    <button
                      className="icon-button bare"
                      title="Edit"
                      onClick={() => {
                        setEditingMessage(message);
                        setDraft(message.text);
                      }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button className="icon-button bare" title="Forward" onClick={() => setForwardingMessage(message)}>
                      <Forward size={16} />
                    </button>
                    <button
                      className="icon-button bare"
                      title="Delete"
                      onClick={() => void handleDeleteMessage(message)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
              {activeMessages.length === 0 && <p className="empty-state">Write the first message here.</p>}
            </div>

            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitMessage();
              }}
            >
              {editingMessage && (
                <div className="editing-strip">
                  Editing message
                  <button
                    className="icon-button bare"
                    type="button"
                    title="Cancel edit"
                    onClick={() => {
                      setEditingMessage(null);
                      setDraft('');
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message"
                rows={2}
              />
              <button className="primary-button send-button" disabled={!draft.trim()}>
                {editingMessage ? 'Save' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="no-selection">
            <MoreVertical size={26} />
            <p>Select or create a conversation.</p>
          </div>
        )}
      </section>

      {forwardingMessage && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal">
            <header>
              <h2>Forward to</h2>
              <button className="icon-button bare" title="Close" onClick={() => setForwardingMessage(null)}>
                <X size={18} />
              </button>
            </header>
            {conversations
              .filter((conversation) => conversation.id !== forwardingMessage.conversationId)
              .map((conversation) => (
                <button
                  key={conversation.id}
                  className="target-row"
                  onClick={() => void handleForwardMessage(conversation.id)}
                >
                  {conversation.title}
                </button>
              ))}
          </section>
        </div>
      )}
    </main>
  );
}
