import { Fragment, useEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import { Edit3, GripVertical, LogOut, Plus, Search, Trash2, X } from 'lucide-react';
import { signOutUser } from '../services/auth';
import type { Conversation, Message } from '../types';
import { formatDate } from '../utils/date';
import { resolveNearestDropTarget, type DropPosition, type DropTargetCandidate } from '../utils/dropTargets';

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
  onReorderConversation: (draggedConversationId: string, targetConversationId: string, position: DropPosition) => void;
};

type ConversationDragState = {
  conversationId: string;
  pointerId: number;
};

type ConversationDropTarget = {
  conversationId: string;
  position: DropPosition;
};

type ConversationDragPreview = {
  conversationId: string;
  x: number;
  y: number;
  width: number;
};

const DRAG_AUTOSCROLL_EDGE_PX = 72;
const DRAG_AUTOSCROLL_MAX_PX = 18;

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
  const [conversationDropTarget, setConversationDropTarget] = useState<ConversationDropTarget | null>(null);
  const [dragPreview, setDragPreview] = useState<ConversationDragPreview | null>(null);
  const conversationDrag = useRef<ConversationDragState | null>(null);
  const conversationListRef = useRef<HTMLElement | null>(null);
  const suppressNextSelectRef = useRef(false);
  const suppressSelectTimeoutRef = useRef<number | null>(null);
  const dragAutoScroll = useRef<{ speedY: number; animationId: number | null }>({
    speedY: 0,
    animationId: null
  });
  const draggedConversation = dragPreview
    ? conversations.find((conversation) => conversation.id === dragPreview.conversationId) ?? null
    : null;

  useEffect(() => {
    if (!draggedConversationId) return undefined;

    function handleWindowDragOver(event: globalThis.DragEvent) {
      updateDragAutoScroll(event.clientY);
      updateDragPreview(event.clientX, event.clientY);
    }

    window.addEventListener('dragover', handleWindowDragOver);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      stopDragAutoScroll();
    };
  }, [draggedConversationId]);

  useEffect(() => {
    return () => {
      if (suppressSelectTimeoutRef.current !== null) window.clearTimeout(suppressSelectTimeoutRef.current);
      stopDragAutoScroll();
    };
  }, []);

  function getConversationDropPosition(conversationElement: HTMLElement, clientY: number): DropPosition {
    const rect = conversationElement.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  function getConversationDropTarget(
    conversationElement: HTMLElement,
    conversationId: string,
    clientY: number,
    currentDraggedConversationId: string | null
  ) {
    if (currentDraggedConversationId === conversationId) return null;
    return {
      conversationId,
      position: getConversationDropPosition(conversationElement, clientY)
    };
  }

  function getConversationElements() {
    return Array.from(conversationListRef.current?.querySelectorAll<HTMLElement>('[data-conversation-id]') ?? []).filter(
      (element) => element.dataset.conversationId
    );
  }

  function getNearestConversationDropTarget(
    clientY: number,
    currentDraggedConversationId: string | null
  ): ConversationDropTarget | null {
    const candidates = getConversationElements().reduce<DropTargetCandidate[]>((currentCandidates, conversationElement) => {
      const conversationId = conversationElement.dataset.conversationId;
      if (!conversationId) return currentCandidates;

      const rect = conversationElement.getBoundingClientRect();
      currentCandidates.push({ id: conversationId, top: rect.top, height: rect.height });
      return currentCandidates;
    }, []);
    const dropTarget = resolveNearestDropTarget(candidates, clientY, currentDraggedConversationId);
    return dropTarget ? { conversationId: dropTarget.itemId, position: dropTarget.position } : null;
  }

  function findConversationDropTargetAtPoint(
    clientX: number,
    clientY: number,
    currentDraggedConversationId: string | null
  ) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof Element)) return getNearestConversationDropTarget(clientY, currentDraggedConversationId);
    const conversationElement = target.closest<HTMLElement>('[data-conversation-id]');
    const conversationId = conversationElement?.dataset.conversationId;
    if (!conversationElement || !conversationId || currentDraggedConversationId === conversationId) {
      return getNearestConversationDropTarget(clientY, currentDraggedConversationId);
    }
    return getConversationDropTarget(conversationElement, conversationId, clientY, currentDraggedConversationId);
  }

  function stopDragAutoScroll() {
    const currentAutoScroll = dragAutoScroll.current;
    if (currentAutoScroll.animationId !== null) {
      window.cancelAnimationFrame(currentAutoScroll.animationId);
    }
    dragAutoScroll.current = { speedY: 0, animationId: null };
  }

  function runDragAutoScroll() {
    const container = conversationListRef.current;
    const currentAutoScroll = dragAutoScroll.current;
    if (!container || currentAutoScroll.speedY === 0) {
      stopDragAutoScroll();
      return;
    }

    container.scrollBy({ top: currentAutoScroll.speedY });
    currentAutoScroll.animationId = window.requestAnimationFrame(runDragAutoScroll);
  }

  function updateDragAutoScroll(clientY: number) {
    const container = conversationListRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const topDistance = clientY - rect.top;
    const bottomDistance = rect.bottom - clientY;
    const topIntensity = (DRAG_AUTOSCROLL_EDGE_PX - topDistance) / DRAG_AUTOSCROLL_EDGE_PX;
    const bottomIntensity = (DRAG_AUTOSCROLL_EDGE_PX - bottomDistance) / DRAG_AUTOSCROLL_EDGE_PX;
    const nextSpeedY =
      topIntensity > 0
        ? -Math.min(DRAG_AUTOSCROLL_MAX_PX, Math.ceil(topIntensity * DRAG_AUTOSCROLL_MAX_PX))
        : bottomIntensity > 0
          ? Math.min(DRAG_AUTOSCROLL_MAX_PX, Math.ceil(bottomIntensity * DRAG_AUTOSCROLL_MAX_PX))
          : 0;

    dragAutoScroll.current.speedY = nextSpeedY;
    if (nextSpeedY === 0) {
      stopDragAutoScroll();
      return;
    }

    if (dragAutoScroll.current.animationId === null) {
      dragAutoScroll.current.animationId = window.requestAnimationFrame(runDragAutoScroll);
    }
  }

  function updateDragPreview(clientX: number, clientY: number) {
    setDragPreview((currentPreview) =>
      currentPreview ? { ...currentPreview, x: clientX, y: clientY } : currentPreview
    );
  }

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

  function clearConversationDrag() {
    conversationDrag.current = null;
    stopDragAutoScroll();
    setDraggedConversationId(null);
    setConversationDropTarget(null);
    setDragPreview(null);
  }

  function completeConversationReorder(dropTarget: ConversationDropTarget | null, conversationId: string) {
    suppressNextSelect();
    clearConversationDrag();
    if (dropTarget) onReorderConversation(conversationId, dropTarget.conversationId, dropTarget.position);
  }

  function handleConversationDragStart(event: DragEvent<HTMLButtonElement>, conversationId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', conversationId);
    const conversationElement = event.currentTarget.closest<HTMLElement>('[data-conversation-id]');
    const rect = conversationElement?.getBoundingClientRect();
    if (rect) {
      setDragPreview({
        conversationId,
        x: event.clientX,
        y: event.clientY,
        width: rect.width
      });
    }
    const dragImage = document.createElement('div');
    dragImage.style.width = '1px';
    dragImage.style.height = '1px';
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage?.(dragImage, 0, 0);
    window.setTimeout(() => dragImage.remove(), 0);
    setDraggedConversationId(conversationId);
    updateDragAutoScroll(event.clientY);
  }

  function handleConversationDragOver(event: DragEvent<HTMLElement>, conversationId: string) {
    const isSameConversation = draggedConversationId === conversationId;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    updateDragAutoScroll(event.clientY);
    updateDragPreview(event.clientX, event.clientY);
    setConversationDropTarget(
      isSameConversation
        ? getNearestConversationDropTarget(event.clientY, conversationId)
        : getConversationDropTarget(event.currentTarget, conversationId, event.clientY, draggedConversationId)
    );
  }

  function handleConversationDragLeave(event: DragEvent<HTMLElement>, conversationId: string) {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setConversationDropTarget((currentTarget) =>
      currentTarget?.conversationId === conversationId ? null : currentTarget
    );
  }

  function handleConversationDrop(event: DragEvent<HTMLElement>, targetConversationId: string) {
    event.preventDefault();
    event.stopPropagation();
    const droppedConversationId = event.dataTransfer.getData('text/plain') || draggedConversationId;
    const dropPosition = getConversationDropPosition(event.currentTarget, event.clientY);
    stopDragAutoScroll();
    setDraggedConversationId(null);
    setConversationDropTarget(null);
    setDragPreview(null);
    suppressNextSelect();
    if (!droppedConversationId || droppedConversationId === targetConversationId) return;
    onReorderConversation(droppedConversationId, targetConversationId, dropPosition);
  }

  function handleConversationListDragOver(event: DragEvent<HTMLElement>) {
    if (!draggedConversationId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    updateDragAutoScroll(event.clientY);
    updateDragPreview(event.clientX, event.clientY);
    setConversationDropTarget(getNearestConversationDropTarget(event.clientY, draggedConversationId));
  }

  function handleConversationListDrop(event: DragEvent<HTMLElement>) {
    if (!draggedConversationId) return;
    event.preventDefault();
    const droppedConversationId = event.dataTransfer.getData('text/plain') || draggedConversationId;
    const dropTarget = getNearestConversationDropTarget(event.clientY, droppedConversationId);
    stopDragAutoScroll();
    setDraggedConversationId(null);
    setConversationDropTarget(null);
    setDragPreview(null);
    suppressNextSelect();
    if (dropTarget) onReorderConversation(droppedConversationId, dropTarget.conversationId, dropTarget.position);
  }

  function handleConversationDragEnd() {
    clearConversationDrag();
    suppressNextSelect();
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
    updateDragAutoScroll(event.clientY);
  }

  function handleConversationPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = conversationDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    updateDragAutoScroll(event.clientY);
    updateDragPreview(event.clientX, event.clientY);
    setConversationDropTarget(findConversationDropTargetAtPoint(event.clientX, event.clientY, currentDrag.conversationId));
  }

  function handleConversationPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = conversationDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    const dropTarget = findConversationDropTargetAtPoint(event.clientX, event.clientY, currentDrag.conversationId);
    completeConversationReorder(dropTarget, currentDrag.conversationId);
  }

  function handleConversationPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' && conversationDrag.current?.pointerId === event.pointerId) clearConversationDrag();
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
              {conversationDropTarget?.conversationId === conversation.id &&
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
              {conversationDropTarget?.conversationId === conversation.id &&
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
    </aside>
  );
}
