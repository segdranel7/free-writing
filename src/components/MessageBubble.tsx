import { type DragEvent, type PointerEvent, type RefObject } from 'react';
import { ArrowDown, ArrowUp, Copy, Edit3, Forward, Languages, MoveRight, Reply, Trash2 } from 'lucide-react';
import type { Message } from '../types';
import { formatDate } from '../utils/date';

const SOURCE_MARKER = '<-source';

export type CopyFeedbackStatus = 'copied' | 'failed';

type MessageBubbleProps = {
  message: Message;
  messageIndex: number;
  messageCount: number;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isEditing: boolean;
  editText: string;
  isSavingEdit: boolean;
  editTextareaRef: RefObject<HTMLTextAreaElement | null>;
  copyFeedbackStatus: CopyFeedbackStatus | null;
  onSelect: (messageId: string) => void;
  onNavigateToSource: (conversationId: string) => void;
  onCancelEdit: () => void;
  onEditTextChange: (value: string) => void;
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
  if (message.transferType === 'forwarded' || message.isForwarded) return 'Forwarded';
  return null;
}

function getCopyFeedbackLabel(status: CopyFeedbackStatus) {
  return status === 'copied' ? 'Copied' : 'Copy failed';
}

function shouldShowSourceLink(message: Message) {
  return Boolean(message.forwardedFromConversationId && message.text.includes(SOURCE_MARKER));
}

export function MessageBubble({
  message,
  messageIndex,
  messageCount,
  isSelected,
  isDragging,
  isDragOver,
  isEditing,
  editText,
  isSavingEdit,
  editTextareaRef,
  copyFeedbackStatus,
  onSelect,
  onNavigateToSource,
  onCancelEdit,
  onEditTextChange,
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
  const messageClassName = [
    'message-bubble',
    isSelected ? 'selected' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const transferLabel = getTransferLabel(message);

  return (
    <article
      className={messageClassName}
      draggable={messageCount > 1}
      data-message-id={message.id}
      aria-grabbed={isDragging}
      onDragStart={(event) => onDragStart(event, message.id)}
      onDragOver={(event) => onDragOver(event, message.id)}
      onDragLeave={(event) => onDragLeave(event, message.id)}
      onDrop={(event) => onDrop(event, message.id)}
      onDragEnd={onDragEnd}
      onPointerDown={(event) => onPointerDown(event, message.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="message-meta">
        <label className="message-selector">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(message.id)}
            aria-label={`Select block: ${message.text.slice(0, 48) || 'empty block'}`}
          />
        </label>
        {transferLabel && <span>{transferLabel}</span>}
        {shouldShowSourceLink(message) && (
          <button
            className="source-link"
            title="Open source conversation"
            onClick={() => onNavigateToSource(message.forwardedFromConversationId as string)}
          >
            <Reply size={13} />
            Source
          </button>
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
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                onSaveEdit(message);
              }
            }}
          />
          <div className="message-edit-actions">
            <button className="text-button" type="button" onClick={onCancelEdit}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={!editText.trim() || isSavingEdit}>
              {isSavingEdit ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p>{message.text}</p>
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
            </div>
            <button className="icon-button bare" title="Edit" onClick={() => onEditMessage(message)}>
              <Edit3 size={16} />
            </button>
            <button className="icon-button bare" title="Copy text" onClick={() => onCopyMessage(message)}>
              <Copy size={16} />
            </button>
            <button className="icon-button bare" title="Convert to English" onClick={() => onConvertToEnglish(message)}>
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
        </>
      )}
    </article>
  );
}
