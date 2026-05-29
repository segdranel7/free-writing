import { Fragment, useEffect, useRef, type MouseEvent } from 'react';
import { CalendarDays, Download, Edit3, GripVertical, LogOut, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
import { useListReorderDrag } from '../hooks/useListReorderDrag';
import { signOutUser } from '../services/auth';
import type { Conversation, Message } from '../types';
import { formatDate } from '../utils/date';
import type { DropPosition } from '../utils/dropTargets';
import { getTagKey, type TagSummary } from '../utils/tags';

type SearchResult = {
  conversation: Conversation;
  message: Message;
};

type SidebarProps = {
  activeConversation: Conversation | null;
  activeConversationId: string | null;
  isCalendarOpen: boolean;
  conversations: Conversation[];
  searchTerm: string;
  searchResults: SearchResult[];
  tagSummaries: TagSummary[];
  selectedTags: string[];
  tagResults: SearchResult[];
  renamingId: string | null;
  renameDraft: string;
  isExportingAllConversations: boolean;
  allConversationsExportError: string | null;
  onSearchTermChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onOpenTagResult: (conversationId: string, messageId: string) => void;
  onOpenCalendar: () => void;
  onExportAllConversations: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string | null) => void;
  onStartRename: (conversation: Conversation) => void;
  onRenameDraftChange: (value: string) => void;
  onRenameConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  onReorderConversation: (draggedConversationId: string, targetConversationId: string, position: DropPosition) => void;
};

