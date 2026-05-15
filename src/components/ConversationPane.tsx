import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { ArrowLeft, Combine, Languages, MoreVertical, Send } from 'lucide-react';
import { EnglishPickerModal, type EnglishPickerState } from './EnglishPickerModal';
import { MessageBubble, type CopyFeedbackStatus } from './MessageBubble';
import type { Conversation, EnglishConversion, Message } from '../types';
import { assembleEnglishText } from '../utils/englishConversion';

type ConversationPaneProps = {
  activeConversation: Conversation | null;
  activeMessages: Message[];
  draft: string;
  editingMessage: Message | null;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onSubmitMessage: (textOverride?: string) => void | Promise<void>;
  onCancelEdit: () => void;
  onEditMessage: (message: Message) => void;
  onSaveEdit: (message: Message, text: string) => void | Promise<void>;
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
  status: CopyFeedbackStatus;
};

type TouchDragState = {
  messageId: string;
  pointerId: number;
  startX: number;
  startY: number;
  isDragging: boolean;
};

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
  onSaveEdit,
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
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  useEffect(() => {
    setEditText(editingMessage?.text ?? '');
    setIsSavingEdit(false);
  }, [editingMessage?.id, editingMessage?.text]);

  useLayoutEffect(() => {
    const textarea = editTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editText, editingMessage?.id]);

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
    const isSameMessage = draggedMessageId === messageId;
    if (isSameMessage) return;
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

  function handleMessagePointerCancel(event: PointerEvent<HTMLElement>) {
    if (touchDrag.current?.pointerId === event.pointerId) clearTouchDrag();
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

  async function saveInlineEdit(message: Message) {
    if (!editText.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await onSaveEdit(message, editText);
    } finally {
      setIsSavingEdit(false);
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

  async function saveEnglishResult(action: 'create' | 'replace' | 'draft') {
    if (!englishPicker || !englishPicker.conversion) return;
    const englishText = assembleEnglishText(englishPicker.conversion, englishPicker.selections);
    if (!englishText) return;

    const nextStatus =
      action === 'create' ? 'creating' : action === 'replace' ? 'replacing' : 'sending-draft';
    setEnglishPicker({ ...englishPicker, status: nextStatus, error: null });
    try {
      if (action === 'draft') {
        await onSubmitMessage(englishText);
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
    englishPicker?.status === 'sending-draft';

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
            {activeMessages.map((message, messageIndex) => (
              <MessageBubble
                key={message.id}
                message={message}
                messageIndex={messageIndex}
                messageCount={activeMessages.length}
                isSelected={selectedMessageIds.includes(message.id)}
                isDragging={draggedMessageId === message.id}
                isDragOver={dragOverMessageId === message.id}
                isEditing={editingMessage?.id === message.id}
                editText={editText}
                isSavingEdit={isSavingEdit}
                editTextareaRef={editTextareaRef}
                copyFeedbackStatus={copyFeedback?.messageId === message.id ? copyFeedback.status : null}
                onSelect={toggleMessageSelection}
                onNavigateToSource={onNavigateToSource}
                onCancelEdit={onCancelEdit}
                onEditTextChange={setEditText}
                onSaveEdit={(messageToSave) => void saveInlineEdit(messageToSave)}
                onEditMessage={onEditMessage}
                onCopyMessage={(messageToCopy) => void copyMessageText(messageToCopy)}
                onConvertToEnglish={(messageToConvert) => void openMessageEnglishPicker(messageToConvert)}
                onForwardMessage={onForwardMessage}
                onMoveToConversation={onMoveToConversation}
                onDeleteMessage={onDeleteMessage}
                onMoveMessage={onMoveMessage}
                onDragStart={handleMessageDragStart}
                onDragOver={handleMessageDragOver}
                onDragLeave={handleMessageDragLeave}
                onDrop={handleMessageDrop}
                onDragEnd={handleMessageDragEnd}
                onPointerDown={handleMessagePointerDown}
                onPointerMove={handleMessagePointerMove}
                onPointerUp={handleMessagePointerUp}
                onPointerCancel={handleMessagePointerCancel}
              />
            ))}
            {activeMessages.length === 0 && <p className="empty-state">Write the first message here.</p>}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitMessage();
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void openDraftEnglishPicker();
                }
              }}
              placeholder="Write a message"
              rows={2}
            />
            <div className="composer-actions">
              <button
                className="icon-button"
                type="button"
                title="Convert draft to English"
                disabled={!draft.trim()}
                onClick={() => void openDraftEnglishPicker()}
              >
                <Languages size={17} />
              </button>
              <button className="primary-button send-button" disabled={!draft.trim()}>
                <Send size={16} />
                Send
              </button>
            </div>
          </form>

          {englishPicker && (
            <EnglishPickerModal
              state={englishPicker}
              isSaving={englishPickerIsSaving}
              onClose={() => setEnglishPicker(null)}
              onSelectionChange={updateEnglishSelection}
              onSave={(action) => void saveEnglishResult(action)}
            />
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
