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
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  Copy,
  Download,
  Edit3,
  Forward,
  GripVertical,
  Languages,
  Link2,
  MoreHorizontal,
  MoveRight,
  X,
  Trash2
} from 'lucide-react';
import { MessageEditForm } from './MessageEditForm';
import { MessageConnections } from './MessageConnections';
import { HeaderOverflowMenu, type HeaderOverflowMenuItem } from './HeaderOverflowMenu';
import { MessageTagEditor } from './MessageTagEditor';
import { MessageText } from './MessageText';
import type { Conversation, KanbanColumn, Message, MessageReference } from '../types';
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
  isInformationMode: boolean;
  isNormalModeOverride: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isReorderDisabled: boolean;
  kanbanColumns: KanbanColumn[];
  currentKanbanColumnId: string | null;
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
  onStartSelection: (messageId: string, options?: { suppressNextClick?: boolean }) => void;
  onToggleNormalModeOverride: (messageId: string) => void;
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
  onDownloadMessage: (message: Message) => void;
  onConnectMessage: (message: Message) => void;
  onConvertToEnglish: (message: Message) => void;
  onForwardMessage: (message: Message) => void;
  onMoveToConversation: (message: Message) => void;
  onDeleteMessage: (message: Message) => void;
  onMoveMessage: (messageIndex: number, direction: -1 | 1) => void;
  onAssignKanbanColumn: (message: Message, columnId: string | null) => void;
  onMoveKanbanMessage: (message: Message, columnId: string, direction: -1 | 1) => void;
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
  isInformationMode,
  isNormalModeOverride,
  isSelected,
  isDragging,
  isDragOver,
  isReorderDisabled,
  kanbanColumns,
  currentKanbanColumnId,
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
  onToggleNormalModeOverride,
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
  onDownloadMessage,
  onConnectMessage,
  onConvertToEnglish,
  onForwardMessage,
  onMoveToConversation,
  onDeleteMessage,
  onMoveMessage,
  onAssignKanbanColumn,
  onMoveKanbanMessage,
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
  const messageClassName = [
    'message-bubble',
    isSelected ? 'selected' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : '',
    message.isPending ? 'pending' : '',
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
  const isBlockInformationMode = isInformationMode && !isNormalModeOverride;
  const canToggleNormalModeOverride = isInformationMode && !message.isPending && Boolean(message.text.trim());
  const isKanbanCard = Boolean(currentKanbanColumnId);
  const currentKanbanColumnIndex = kanbanColumns.findIndex((column) => column.id === currentKanbanColumnId);
  const assignedKanbanColumnIndex = kanbanColumns.findIndex((column) => column.id === message.kanbanColumnId);
  const assignedKanbanColumnTitle =
    assignedKanbanColumnIndex >= 0 ? kanbanColumns[assignedKanbanColumnIndex].title : 'No Kanban column';
  const kanbanColumnSelector =
    kanbanColumns.length > 0 && !message.isPending ? (
      <select
        className={message.kanbanColumnId ? 'kanban-column-select assigned' : 'kanban-column-select'}
        aria-label="Assign to Kanban column"
        title={`Kanban column: ${assignedKanbanColumnTitle}`}
        value={message.kanbanColumnId ?? ''}
        onChange={(event) => onAssignKanbanColumn(message, event.target.value || null)}
      >
        <option value="">∅</option>
        {kanbanColumns.map((column) => (
          <option key={column.id} value={column.id}>
            {column.title}
          </option>
        ))}
      </select>
    ) : null;
  const hasPreviousKanbanColumn = currentKanbanColumnIndex > 0;
  const hasNextKanbanColumn = currentKanbanColumnIndex >= 0 && currentKanbanColumnIndex < kanbanColumns.length - 1;
  const blockOverflowActions: HeaderOverflowMenuItem[] = [
    ...(!isKanbanCard
      ? [
          {
            label: 'Move up',
            icon: <ArrowUp size={17} />,
            disabled: isReorderDisabled || messageIndex === 0,
            onClick: () => onMoveMessage(messageIndex, -1)
          },
          {
            label: 'Move down',
            icon: <ArrowDown size={17} />,
            disabled: isReorderDisabled || messageIndex === messageCount - 1,
            onClick: () => onMoveMessage(messageIndex, 1)
          },
          {
            label: 'Drag to reorder',
            icon: <GripVertical size={17} />,
            disabled: isReorderDisabled || messageCount < 2,
            draggable: !isReorderDisabled && messageCount > 1,
            onDragStart: (event: DragEvent<HTMLButtonElement>) => onDragStart(event, message.id),
            onDragEnd,
            onPointerDown: (event: PointerEvent<HTMLButtonElement>) => onPointerDown(event, message.id),
            onPointerMove,
            onPointerUp,
            onPointerCancel
          }
        ]
      : []),
    {
      label: 'Delete',
      icon: <Trash2 size={17} />,
      danger: true,
      onClick: () => onDeleteMessage(message)
    }
  ];

  useEffect(() => {
    return () => {
      if (lastTapRef.current) window.clearTimeout(lastTapRef.current.timeoutId);
    };
  }, []);

  function clearLastTap() {
    if (lastTapRef.current) window.clearTimeout(lastTapRef.current.timeoutId);
    lastTapRef.current = null;
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
      event.preventDefault();
      event.stopPropagation();
      clearNativeTextSelection();
      onStartSelection(message.id, { suppressNextClick: true });
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
        {message.isPending && <span>Sending...</span>}
        {scheduledAt && (
          <span className="message-scheduled-meta">
            <CalendarClock size={13} />
            {formatFullDateTime(scheduledAt)}
          </span>
        )}
        <time>{formatDate(message.createdAt)}</time>
        {canToggleNormalModeOverride && (
          <button
            className="icon-button bare"
            type="button"
            title={isNormalModeOverride ? 'Return block to view mode' : 'Show normal controls'}
            onClick={() => onToggleNormalModeOverride(message.id)}
          >
            {isNormalModeOverride ? <X size={16} /> : <MoreHorizontal size={16} />}
          </button>
        )}
      </div>

      <MessageTagEditor
        message={message}
        isSelectionMode={isSelectionMode || isBlockInformationMode || Boolean(message.isPending)}
        tagSuggestions={tagSuggestions}
        onUpdateTags={onUpdateTags}
        trailingControl={!isBlockInformationMode && !isSelectionMode ? kanbanColumnSelector : null}
      />

      {isEditing ? (
        <MessageEditForm
          message={message}
          conversations={conversations}
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
              isInformationMode={isBlockInformationMode}
              onNavigateToConversation={onNavigateToConversation}
            />
          )}
          <MessageConnections
            references={message.references}
            backlinks={backlinks}
            isInformationMode={isBlockInformationMode}
            canNavigateToReference={canNavigateToReference}
            onNavigateToReference={onNavigateToReference}
          />
          {!isSelectionMode && !isBlockInformationMode && !message.isPending && (
            <div className="message-actions">
              {isKanbanCard && currentKanbanColumnId && (
                <div className="reorder-actions" aria-label="Move Kanban card">
                  <button
                    className="icon-button bare"
                    title="Move to previous column"
                    disabled={!hasPreviousKanbanColumn}
                    onClick={() => {
                      const targetColumn = kanbanColumns[currentKanbanColumnIndex - 1];
                      if (targetColumn) onAssignKanbanColumn(message, targetColumn.id);
                    }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    className="icon-button bare"
                    title="Move up in column"
                    disabled={messageIndex === 0}
                    onClick={() => onMoveKanbanMessage(message, currentKanbanColumnId, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button bare"
                    title="Move down in column"
                    disabled={messageIndex === messageCount - 1}
                    onClick={() => onMoveKanbanMessage(message, currentKanbanColumnId, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon-button bare"
                    title="Move to next column"
                    disabled={!hasNextKanbanColumn}
                    onClick={() => {
                      const targetColumn = kanbanColumns[currentKanbanColumnIndex + 1];
                      if (targetColumn) onAssignKanbanColumn(message, targetColumn.id);
                    }}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
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
                title="Download text as Markdown"
                disabled={!message.text.trim()}
                onClick={() => onDownloadMessage(message)}
              >
                <Download size={16} />
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
              <HeaderOverflowMenu label="More block actions" items={blockOverflowActions} />
            </div>
          )}
        </>
      )}
    </article>
  );
}
