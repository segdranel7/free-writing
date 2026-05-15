import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Combine, Copy, Edit3, Forward, Languages, MoreVertical, MoveRight, Reply, Send, Trash2, X } from 'lucide-react';
import type { Conversation, EnglishConversion, Message } from '../types';
import { formatDate } from '../utils/date';

type ConversationPaneProps = {
  activeConversation: Conversation | null;
  activeMessages: Message[];
  draft: string;
  editingMessage: Message | null;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onSubmitMessage: () => void;
  onCancelEdit: () => void;
  onEditMessage: (message: Message) => void;
  onForwardMessage: (message: Message) => void;
  onMoveToConversation: (message: Message) => void;
  onNavigateToSource: (conversationId: string) => void;
  onDeleteMessage: (message: Message) => void;
  onMoveMessage: (messageIndex: number, direction: -1 | 1) => void;
  onReorderMessage: (draggedMessageId: string, targetMessageId: string) => void;
  onMergeMessages: (messages: Message[]) => Promise<void>;
  onConvertToEnglish: (text: string) => Promise<EnglishConversion>;
  onCreateEnglishBlock: (message: Message, text: string) => Promise<void>;
  onReplaceWithEnglish: (message: Message, text: string) => Promise<void>;
};

const COPY_FEEDBACK_TIMEOUT_MS = 1600;
const TOUCH_DRAG_THRESHOLD_PX = 8;

type CopyFeedback = {
  messageId: string;
  status: 'copied' | 'failed';
};

type EnglishPickerState = {
  source: { type: 'message'; message: Message } | { type: 'draft' };
  status: 'loading' | 'ready' | 'creating' | 'replacing' | 'using-draft' | 'error';
  conversion: EnglishConversion | null;
  selections: number[];
  error: string | null;
};

type TouchDragState = {
  messageId: string;
  pointerId: number;
  startX: number;
  startY: number;
  isDragging: boolean;
};

function getTransferLabel(message: Message) {
  if (message.transferType === 'moved') return 'Moved';
  if (message.transferType === 'forwarded' || message.isForwarded) return 'Forwarded';
  return null;
}

function getCopyFeedbackLabel(feedback: CopyFeedback) {
  return feedback.status === 'copied' ? 'Copied' : 'Copy failed';
}

