import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Copy,
  Edit3,
  Forward,
  GripVertical,
  Languages,
  Link2,
  MoveRight,
  Trash2
} from 'lucide-react';
import { MessageEditForm } from './MessageEditForm';
import { MessageConnections } from './MessageConnections';
import { MessageTagEditor } from './MessageTagEditor';
import { MessageText } from './MessageText';
import type { Conversation, Message, MessageReference } from '../types';
import { formatDate, formatFullDateTime } from '../utils/date';
import {
  type MessageBacklink,
  type MessageReferenceNavigationTarget
} from '../utils/messageReferences';
import type { TagSummary } from '../utils/tags';

export type CopyFeedbackStatus = 'copied' | 'failed';

const DOUBLE_TAP_TIMEOUT_MS = 350;
const TAP_MOVE_TOLERANCE_PX = 8;

type MessageBubbleProps = {
  message: Message;
  conversations: Conversation[];
  messageIndex: number;
  messageCount: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isReorderDisabled: boolean;
  isEditing: boolean;
  editText: string;
  editReferences: MessageReference[];
  editScheduledAt: Date | null;
  editImagePreviews: Array<{ id: string; file: File; url: string }>;
  activeReferenceTarget: MessageReferenceNavigationTarget | null;
  isSavingEdit: boolean;
  editTextareaRef: RefObject<HTMLTextAreaElement | null>;
  copyFeedbackStatus: CopyFeedbackStatus | null;
  sourceConversationTitle?: string | null;
  backlinks: MessageBacklink[];
  onSelect: (messageId: string) => void;
  onStartSelection: (messageId: string) => void;
  onNavigateToReference: (target: MessageReferenceNavigationTarget) => void;
  onNavigateToConversation: (conversationId: string) => void;
  canNavigateToReference: (reference: MessageReference) => boolean;
  onNavigateToMessage: (messageId: string) => void;
  canNavigateToMessage: (messageId: string) => boolean;
  onCancelEdit: () => void;
  onEditTextChange: (value: string) => void;
  onEditScheduledAtChange: (scheduledAt: Date | null) => void;
  onRemoveEditReference: (referenceId: string) => void;
  onEditImagePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemoveEditImage: (previewId: string) => void;
  onSaveEdit: (message: Message) => void;
  onEditMessage: (message: Message) => void;
  onCopyMessage: (message: Message) => void;
  onConnectMessage: (message: Message) => void;
  onConvertToEnglish: (message: Message) => void;
  onForwardMessage: (message: Message) => void;
  onMoveToConversation: (message: Message) => void;
  onDeleteMessage: (message: Message) => void;
  onMoveMessage: (messageIndex: number, direction: -1 | 1) => void;
  onUpdateTags: (message: Message, tags: string[]) => void | Promise<void>;
  tagSuggestions: TagSummary[];
  onDragStart: (event: DragEvent<HTMLElement>, messageId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>, messageId: string) => void;
  onDragLeave: (event: DragEvent<HTMLElement>, messageId: string) => void;
  onDrop: (event: DragEvent<HTMLElement>, messageId: string) => void;
  onDragEnd: () => void;
  onPointerDown: (event: PointerEvent<HTMLElement>, messageId: string) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
};

function getTransferLabel(message: Message) {
  if (message.transferType === 'moved') return 'Moved';
  if (message.transferType === 'forwarded' || message.isForwarded) return 'Copied';
  return null;
}

function getCopyFeedbackLabel(status: CopyFeedbackStatus) {
  return status === 'copied' ? 'Copied' : 'Copy failed';
}

function isMessageTarget(message: Message, target: MessageReferenceNavigationTarget | null) {
  return target?.messageId === message.id && target.conversationId === message.conversationId;
}

function clearNativeTextSelection() {
  window.getSelection()?.removeAllRanges();
}

function isInteractiveSelectionTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, input, textarea, select, a, label, [role="button"]'));
}

