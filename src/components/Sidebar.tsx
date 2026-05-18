import { useRef, useState, type PointerEvent } from 'react';
import { Edit3, GripVertical, LogOut, Plus, Search, Trash2, X } from 'lucide-react';
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
  onReorderConversation: (draggedConversationId: string, targetConversationId: string) => void;
};

type ConversationDragState = {
  conversationId: string;
  pointerId: number;
};

type ConversationDragPreview = {
  conversationId: string;
  x: number;
  y: number;
  width: number;
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
  onDeleteConversation,
  onReorderConversation
}: SidebarProps) {
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null);
  const [dragOverConversationId, setDragOverConversationId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<ConversationDragPreview | null>(null);
  const conversationDrag = useRef<ConversationDragState | null>(null);
  const draggedConversation = dragPreview
    ? conversations.find((conversation) => conversation.id === dragPreview.conversationId) ?? null
    : null;

  function findConversationIdAtPoint(clientX: number, clientY: number) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>('[data-conversation-id]')?.dataset.conversationId ?? null;
  }

  function clearConversationDrag() {
    conversationDrag.current = null;
    setDraggedConversationId(null);
    setDragOverConversationId(null);
    setDragPreview(null);
  }

  function handleConversationPointerDown(event: PointerEvent<HTMLButtonElement>, conversationId: string) {
    if (conversations.length < 2) return;

    const conversationElement = event.currentTarget.closest<HTMLElement>('[data-conversation-id]');
    const rect = conversationElement?.getBoundingClientRect();
    const width = rect?.width ?? 280;

    conversationDrag.current = {
      conversationId,
      pointerId: event.pointerId
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggedConversationId(conversationId);
    setDragPreview({
      conversationId,
      x: event.clientX,
      y: event.clientY,
      width
    });
  }

  function handleConversationPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = conversationDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    setDragPreview((currentPreview) =>
      currentPreview ? { ...currentPreview, x: event.clientX, y: event.clientY } : currentPreview
    );
    const targetConversationId = findConversationIdAtPoint(event.clientX, event.clientY);
    setDragOverConversationId(
      targetConversationId && targetConversationId !== currentDrag.conversationId ? targetConversationId : null
    );
  }

  function handleConversationPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = conversationDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    const targetConversationId = findConversationIdAtPoint(event.clientX, event.clientY);
    const shouldReorder = targetConversationId && targetConversationId !== currentDrag.conversationId;
    clearConversationDrag();
    if (shouldReorder) onReorderConversation(currentDrag.conversationId, targetConversationId);
  }

  function handleConversationPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (conversationDrag.current?.pointerId === event.pointerId) clearConversationDrag();
  }

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
              className={[
                'conversation-row',
                conversation.id === activeConversationId ? 'active' : '',
                draggedConversationId === conversation.id ? 'dragging' : '',
                dragOverConversationId === conversation.id ? 'drag-over' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              data-conversation-id={conversation.id}
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
                <button
                  className="icon-button bare drag-handle"
                  title="Drag conversation"
                  disabled={conversations.length < 2 || renamingId === conversation.id}
                  onPointerDown={(event) => handleConversationPointerDown(event, conversation.id)}
                  onPointerMove={handleConversationPointerMove}
                  onPointerUp={handleConversationPointerUp}
                  onPointerCancel={handleConversationPointerCancel}
                >
                  <GripVertical size={16} />
                </button>
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
          {dragPreview && draggedConversation && (
            <div
              className="conversation-drag-preview"
              style={{
                left: dragPreview.x,
                top: dragPreview.y,
                width: dragPreview.width
              }}
            >
              <strong>{draggedConversation.title}</strong>
              <time>{formatDate(draggedConversation.updatedAt)}</time>
            </div>
          )}
        </section>
      )}
    </aside>
  );
}