export function ConversationPane({
  activeConversation,
  activeMessages,
  draft,
  editingMessage,
  onBack,
  onDraftChange,
  onSubmitMessage,
  onCancelEdit,
  onEditMessage,
  onForwardMessage,
  onMoveToConversation,
  onNavigateToSource,
  onDeleteMessage,
  onMoveMessage,
  onReorderMessage,
  onMergeMessages,
  onConvertToEnglish,
  onCreateEnglishBlock,
  onReplaceWithEnglish
}: ConversationPaneProps) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const [englishPicker, setEnglishPicker] = useState<EnglishPickerState | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null);
  const [dragOverMessageId, setDragOverMessageId] = useState<string | null>(null);
  const touchDrag = useRef<TouchDragState | null>(null);

  const selectedMessages = activeMessages.filter((message) => selectedMessageIds.includes(message.id));

  useEffect(() => {
    if (!copyFeedback) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCopyFeedback((currentFeedback) =>
        currentFeedback?.messageId === copyFeedback.messageId ? null : currentFeedback
      );
    }, COPY_FEEDBACK_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [copyFeedback]);

  useEffect(() => {
    const activeMessageIds = new Set(activeMessages.map((message) => message.id));
    setSelectedMessageIds((currentIds) => {
      const nextIds = currentIds.filter((messageId) => activeMessageIds.has(messageId));
      return nextIds.length === currentIds.length ? currentIds : nextIds;
    });
  }, [activeConversation?.id, activeMessages]);

  function toggleMessageSelection(messageId: string) {
    setMergeError(null);
    setSelectedMessageIds((currentIds) =>
      currentIds.includes(messageId)
        ? currentIds.filter((currentId) => currentId !== messageId)
        : [...currentIds, messageId]
    );
  }

  function isInteractiveDragTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('button, input, label, a, textarea, select'));
  }

  function handleMessageDragStart(event: DragEvent<HTMLElement>, messageId: string) {
    if (isInteractiveDragTarget(event.target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', messageId);
    setDraggedMessageId(messageId);
  }

  function handleMessageDragOver(event: DragEvent<HTMLElement>, messageId: string) {
    if (!draggedMessageId || draggedMessageId === messageId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverMessageId(messageId);
  }

  function handleMessageDragLeave(event: DragEvent<HTMLElement>, messageId: string) {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setDragOverMessageId((currentId) => (currentId === messageId ? null : currentId));
  }

  function handleMessageDrop(event: DragEvent<HTMLElement>, targetMessageId: string) {
    event.preventDefault();
    const droppedMessageId = event.dataTransfer.getData('text/plain') || draggedMessageId;
    setDraggedMessageId(null);
    setDragOverMessageId(null);
    if (!droppedMessageId || droppedMessageId === targetMessageId) return;
    onReorderMessage(droppedMessageId, targetMessageId);
  }

  function handleMessageDragEnd() {
    setDraggedMessageId(null);
    setDragOverMessageId(null);
  }

  function findMessageIdAtPoint(clientX: number, clientY: number) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>('[data-message-id]')?.dataset.messageId ?? null;
  }

  function clearTouchDrag() {
    touchDrag.current = null;
    setDraggedMessageId(null);
    setDragOverMessageId(null);
  }

  function handleMessagePointerDown(event: PointerEvent<HTMLElement>, messageId: string) {
    if (event.pointerType === 'mouse' || activeMessages.length < 2 || isInteractiveDragTarget(event.target)) return;

    touchDrag.current = {
      messageId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMessagePointerMove(event: PointerEvent<HTMLElement>) {
    const currentDrag = touchDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    const moveX = event.clientX - currentDrag.startX;
    const moveY = event.clientY - currentDrag.startY;
    const hasPassedThreshold = Math.hypot(moveX, moveY) >= TOUCH_DRAG_THRESHOLD_PX;
    if (!currentDrag.isDragging && !hasPassedThreshold) return;

    event.preventDefault();

    if (!currentDrag.isDragging) {
      touchDrag.current = { ...currentDrag, isDragging: true };
      setDraggedMessageId(currentDrag.messageId);
    }

    const targetMessageId = findMessageIdAtPoint(event.clientX, event.clientY);
    setDragOverMessageId(
      targetMessageId && targetMessageId !== currentDrag.messageId ? targetMessageId : null
    );
  }

  function handleMessagePointerUp(event: PointerEvent<HTMLElement>) {
    const currentDrag = touchDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    const targetMessageId = findMessageIdAtPoint(event.clientX, event.clientY);
    const shouldReorder = currentDrag.isDragging && targetMessageId && targetMessageId !== currentDrag.messageId;
    clearTouchDrag();
    if (shouldReorder) onReorderMessage(currentDrag.messageId, targetMessageId);
  }

  async function mergeSelectedMessages() {
    if (selectedMessages.length < 2) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      await onMergeMessages(selectedMessages);
      setSelectedMessageIds([]);
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Unable to merge the selected blocks.');
    } finally {
      setIsMerging(false);
    }
  }

  async function copyMessageText(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopyFeedback({ messageId: message.id, status: 'copied' });
    } catch (error) {
      console.error('Unable to copy message text.', error);
      setCopyFeedback({ messageId: message.id, status: 'failed' });
    }
  }

  async function openMessageEnglishPicker(message: Message) {
    setEnglishPicker({
      source: { type: 'message', message },
      status: 'loading',
      conversion: null,
      selections: [],
      error: null
    });

    try {
      const conversion = await onConvertToEnglish(message.text);
      setEnglishPicker({
        source: { type: 'message', message },
        status: 'ready',
        conversion,
        selections: conversion.segments.map(() => 0),
        error: null
      });
    } catch (error) {
      setEnglishPicker({
        source: { type: 'message', message },
        status: 'error',
        conversion: null,
        selections: [],
        error: error instanceof Error ? error.message : 'Unable to convert this text to English.'
      });
    }
  }

  async function openDraftEnglishPicker() {
    if (!draft.trim()) return;
    setEnglishPicker({
      source: { type: 'draft' },
      status: 'loading',
      conversion: null,
      selections: [],
      error: null
    });

    try {
      const conversion = await onConvertToEnglish(draft);
      setEnglishPicker({
        source: { type: 'draft' },
        status: 'ready',
        conversion,
        selections: conversion.segments.map(() => 0),
        error: null
      });
    } catch (error) {
      setEnglishPicker({
        source: { type: 'draft' },
        status: 'error',
        conversion: null,
        selections: [],
        error: error instanceof Error ? error.message : 'Unable to convert this text to English.'
      });
    }
  }

  function updateEnglishSelection(segmentIndex: number, optionIndex: number) {
    setEnglishPicker((current) => {
      if (!current) return current;
      const selections = [...current.selections];
      selections[segmentIndex] = optionIndex;
      return { ...current, selections };
    });
  }

  function getAssembledEnglishText(state: EnglishPickerState) {
    if (!state.conversion) return '';
    return state.conversion.segments
      .map((segment, segmentIndex) => segment.options[state.selections[segmentIndex] ?? 0])
      .join(' ')
      .trim();
  }

  async function saveEnglishResult(action: 'create' | 'replace' | 'draft') {
    if (!englishPicker || !englishPicker.conversion) return;
    const englishText = getAssembledEnglishText(englishPicker);
    if (!englishText) return;

    const nextStatus =
      action === 'create' ? 'creating' : action === 'replace' ? 'replacing' : 'using-draft';
    setEnglishPicker({ ...englishPicker, status: nextStatus, error: null });
    try {
      if (action === 'draft') {
        onDraftChange(englishText);
      } else if (englishPicker.source.type === 'message') {
        if (action === 'create') {
          await onCreateEnglishBlock(englishPicker.source.message, englishText);
        } else {
          await onReplaceWithEnglish(englishPicker.source.message, englishText);
        }
      }
      setEnglishPicker(null);
    } catch (error) {
      setEnglishPicker({
        ...englishPicker,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to save the English text.'
      });
    }
  }

  const englishPickerIsSaving =
    englishPicker?.status === 'creating' ||
    englishPicker?.status === 'replacing' ||
    englishPicker?.status === 'using-draft';

  return (
    <section className={`conversation-pane ${activeConversation ? 'open' : ''}`}>
      {activeConversation ? (
        <>
          <header className="conversation-header">
            <button className="icon-button back-button" title="Back" onClick={onBack}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2>{activeConversation.title}</h2>
            </div>
          </header>

          <div className="selection-toolbar" aria-live="polite">
            <span>{selectedMessages.length} selected</span>
            {mergeError && (
              <span className="merge-error" role="alert">
                {mergeError}
              </span>
            )}
            <button
              className="primary-button merge-button"
              type="button"
              title="Merge selected text blocks"
              disabled={selectedMessages.length < 2 || isMerging}
              onClick={() => void mergeSelectedMessages()}
            >
              <Combine size={16} />
              {isMerging ? 'Merging...' : 'Merge'}
            </button>
          </div>

          <div className="messages">
            {activeMessages.map((message, messageIndex) => {
              const messageClassName = [
                'message-bubble',
                selectedMessageIds.includes(message.id) ? 'selected' : '',
                draggedMessageId === message.id ? 'dragging' : '',
                dragOverMessageId === message.id ? 'drag-over' : ''
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <article
                  className={messageClassName}
                  draggable={activeMessages.length > 1}
                  key={message.id}
                  data-message-id={message.id}
                  aria-grabbed={draggedMessageId === message.id}
                  onDragStart={(event) => handleMessageDragStart(event, message.id)}
                  onDragOver={(event) => handleMessageDragOver(event, message.id)}
                  onDragLeave={(event) => handleMessageDragLeave(event, message.id)}
                  onDrop={(event) => handleMessageDrop(event, message.id)}
                  onDragEnd={handleMessageDragEnd}
                  onPointerDown={(event) => handleMessagePointerDown(event, message.id)}
                  onPointerMove={handleMessagePointerMove}
                  onPointerUp={handleMessagePointerUp}
                  onPointerCancel={clearTouchDrag}
                >
                  <div className="message-meta">
                    <label className="message-selector">
                      <input
                        type="checkbox"
                        checked={selectedMessageIds.includes(message.id)}
                        onChange={() => toggleMessageSelection(message.id)}
                        aria-label={`Select block: ${message.text.slice(0, 48) || 'empty block'}`}
                      />
                    </label>
                    {getTransferLabel(message) && <span>{getTransferLabel(message)}</span>}
                    {message.forwardedFromConversationId && (
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
                        disabled={messageIndex === activeMessages.length - 1}
                        onClick={() => onMoveMessage(messageIndex, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                    <button className="icon-button bare" title="Edit" onClick={() => onEditMessage(message)}>
                      <Edit3 size={16} />
                    </button>
                    <button className="icon-button bare" title="Copy text" onClick={() => void copyMessageText(message)}>
                      <Copy size={16} />
                    </button>
                    <button className="icon-button bare" title="Convert to English" onClick={() => void openMessageEnglishPicker(message)}>
                      <Languages size={16} />
                    </button>
                    {copyFeedback?.messageId === message.id && (
                      <span className="copy-status" aria-live="polite">
                        {getCopyFeedbackLabel(copyFeedback)}
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
                </article>
              );
            })}
            {activeMessages.length === 0 && <p className="empty-state">Write the first message here.</p>}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitMessage();
            }}
          >
            {editingMessage && (
              <div className="editing-strip">
                Editing message
                <button className="icon-button bare" type="button" title="Cancel edit" onClick={onCancelEdit}>
                  <X size={16} />
                </button>
              </div>
            )}
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  onSubmitMessage();
                }
              }}
              placeholder="Write a message"
              rows={2}
            />
            <div className="composer-actions">
              {!editingMessage && (
                <button
                  className="icon-button"
                  type="button"
                  title="Convert draft to English"
                  disabled={!draft.trim()}
                  onClick={() => void openDraftEnglishPicker()}
                >
                  <Languages size={17} />
                </button>
              )}
              <button className="primary-button send-button" disabled={!draft.trim()}>
                {editingMessage ? (
                  'Save'
                ) : (
                  <>
                    <Send size={16} />
                    Send
                  </>
                )}
              </button>
            </div>
          </form>

          {englishPicker && (
            <div className="modal-backdrop" role="presentation">
              <section className="english-picker" role="dialog" aria-modal="true" aria-labelledby="english-picker-title">
                <header className="english-picker-header">
                  <div>
                    <p className="eyebrow">English conversion</p>
                    <h3 id="english-picker-title">Choose English versions</h3>
                  </div>
                  <button className="icon-button bare" type="button" title="Close" onClick={() => setEnglishPicker(null)}>
                    <X size={18} />
                  </button>
                </header>

                {englishPicker.status === 'loading' && <p className="picker-status">Preparing English options...</p>}

                {englishPicker.error && (
                  <p className="notice error" role="alert">
                    {englishPicker.error}
                  </p>
                )}

                {englishPicker.conversion && (
                  <>
                    <div className="english-segments">
                      {englishPicker.conversion.segments.map((segment, segmentIndex) => (
                        <fieldset className="english-segment" key={`${segment.original}-${segmentIndex}`}>
                          <legend className="visually-hidden">English option group {segmentIndex + 1}</legend>
                          {segment.options.map((option, optionIndex) => (
                            <label className="english-option" key={option}>
                              <input
                                type="radio"
                                name={`english-segment-${segmentIndex}`}
                                checked={(englishPicker.selections[segmentIndex] ?? 0) === optionIndex}
                                onChange={() => updateEnglishSelection(segmentIndex, optionIndex)}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </fieldset>
                      ))}
                    </div>

                    <div className="english-preview">
                      <p className="eyebrow">
                        {englishPicker.source.type === 'draft' ? 'Draft preview' : 'English preview'}
                      </p>
                      <p>{getAssembledEnglishText(englishPicker)}</p>
                    </div>
                  </>
                )}

                <footer className="english-picker-actions">
                  <button className="text-button" type="button" onClick={() => setEnglishPicker(null)}>
                    Cancel
                  </button>
                  {englishPicker.source.type === 'message' ? (
                    <>
                      <button
                        className="text-button"
                        type="button"
                        disabled={!englishPicker.conversion || englishPickerIsSaving}
                        onClick={() => void saveEnglishResult('replace')}
                      >
                        {englishPicker.status === 'replacing' ? 'Replacing...' : 'Replace block'}
                      </button>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={!englishPicker.conversion || englishPickerIsSaving}
                        onClick={() => void saveEnglishResult('create')}
                      >
                        {englishPicker.status === 'creating' ? 'Creating...' : 'Create block'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={!englishPicker.conversion || englishPickerIsSaving}
                      onClick={() => void saveEnglishResult('draft')}
                    >
                      {englishPicker.status === 'using-draft' ? 'Updating...' : 'Use in draft'}
                    </button>
                  )}
                </footer>
              </section>
            </div>
          )}
        </>
      ) : (
        <div className="no-selection">
          <MoreVertical size={26} />
          <p>Select or create a conversation.</p>
        </div>
      )}
    </section>
  );
}
