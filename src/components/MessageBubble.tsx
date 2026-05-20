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
  Copy,
  Edit3,
  Forward,
  GripVertical,
  Languages,
  Link2,
  MoveRight,
  Quote,
  Trash2,
  X
} from 'lucide-react';
import type { Message, MessageReference } from '../types';
import { formatDate } from '../utils/date';
import { getReferenceNavigationTarget, truncateReferenceText, type MessageReferenceNavigationTarget } from '../utils/messageReferences';

export type CopyFeedbackStatus = 'copied' | 'failed';

const DOUBLE_TAP_TIMEOUT_MS = 350;
const TAP_MOVE_TOLERANCE_PX = 8;

type MessageBubbleProps = {
  message: Message;
  messageIndex: number;
  messageCount: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isEditing: boolean;
  editText: string;
  editReferences: MessageReference[];
  editImagePreviews: Array<{ id: string; file: File; url: string }>;
  activeReferenceTarget: MessageReferenceNavigationTarget | null;
  isSavingEdit: boolean;
  editTextareaRef: RefObject<HTMLTextAreaElement | null>;
  copyFeedbackStatus: CopyFeedbackStatus | null;
  sourceConversationTitle?: string | null;
  onSelect: (messageId: string) => void;
  onStartSelection: (messageId: string) => void;
  onNavigateToReference: (target: MessageReferenceNavigationTarget) => void;
  canNavigateToReference: (reference: MessageReference) => boolean;
  onCancelEdit: () => void;
  onEditTextChange: (value: string) => void;
  onRemoveEditReference: (referenceId: string) => void;
  onEditImagePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemoveEditImage: (previewId: string) => void;
  onSaveEdit: (message: Message) => void;
  onEditMessage: (message: Message) => void;
  onCopyMessage: (message: Message) => void;
  onConvertToEnglish: (message: Message) => void;
  onForwardMessage: (message: Message) => void;
  onMoveToConversation: (message: Message) => void;
  onDeleteMessage: (message: Message) => void;
  onMoveMessage: (messageIndex: number, direction: -1 | 1) => void;
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

function renderMessageText(message: Message, target: MessageReferenceNavigationTarget | null) {
  if (!message.text) return null;
  const range = isMessageTarget(message, target) ? target?.range : null;
  if (!range || range.endOffset <= range.startOffset) return <p>{message.text}</p>;

  const start = Math.max(0, Math.min(range.startOffset, message.text.length));
  const end = Math.max(start, Math.min(range.endOffset, message.text.length));

  return (
    <p>
      {message.text.slice(0, start)}
      <mark className="reference-highlight">{message.text.slice(start, end)}</mark>
      {message.text.slice(end)}
    </p>
  );
}

export function MessageBubble({
  message,
  messageIndex,
  messageCount,
  isSelectionMode,
  isSelected,
  isDragging,
  isDragOver,
  isEditing,
  editText,
  editReferences,
  editImagePreviews,
  activeReferenceTarget,
  isSavingEdit,
  editTextareaRef,
  copyFeedbackStatus,
  sourceConversationTitle,
  onSelect,
  onStartSelection,
  onNavigateToReference,
  canNavigateToReference,
  onCancelEdit,
  onEditTextChange,
  onRemoveEditReference,
  onEditImagePaste,
  onRemoveEditImage,
  onSaveEdit,
  onEditMessage,
  onCopyMessage,
  onConvertToEnglish,
  onForwardMessage,
  onMoveToConversation,
  onDeleteMessage,
  onMoveMessage,
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
        <time>{formatDate(message.createdAt)}</time>
      </div>

      {isEditing ? (
        <form
          className="message-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveEdit(message);
          }}
        >
          <textarea
            aria-label="Edit message text"
            ref={editTextareaRef}
            value={editText}
            rows={1}
            onChange={(event) => onEditTextChange(event.target.value)}
            onPaste={onEditImagePaste}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                onSaveEdit(message);
              }
            }}
          />
          {editReferences.length > 0 && (
            <div className="message-reference-list" aria-label="Block references">
              {editReferences.map((reference) => (
                <div key={reference.id} className="message-reference-card">
                  {reference.type === 'quote' ? <Quote size={15} /> : <Link2 size={15} />}
                  <span>
                    {reference.type === 'quote'
                      ? `"${truncateReferenceText(reference.quoteText, 88)}"`
                      : reference.sourceConversationTitle}
                  </span>
                  <button
                    className="icon-button bare"
                    type="button"
                    title="Remove reference"
                    onClick={() => onRemoveEditReference(reference.id)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {((message.attachments?.length ?? 0) > 0 || editImagePreviews.length > 0) && (
            <div className="message-edit-images" aria-label="Block images">
              {message.attachments?.map((attachment) => (
                <div key={attachment.id} className="composer-image-preview" title={attachment.name}>
                  <img src={attachment.url} alt={attachment.name || 'Attached image'} />
                </div>
              ))}
              {editImagePreviews.map((preview) => (
                <figure key={preview.id} className="composer-image-preview">
                  <img src={preview.url} alt={preview.file.name} />
                  <button
                    className="icon-button bare remove-image-button"
                    type="button"
                    title="Remove image"
                    onClick={() => onRemoveEditImage(preview.id)}
                  >
                    <X size={15} />
                  </button>
                </figure>
              ))}
            </div>
          )}
          <div className="message-edit-actions">
            <button className="text-button" type="button" onClick={onCancelEdit}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={
                (!editText.trim() &&
                  (message.attachments?.length ?? 0) === 0 &&
                  editImagePreviews.length === 0 &&
                  editReferences.length === 0) ||
                isSavingEdit
              }
            >
              {isSavingEdit ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
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
          {renderMessageText(message, activeReferenceTarget)}
          {message.references.length > 0 && (
            <div className="message-reference-list" aria-label="Message references">
              {message.references.map((reference) => (
                <button
                  key={reference.id}
                  className="message-reference-card"
                  type="button"
                  disabled={!canNavigateToReference(reference)}
                  title={canNavigateToReference(reference) ? 'Open reference' : 'Original reference is unavailable'}
                  onClick={() => onNavigateToReference(getReferenceNavigationTarget(reference))}
                >
                  {reference.type === 'quote' ? <Quote size={15} /> : <Link2 size={15} />}
                  <span>
                    <strong>{reference.sourceConversationTitle}</strong>
                    {reference.type === 'quote'
                      ? `: "${truncateReferenceText(reference.quoteText)}"`
                      : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!isSelectionMode && (
            <div className="message-actions">
              <div className="reorder-actions" aria-label="Reorder message">
                <button
                  className="icon-button bare"
                  title="Move up"
                  disabled={messageIndex === 0}
                  onClick={() => onMoveMessage(messageIndex, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button bare"
                  title="Move down"
                  disabled={messageIndex === messageCount - 1}
                  onClick={() => onMoveMessage(messageIndex, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-button bare drag-handle"
                  title="Drag to reorder"
                  draggable={messageCount > 1}
                  disabled={messageCount < 2}
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