export function MessageBubble({
  message,
  conversations,
  messageIndex,
  messageCount,
  isSelectionMode,
  isSelected,
  isDragging,
  isDragOver,
  isReorderDisabled,
  isEditing,
  editText,
  editReferences,
  editScheduledAt,
  editImagePreviews,
  activeReferenceTarget,
  isSavingEdit,
  editTextareaRef,
  copyFeedbackStatus,
  sourceConversationTitle,
  backlinks,
  onSelect,
  onStartSelection,
  onNavigateToReference,
  onNavigateToConversation,
  canNavigateToReference,
  onNavigateToMessage,
  canNavigateToMessage,
  onCancelEdit,
  onEditTextChange,
  onEditScheduledAtChange,
  onRemoveEditReference,
  onEditImagePaste,
  onRemoveEditImage,
  onSaveEdit,
  onEditMessage,
  onCopyMessage,
  onConnectMessage,
  onConvertToEnglish,
  onForwardMessage,
  onMoveToConversation,
  onDeleteMessage,
  onMoveMessage,
  onUpdateTags,
  tagSuggestions,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: MessageBubbleProps) {
  const tapStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ timeoutId: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);
  const messageClassName = [
    'message-bubble',
    isSelected ? 'selected' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : '',
    isMessageTarget(message, activeReferenceTarget) ? 'reference-target' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const transferLabel = getTransferLabel(message);
  const canShowSourceLink = Boolean(
    sourceConversationTitle && message.transferType !== 'moved' && message.forwardedFromConversationId
  );
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  const copyTitle = hasAttachments ? 'Copy block' : 'Copy text';
  const isConversationIndex = message.blockKind === 'conversation-index' && (message.indexEntries?.length ?? 0) > 0;
  const scheduledAt = message.scheduledAt ?? null;

  useEffect(() => {
    return () => {
      if (lastTapRef.current) window.clearTimeout(lastTapRef.current.timeoutId);
      if (suppressClickTimeoutRef.current !== null) window.clearTimeout(suppressClickTimeoutRef.current);
    };
  }, []);

  function clearLastTap() {
    if (lastTapRef.current) window.clearTimeout(lastTapRef.current.timeoutId);
    lastTapRef.current = null;
  }

  function clearSuppressedClick() {
    suppressNextClickRef.current = false;
    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
      suppressClickTimeoutRef.current = null;
    }
  }

  function suppressClickSoon() {
    suppressNextClickRef.current = true;
    if (suppressClickTimeoutRef.current !== null) window.clearTimeout(suppressClickTimeoutRef.current);
    suppressClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressClickTimeoutRef.current = null;
    }, DOUBLE_TAP_TIMEOUT_MS);
  }

  function handleSelectionPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse' || isEditing || isSelectionMode || isInteractiveSelectionTarget(event.target)) {
      tapStartRef.current = null;
      return;
    }

    tapStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleSelectionPointerUp(event: PointerEvent<HTMLElement>) {
    const tapStart = tapStartRef.current;
    tapStartRef.current = null;

    if (
      event.pointerType === 'mouse' ||
      isEditing ||
      isSelectionMode ||
      isInteractiveSelectionTarget(event.target) ||
      !tapStart ||
      tapStart.pointerId !== event.pointerId
    ) {
      return;
    }

    const moved =
      Math.abs(event.clientX - tapStart.x) > TAP_MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - tapStart.y) > TAP_MOVE_TOLERANCE_PX;
    if (moved) {
      clearLastTap();
      return;
    }

    if (lastTapRef.current) {
      clearLastTap();
      suppressClickSoon();
      event.preventDefault();
      event.stopPropagation();
      clearNativeTextSelection();
      onStartSelection(message.id);
      return;
    }

    lastTapRef.current = {
      timeoutId: window.setTimeout(() => {
        lastTapRef.current = null;
      }, DOUBLE_TAP_TIMEOUT_MS)
    };
  }

  function handleSelectionPointerCancel() {
    tapStartRef.current = null;
  }

  function handleSelectionClick(event: MouseEvent<HTMLElement>) {
    if (suppressNextClickRef.current) {
      clearSuppressedClick();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!isSelectionMode || isEditing || isInteractiveSelectionTarget(event.target)) return;
    event.preventDefault();
    clearNativeTextSelection();
    onSelect(message.id);
  }

  function handleSelectionDoubleClick(event: MouseEvent<HTMLElement>) {
    if (isSelectionMode || isEditing || isInteractiveSelectionTarget(event.target)) return;
    event.preventDefault();
    clearNativeTextSelection();
    onStartSelection(message.id);
  }

  function handleBlockContextMenu(event: MouseEvent<HTMLElement>) {
    if (isInteractiveSelectionTarget(event.target)) return;
    event.preventDefault();
    clearNativeTextSelection();
  }

  return (
    <article
      className={messageClassName}
      data-message-id={message.id}
      aria-grabbed={isDragging}
      style={{ userSelect: isSelectionMode ? 'none' : undefined }}
      onClick={handleSelectionClick}
      onDoubleClick={handleSelectionDoubleClick}
      onContextMenu={handleBlockContextMenu}
      onPointerDown={handleSelectionPointerDown}
      onPointerUp={handleSelectionPointerUp}
      onPointerCancel={handleSelectionPointerCancel}
      onDragOver={(event) => onDragOver(event, message.id)}
      onDragLeave={(event) => onDragLeave(event, message.id)}
      onDrop={(event) => onDrop(event, message.id)}
    >
      <div className="message-meta">
        {transferLabel && (
          <span>
            {transferLabel}
            {canShowSourceLink && (
              <>
                {' from '}
                <button
                  className="source-link"
                  type="button"
                  onClick={() =>
                    onNavigateToReference({
                      conversationId: message.forwardedFromConversationId as string
                    })
                  }
                >
                  {sourceConversationTitle}
                </button>
              </>
            )}
          </span>
        )}
        {message.updatedAt && <span>edited</span>}
        {scheduledAt && (
          <span className="message-scheduled-meta">
            <CalendarClock size={13} />
            {formatFullDateTime(scheduledAt)}
          </span>
        )}
        <time>{formatDate(message.createdAt)}</time>
      </div>

      <MessageTagEditor
        message={message}
        isSelectionMode={isSelectionMode}
        tagSuggestions={tagSuggestions}
        onUpdateTags={onUpdateTags}
      />

      {isEditing ? (
        <MessageEditForm
          message={message}
          editText={editText}
          editReferences={editReferences}
          editScheduledAt={editScheduledAt}
          editImagePreviews={editImagePreviews}
          isSavingEdit={isSavingEdit}
          editTextareaRef={editTextareaRef}
          onCancelEdit={onCancelEdit}
          onEditTextChange={onEditTextChange}
          onEditScheduledAtChange={onEditScheduledAtChange}
          onRemoveEditReference={onRemoveEditReference}
          onEditImagePaste={onEditImagePaste}
          onRemoveEditImage={onRemoveEditImage}
          onSaveEdit={onSaveEdit}
        />
      ) : (
        <>
          {hasAttachments && (
            <div className="message-attachments">
              {message.attachments?.map((attachment) => (
                <div key={attachment.id} className="message-image-preview" title={attachment.name}>
                  <img src={attachment.url} alt={attachment.name || 'Attached image'} loading="lazy" />
                </div>
              ))}
            </div>
          )}
          {isConversationIndex ? (
            <div className="conversation-index-list" aria-label="Conversation index">
              {message.indexEntries?.map((entry, entryIndex) => {
                const canNavigate = canNavigateToMessage(entry.sourceMessageId);
                return (
                  <button
                    key={entry.id}
                    className="conversation-index-entry"
                    type="button"
                    disabled={!canNavigate}
                    title={canNavigate ? 'Open indexed block' : 'Indexed block is unavailable'}
                    onClick={() => onNavigateToMessage(entry.sourceMessageId)}
                  >
                    <span className="conversation-index-number">{entryIndex + 1}</span>
                    <span className="conversation-index-content">
                      <strong>{entry.title}</strong>
                      <span>{entry.summary}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <MessageText
              message={message}
              activeReferenceTarget={activeReferenceTarget}
              conversations={conversations}
              onNavigateToConversation={onNavigateToConversation}
            />
          )}
          <MessageConnections
            references={message.references}
            backlinks={backlinks}
            canNavigateToReference={canNavigateToReference}
            onNavigateToReference={onNavigateToReference}
          />
          {!isSelectionMode && (
            <div className="message-actions">
              <div className="reorder-actions" aria-label="Reorder message">
                <button
                  className="icon-button bare"
                  title="Move up"
                  disabled={isReorderDisabled || messageIndex === 0}
                  onClick={() => onMoveMessage(messageIndex, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button bare"
                  title="Move down"
                  disabled={isReorderDisabled || messageIndex === messageCount - 1}
                  onClick={() => onMoveMessage(messageIndex, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-button bare drag-handle"
                  title="Drag to reorder"
                  draggable={!isReorderDisabled && messageCount > 1}
                  disabled={isReorderDisabled || messageCount < 2}
                  onDragStart={(event) => onDragStart(event, message.id)}
                  onDragEnd={onDragEnd}
                  onPointerDown={(event) => onPointerDown(event, message.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                >
                  <GripVertical size={16} />
                </button>
              </div>
              <button className="icon-button bare" title="Edit" onClick={() => onEditMessage(message)}>
                <Edit3 size={16} />
              </button>
              <button className="icon-button bare" title="Connect block" onClick={() => onConnectMessage(message)}>
                <Link2 size={16} />
              </button>
              <button
                className="icon-button bare"
                title={copyTitle}
                disabled={!message.text.trim() && !hasAttachments}
                onClick={() => onCopyMessage(message)}
              >
                <Copy size={16} />
              </button>
              <button
                className="icon-button bare"
                title="Convert to English"
                disabled={!message.text.trim()}
                onClick={() => onConvertToEnglish(message)}
              >
                <Languages size={16} />
              </button>
              {copyFeedbackStatus && (
                <span className="copy-status" aria-live="polite">
                  {getCopyFeedbackLabel(copyFeedbackStatus)}
                </span>
              )}
              <button className="icon-button bare" title="Forward" onClick={() => onForwardMessage(message)}>
                <Forward size={16} />
              </button>
              <button className="icon-button bare" title="Move to conversation" onClick={() => onMoveToConversation(message)}>
                <MoveRight size={16} />
              </button>
              <button className="icon-button bare" title="Delete" onClick={() => onDeleteMessage(message)}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