export function Sidebar({
  activeConversation,
  activeConversationId,
  isCalendarOpen,
  conversations,
  searchTerm,
  searchResults,
  tagSummaries,
  selectedTags,
  tagResults,
  renamingId,
  renameDraft,
  isExportingAllConversations,
  allConversationsExportError,
  onSearchTermChange,
  onToggleTag,
  onClearTags,
  onOpenTagResult,
  onOpenCalendar,
  onExportAllConversations,
  onCreateConversation,
  onSelectConversation,
  onStartRename,
  onRenameDraftChange,
  onRenameConversation,
  onDeleteConversation,
  onReorderConversation
}: SidebarProps) {
  const conversationListRef = useRef<HTMLElement | null>(null);
  const suppressNextSelectRef = useRef(false);
  const suppressSelectTimeoutRef = useRef<number | null>(null);
  const {
    draggedItemId: draggedConversationId,
    dropTarget: conversationDropTarget,
    dragPreview,
    handleItemDragStart: handleConversationDragStart,
    handleItemDragOver: handleConversationDragOver,
    handleItemDragLeave: handleConversationDragLeave,
    handleItemDrop: handleConversationDrop,
    handleItemDragEnd: handleConversationDragEnd,
    handleContainerDragOver: handleConversationListDragOver,
    handleContainerDrop: handleConversationListDrop,
    handleItemPointerDown: handleConversationPointerDown,
    handleItemPointerMove: handleConversationPointerMove,
    handleItemPointerUp: handleConversationPointerUp,
    handleItemPointerCancel: handleConversationPointerCancel
  } = useListReorderDrag({
    containerRef: conversationListRef,
    itemSelector: '[data-conversation-id]',
    getItemId: (element) => element.dataset.conversationId,
    itemCount: conversations.length,
    onReorder: onReorderConversation,
    onDragInteractionEnd: suppressNextSelect
  });
  const draggedConversation = dragPreview
    ? conversations.find((conversation) => conversation.id === dragPreview.itemId) ?? null
    : null;
  const hasSelectedTags = selectedTags.length > 0;
  const headerOverflowItems = [
    {
      label: 'Export all conversations',
      icon: <Download size={17} />,
      disabled: conversations.length === 0 || isExportingAllConversations,
      onClick: onExportAllConversations
    },
    {
      label: 'Sign out',
      icon: <LogOut size={17} />,
      onClick: () => void signOutUser()
    }
  ];

  useEffect(() => {
    return () => {
      if (suppressSelectTimeoutRef.current !== null) window.clearTimeout(suppressSelectTimeoutRef.current);
    };
  }, []);

  function suppressNextSelect() {
    suppressNextSelectRef.current = true;
    if (suppressSelectTimeoutRef.current !== null) window.clearTimeout(suppressSelectTimeoutRef.current);
    suppressSelectTimeoutRef.current = window.setTimeout(() => {
      suppressNextSelectRef.current = false;
      suppressSelectTimeoutRef.current = null;
    }, 0);
  }

  function selectConversation(event: MouseEvent<HTMLButtonElement>, conversationId: string) {
    if (suppressNextSelectRef.current) {
      suppressNextSelectRef.current = false;
      if (suppressSelectTimeoutRef.current !== null) {
        window.clearTimeout(suppressSelectTimeoutRef.current);
        suppressSelectTimeoutRef.current = null;
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onSelectConversation(conversationId);
  }

  return (
    <aside className={`sidebar ${activeConversation || isCalendarOpen ? 'has-active' : ''}`}>
      <header className="app-header">
        <div className="header-title-block">
          <p className="eyebrow">Private notebook</p>
          <h1>Free Writing</h1>
          {(isExportingAllConversations || allConversationsExportError) && (
            <p className={allConversationsExportError ? 'conversation-status error' : 'conversation-status'} role={allConversationsExportError ? 'alert' : 'status'}>
              {allConversationsExportError ?? 'Exporting conversations...'}
            </p>
          )}
        </div>
        <div className="app-header-actions">
          <button
            className={isCalendarOpen ? 'icon-button active' : 'icon-button'}
            title="Calendar"
            onClick={onOpenCalendar}
          >
            <CalendarDays size={19} />
          </button>
          <HeaderOverflowMenu items={headerOverflowItems} />
        </div>
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
        <>
          {tagSummaries.length > 0 && (
            <section className="tag-browser" aria-label="Browse tags">
              <div className="tag-browser-header">
                <span>
                  <Tag size={14} />
                  Tags
                </span>
                {hasSelectedTags && (
                  <button className="text-button compact" type="button" onClick={onClearTags}>
                    Clear
                  </button>
                )}
              </div>
              <div className="tag-filter-list">
                {tagSummaries.map((tag) => {
                  const isActive = selectedTags.some((selectedTag) => getTagKey(selectedTag) === getTagKey(tag.name));
                  return (
                    <button
                      key={tag.name}
                      className={isActive ? 'tag-filter-chip active' : 'tag-filter-chip'}
                      type="button"
                      onClick={() => onToggleTag(tag.name)}
                    >
                      {tag.name}
                      <span>{tag.count}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {hasSelectedTags ? (
            <section className="search-results tag-results">
              {tagResults.map(({ conversation, message }) => (
                <button
                  key={message.id}
                  className="conversation-row"
                  onClick={() => onOpenTagResult(conversation.id, message.id)}
                >
                  <strong>{conversation.title}</strong>
                  <span>{message.text || message.tags.join(', ')}</span>
                  <time>{formatDate(message.createdAt)}</time>
                </button>
              ))}
              {tagResults.length === 0 && <p className="empty-state">No loaded blocks match those tags.</p>}
            </section>
          ) : (
            <section
              className="conversation-list"
              ref={conversationListRef}
              onDragOver={handleConversationListDragOver}
              onDrop={handleConversationListDrop}
            >
              <button className="new-conversation" onClick={onCreateConversation}>
                <Plus size={18} />
                New conversation
              </button>
              {conversations.map((conversation) => (
                <Fragment key={conversation.id}>
                  {conversationDropTarget?.itemId === conversation.id &&
                    conversationDropTarget.position === 'before' && (
                      <div className="conversation-drop-indicator" aria-hidden="true" />
                    )}
                  <article
                    className={[
                      'conversation-row',
                      conversation.id === activeConversationId ? 'active' : '',
                      draggedConversationId === conversation.id ? 'dragging' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-conversation-id={conversation.id}
                    onDragOver={(event) => handleConversationDragOver(event, conversation.id)}
                    onDragLeave={(event) => handleConversationDragLeave(event, conversation.id)}
                    onDrop={(event) => handleConversationDrop(event, conversation.id)}
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
                      <button className="conversation-main" onClick={(event) => selectConversation(event, conversation.id)}>
                        <strong>{conversation.title}</strong>
                        <time>{formatDate(conversation.updatedAt)}</time>
                      </button>
                    )}
                    <div className="row-actions">
                      <button
                        className="icon-button bare drag-handle"
                        title="Drag conversation"
                        draggable={conversations.length > 1 && renamingId !== conversation.id}
                        disabled={conversations.length < 2 || renamingId === conversation.id}
                        onDragStart={(event) => handleConversationDragStart(event, conversation.id)}
                        onDragEnd={handleConversationDragEnd}
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
                  {conversationDropTarget?.itemId === conversation.id &&
                    conversationDropTarget.position === 'after' && (
                      <div className="conversation-drop-indicator" aria-hidden="true" />
                    )}
                </Fragment>
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
        </>
      )}
    </aside>
  );
}
