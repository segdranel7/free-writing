import { Edit3, LogOut, Plus, Search, Trash2, X } from 'lucide-react';
import { signOutUser } from '../services/auth';
import type { Conversation, Message } from '../types';
import { formatDate } from '../utils/date';

type SearchResult = {
  conversation: Conversation;
  message: Message;
};

type SidebarProps = {
  activeConversation: Conversation | null;
  activeConversationId: string | null;
  conversations: Conversation[];
  searchTerm: string;
  searchResults: SearchResult[];
  renamingId: string | null;
  renameDraft: string;
  onSearchTermChange: (value: string) => void;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string | null) => void;
  onStartRename: (conversation: Conversation) => void;
  onRenameDraftChange: (value: string) => void;
  onRenameConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversation: Conversation) => void;
};

export function Sidebar({
  activeConversation,
  activeConversationId,
  conversations,
  searchTerm,
  searchResults,
  renamingId,
  renameDraft,
  onSearchTermChange,
  onCreateConversation,
  onSelectConversation,
  onStartRename,
  onRenameDraftChange,
  onRenameConversation,
  onDeleteConversation
}: SidebarProps) {
  return (
    <aside className={`sidebar ${activeConversation ? 'has-active' : ''}`}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Private notebook</p>
          <h1>Free Writing</h1>
        </div>
        <button className="icon-button" title="Sign out" onClick={() => void signOutUser()}>
          <LogOut size={19} />
        </button>
      </header>

      <div className="search-box">
        <Search size={18} />
        <input
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Search messages"
        />
        {searchTerm && (
          <button className="icon-button bare" title="Clear search" onClick={() => onSearchTermChange('')}>
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
                onSelectConversation(conversation.id);
                onSearchTermChange('');
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
          <button className="new-conversation" onClick={onCreateConversation}>
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
                    onRenameConversation(conversation);
                  }}
                >
                  <input value={renameDraft} onChange={(event) => onRenameDraftChange(event.target.value)} autoFocus />
                  <button className="text-button" type="submit">
                    Save
                  </button>
                </form>
              ) : (
                <button className="conversation-main" onClick={() => onSelectConversation(conversation.id)}>
                  <strong>{conversation.title}</strong>
                  <time>{formatDate(conversation.updatedAt)}</time>
                </button>
              )}
              <div className="row-actions">
                <button className="icon-button bare" title="Rename" onClick={() => onStartRename(conversation)}>
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-button bare"
                  title="Delete"
                  onClick={() => onDeleteConversation(conversation)}
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
  );
}
