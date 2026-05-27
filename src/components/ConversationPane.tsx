import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent
} from 'react';
import { ArrowLeft, Map as MapIcon, MoreVertical, X } from 'lucide-react';
import { EnglishPickerModal } from './EnglishPickerModal';
import { MessageDragPreview } from './MessageDragPreview';
import { MessageComposer } from './MessageComposer';
import { MessageBubble, type CopyFeedbackStatus } from './MessageBubble';
import { ReferencePickerModal, type ReferencePickerMode } from './ReferencePickerModal';
import { SelectionToolbar } from './SelectionToolbar';
import { useEnglishConversionPicker } from '../hooks/useEnglishConversionPicker';
import { useImagePreviews } from '../hooks/useImagePreviews';
import { useListReorderDrag } from '../hooks/useListReorderDrag';
import type { Conversation, EnglishConversion, Message, MessageReference } from '../types';
import type { DropPosition } from '../utils/dropTargets';
import { getImageFilesFromClipboardData } from '../utils/imageFiles';
import { downloadMessageAsMarkdown } from '../utils/messageDownload';
import { copyMessageToClipboard } from '../utils/messageClipboard';
import {
  appendUniqueReference,
  getBacklinksByMessageKey,
  getMessageReferenceKey,
  type MessageReferenceNavigationTarget
} from '../utils/messageReferences';
import { messageMatchesAnyTag, type TagSummary } from '../utils/tags';

type ConversationPaneProps = {
  activeConversation: Conversation | null;
  conversations: Conversation[];
  activeMessages: Message[];
  availableTags: TagSummary[];
  tagSuggestions: TagSummary[];
  selectedTags: string[];
  messagesByConversation: Record<string, Message[]>;
  navigationTarget: MessageReferenceNavigationTarget | null;
  moveNotice: { targetConversationId: string; targetConversationTitle: string } | null;
  draft: string;
  editingMessage: Message | null;
  onOpenMoveNotice: () => void;
  onDismissMoveNotice: () => void;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onSubmitMessage: (
    textOverride?: string,
    imageFiles?: File[],
    references?: MessageReference[],
    scheduledAt?: Date | null
  ) => void | Promise<void>;
  onCancelEdit: () => void;
  onEditMessage: (message: Message) => void;
  onSaveEdit: (
    message: Message,
    text: string,
    imageFiles?: File[],
    references?: MessageReference[],
    scheduledAt?: Date | null
  ) => void | Promise<void>;
  onForwardMessage: (message: Message) => void;
  onMoveToConversation: (message: Message) => void;
  onForwardMessages: (messages: Message[]) => void;
  onMoveMessages: (messages: Message[]) => void;
  onNavigateToReference: (target: MessageReferenceNavigationTarget) => void;
  onNavigationHandled: () => void;
  onDeleteMessage: (message: Message) => void;
  onDeleteMessages: (messages: Message[]) => void | Promise<void>;
  onMoveMessage: (messageIndex: number, direction: -1 | 1) => void;
  onReorderMessage: (draggedMessageId: string, targetMessageId: string, position: DropPosition) => void;
  onMergeMessages: (messages: Message[]) => Promise<void>;
  onSynthesizeIndex: (messages: Message[], conversationTitle: string) => Promise<void>;
  onConvertToEnglish: (text: string) => Promise<EnglishConversion>;
  onFormatEnglishText: (text: string) => Promise<string>;
  onCreateEnglishBlock: (message: Message, text: string) => Promise<void>;
  onReplaceWithEnglish: (message: Message, text: string) => Promise<void>;
  onUpdateMessageTags: (message: Message, tags: string[]) => void | Promise<void>;
  onUpdateMessageReferences: (message: Message, references: MessageReference[]) => void | Promise<void>;
};

const COPY_FEEDBACK_TIMEOUT_MS = 1600;
const SUPPRESS_SELECTION_CLICK_TIMEOUT_MS = 350;

type CopyFeedback = {
  messageId: string;
  status: CopyFeedbackStatus;
};

function findMessageElement(container: HTMLElement | null, messageId: string) {
  return (
    Array.from(container?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []).find(
      (element) => element.dataset.messageId === messageId
    ) ?? null
  );
}

export function ConversationPane({
  activeConversation,
  conversations,
  activeMessages,
  availableTags,
  tagSuggestions,
  selectedTags,
  messagesByConversation,
  navigationTarget,
  moveNotice,
  draft,
  editingMessage,
  onOpenMoveNotice,
  onDismissMoveNotice,
  onBack,
  onDraftChange,
  onToggleTag,
  onClearTags,
  onSubmitMessage,
  onCancelEdit,
  onEditMessage,
  onSaveEdit,
  onForwardMessage,
  onMoveToConversation,
  onForwardMessages,
  onMoveMessages,
  onNavigateToReference,
  onNavigationHandled,
  onDeleteMessage,
  onDeleteMessages,
  onMoveMessage,
  onReorderMessage,
  onMergeMessages,
  onSynthesizeIndex,
  onConvertToEnglish,
  onFormatEnglishText,
  onCreateEnglishBlock,
  onReplaceWithEnglish,
  onUpdateMessageTags,
  onUpdateMessageReferences
}: ConversationPaneProps) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const [clearComposerImagePreviewsSignal, setClearComposerImagePreviewsSignal] = useState(0);
  const [isMergeSelectionMode, setIsMergeSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [pendingReferences, setPendingReferences] = useState<MessageReference[]>([]);
  const [referencePickerMode, setReferencePickerMode] = useState<ReferencePickerMode | null>(null);
  const [connectionSourceMessage, setConnectionSourceMessage] = useState<Message | null>(null);
  const [activeReferenceTarget, setActiveReferenceTarget] = useState<MessageReferenceNavigationTarget | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isSynthesizingIndex, setIsSynthesizingIndex] = useState(false);
  const [isApplyingSelectedAction, setIsApplyingSelectedAction] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editReferences, setEditReferences] = useState<MessageReference[]>([]);
  const [editScheduledAt, setEditScheduledAt] = useState<Date | null>(null);
  const [draftScheduledAt, setDraftScheduledAt] = useState<Date | null>(null);
  const {
    imagePreviews: editImagePreviews,
    getImageFiles: getEditImageFiles,
    addImageFiles: addEditImageFiles,
    removeImage: removeEditImage,
    clearImagePreviews: clearEditImagePreviews
  } = useImagePreviews();
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionAnchorRef = useRef<{ messageId: string; top: number } | null>(null);
  const suppressNextSelectionClickRef = useRef(false);
  const suppressSelectionClickTimeoutRef = useRef<number | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const previousAutoScrollStateRef = useRef<{
    conversationId: string | null;
    visibleMessageCount: number;
    lastVisibleMessageId: string | null;
  } | null>(null);
  const isTagFilterActive = selectedTags.length > 0;
  const visibleMessages = useMemo(
    () => (isTagFilterActive ? activeMessages.filter((message) => messageMatchesAnyTag(message, selectedTags)) : activeMessages),
    [activeMessages, isTagFilterActive, selectedTags]
  );
  const {
    draggedItemId: draggedMessageId,
    dropTarget: messageDropTarget,
    dragPreview,
    handleItemDragStart: handleMessageDragStart,
    handleItemDragOver: handleMessageDragOver,
    handleItemDragLeave: handleMessageDragLeave,
    handleItemDrop: handleMessageDrop,
    handleItemDragEnd: handleMessageDragEnd,
    handleContainerDragOver: handleMessagesDragOver,
    handleContainerDrop: handleMessagesDrop,
    handleItemPointerDown: handleMessagePointerDown,
    handleItemPointerMove: handleMessagePointerMove,
    handleItemPointerUp: handleMessagePointerUp,
    handleItemPointerCancel: handleMessagePointerCancel
  } = useListReorderDrag({
    containerRef: messagesRef,
    itemSelector: '[data-message-id]',
    getItemId: (element) => element.dataset.messageId,
    itemCount: visibleMessages.length,
    onReorder: onReorderMessage
  });
  const {
    englishPicker,
    isSaving: englishPickerIsSaving,
    closePicker: closeEnglishPicker,
    openMessagePicker: openMessageEnglishPicker,
    openDraftPicker: openDraftEnglishPicker,
    updateSelection: updateEnglishSelection,
    saveResult: saveEnglishResult
  } = useEnglishConversionPicker({
    draft,
    pendingReferences,
    draftScheduledAt,
    onConvertToEnglish,
    onFormatEnglishText,
    onSubmitMessage,
    onCreateEnglishBlock,
    onReplaceWithEnglish,
    onDraftEnglishSent: () => {
      setPendingReferences([]);
      setDraftScheduledAt(null);
      setClearComposerImagePreviewsSignal((signal) => signal + 1);
    }
  });

  const selectedMessages = visibleMessages.filter((message) => selectedMessageIds.includes(message.id));
  const draggedMessage = dragPreview
    ? visibleMessages.find((message) => message.id === dragPreview.itemId) ?? null
    : null;
  const backlinksByMessageKey = useMemo(
    () => getBacklinksByMessageKey(conversations, messagesByConversation),
    [conversations, messagesByConversation]
  );

  function getConversationTitle(conversationId: string | null) {
    if (!conversationId) return null;
    return conversations.find((conversation) => conversation.id === conversationId)?.title ?? null;
  }

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
    return () => {
      if (suppressSelectionClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressSelectionClickTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const activeMessageIds = new Set(visibleMessages.map((message) => message.id));
    setSelectedMessageIds((currentIds) => {
      const nextIds = currentIds.filter((messageId) => activeMessageIds.has(messageId));
      return nextIds.length === currentIds.length ? currentIds : nextIds;
    });
  }, [activeConversation?.id, visibleMessages]);

  useEffect(() => {
    setIsMergeSelectionMode(false);
    setSelectedMessageIds([]);
    setMergeError(null);
    setSynthesisError(null);
    setConnectionSourceMessage(null);
    setReferencePickerMode(null);
  }, [activeConversation?.id]);

  useEffect(() => {
    setEditText(editingMessage?.text ?? '');
    setEditReferences(editingMessage?.references ?? []);
    setEditScheduledAt(editingMessage?.scheduledAt?.toDate?.() ?? null);
    clearEditImagePreviews();
    setIsSavingEdit(false);
  }, [clearEditImagePreviews, editingMessage?.id, editingMessage?.references, editingMessage?.scheduledAt, editingMessage?.text]);

  useLayoutEffect(() => {
    const textarea = editTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editText, editingMessage?.id]);

  useLayoutEffect(() => {
    const conversationId = activeConversation?.id ?? null;
    const lastVisibleMessageId = visibleMessages.at(-1)?.id ?? null;
    const previousState = previousAutoScrollStateRef.current;

    previousAutoScrollStateRef.current = {
      conversationId,
      visibleMessageCount: visibleMessages.length,
      lastVisibleMessageId
    };

    if (!conversationId || !lastVisibleMessageId) return;

    const isEnteringConversation = previousState?.conversationId !== conversationId;
    const isAppendingVisibleMessage =
      previousState?.conversationId === conversationId &&
      visibleMessages.length > previousState.visibleMessageCount &&
      lastVisibleMessageId !== previousState.lastVisibleMessageId;

    if (!isEnteringConversation && !isAppendingVisibleMessage) return;

    findMessageElement(messagesRef.current, lastVisibleMessageId)?.scrollIntoView?.({ block: 'end' });
  }, [activeConversation?.id, visibleMessages]);

  useLayoutEffect(() => {
    const anchor = selectionAnchorRef.current;
    const messagesElement = messagesRef.current;
    if (!anchor || !messagesElement) return;

    const anchoredElement = findMessageElement(messagesElement, anchor.messageId);
    if (!anchoredElement) {
      selectionAnchorRef.current = null;
      return;
    }

    const nextTop = anchoredElement.getBoundingClientRect().top;
    messagesElement.scrollTop += nextTop - anchor.top;
    selectionAnchorRef.current = null;
  }, [isMergeSelectionMode]);

  useEffect(() => {
    if (!navigationTarget || navigationTarget.conversationId !== activeConversation?.id) return undefined;
    const targetElement = navigationTarget.messageId
      ? Array.from(messagesRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []).find(
          (element) => element.dataset.messageId === navigationTarget.messageId
        ) ?? null
      : null;

    if (targetElement) {
      targetElement.scrollIntoView?.({ block: 'center' });
      setActiveReferenceTarget(navigationTarget);
      const timeoutId = window.setTimeout(() => {
        setActiveReferenceTarget(null);
      }, 2400);
      onNavigationHandled();
      return () => window.clearTimeout(timeoutId);
    }

    onNavigationHandled();
    return undefined;
  }, [activeConversation?.id, navigationTarget, onNavigationHandled]);

  function clearSuppressedSelectionClick() {
    suppressNextSelectionClickRef.current = false;
    if (suppressSelectionClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressSelectionClickTimeoutRef.current);
      suppressSelectionClickTimeoutRef.current = null;
    }
  }

  function suppressNextSelectionClick() {
    suppressNextSelectionClickRef.current = true;
    if (suppressSelectionClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressSelectionClickTimeoutRef.current);
    }
    suppressSelectionClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextSelectionClickRef.current = false;
      suppressSelectionClickTimeoutRef.current = null;
    }, SUPPRESS_SELECTION_CLICK_TIMEOUT_MS);
  }

  function toggleMessageSelection(messageId: string) {
    if (!isMergeSelectionMode) return;
    if (suppressNextSelectionClickRef.current) {
      clearSuppressedSelectionClick();
      return;
    }
    setMergeError(null);
    setSelectedMessageIds((currentIds) => {
      const nextIds = currentIds.includes(messageId)
        ? currentIds.filter((currentId) => currentId !== messageId)
        : [...currentIds, messageId];

      if (nextIds.length === 0) {
        setIsMergeSelectionMode(false);
        setMergeError(null);
      }

      return nextIds;
    });
  }

  function startMergeSelection(messageId: string, options?: { suppressNextClick?: boolean }) {
    const messageElement = findMessageElement(messagesRef.current, messageId);
    if (messageElement) {
      selectionAnchorRef.current = {
        messageId,
        top: messageElement.getBoundingClientRect().top
      };
    }
    if (options?.suppressNextClick) {
      suppressNextSelectionClick();
    }
    setIsMergeSelectionMode(true);
    setMergeError(null);
    setSelectedMessageIds((currentIds) => (currentIds.includes(messageId) ? currentIds : [...currentIds, messageId]));
  }

  function cancelMergeSelection() {
    setIsMergeSelectionMode(false);
    setSelectedMessageIds([]);
    setMergeError(null);
  }

  async function mergeSelectedMessages() {
    if (selectedMessages.length < 2) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      await onMergeMessages(selectedMessages);
      setSelectedMessageIds([]);
      setIsMergeSelectionMode(false);
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Unable to merge the selected blocks.');
    } finally {
      setIsMerging(false);
    }
  }

  async function copySelectedMessagesText() {
    const selectedText = selectedMessages.map((message) => message.text.trim()).filter(Boolean).join('\n\n');
    if (!selectedText) {
      setMergeError('The selected blocks have no text to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedText);
      setMergeError(null);
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Unable to copy the selected text.');
    }
  }

  async function deleteSelectedMessages() {
    if (selectedMessages.length === 0 || isApplyingSelectedAction) return;
    setIsApplyingSelectedAction(true);
    setMergeError(null);
    try {
      await onDeleteMessages(selectedMessages);
      cancelMergeSelection();
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Unable to delete the selected blocks.');
    } finally {
      setIsApplyingSelectedAction(false);
    }
  }

  function forwardSelectedMessages() {
    if (selectedMessages.length === 0) return;
    if (selectedMessages.length === 1) {
      onForwardMessage(selectedMessages[0]);
      return;
    }
    onForwardMessages(selectedMessages);
  }

  function moveSelectedMessages() {
    if (selectedMessages.length === 0) return;
    if (selectedMessages.length === 1) {
      onMoveToConversation(selectedMessages[0]);
      return;
    }
    onMoveMessages(selectedMessages);
  }

  async function copyMessageText(message: Message) {
    try {
      await copyMessageToClipboard(message);
      setCopyFeedback({ messageId: message.id, status: 'copied' });
    } catch (error) {
      console.error('Unable to copy message text.', error);
      setCopyFeedback({ messageId: message.id, status: 'failed' });
    }
  }

  function downloadMessageText(message: Message) {
    try {
      downloadMessageAsMarkdown(message, activeConversation);
    } catch (error) {
      console.error('Unable to download message text.', error);
      setCopyFeedback({ messageId: message.id, status: 'failed' });
    }
  }

  async function saveInlineEdit(message: Message) {
    if (
      (!editText.trim() &&
        (message.attachments?.length ?? 0) === 0 &&
        editImagePreviews.length === 0 &&
        editReferences.length === 0) ||
      isSavingEdit
    ) {
      return;
    }
    setIsSavingEdit(true);
    try {
      await onSaveEdit(message, editText, getEditImageFiles(), editReferences, editScheduledAt);
      clearEditImagePreviews();
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function submitComposerMessage(imageFiles: File[], scheduledAt: Date | null) {
    const referencesToSubmit = pendingReferences;
    const scheduledAtToSubmit = scheduledAt;

    if (imageFiles.length === 0) {
      setPendingReferences([]);
      setDraftScheduledAt(null);
    }

    try {
      await onSubmitMessage(undefined, imageFiles, referencesToSubmit, scheduledAtToSubmit);
      if (imageFiles.length > 0) {
        setPendingReferences([]);
        setDraftScheduledAt(null);
      }
    } catch (error) {
      if (imageFiles.length === 0) {
        setPendingReferences(referencesToSubmit);
        setDraftScheduledAt(scheduledAtToSubmit);
      }
      throw error;
    }
  }

  function openReferencePicker(mode: ReferencePickerMode) {
    setConnectionSourceMessage(null);
    setReferencePickerMode(mode);
  }

  function openConnectionPicker(message: Message) {
    setConnectionSourceMessage(message);
    setReferencePickerMode('connection');
  }

  function closeReferencePicker() {
    setReferencePickerMode(null);
    setConnectionSourceMessage(null);
  }

  function addPendingReferences(references: MessageReference[]) {
    setPendingReferences((current) => [...current, ...references]);
    closeReferencePicker();
  }

  async function addSavedConnections(references: MessageReference[]) {
    if (!connectionSourceMessage) return;
    const nextReferences = references.reduce(
      (currentReferences, reference) => appendUniqueReference(currentReferences, reference),
      connectionSourceMessage.references ?? []
    );
    await onUpdateMessageReferences(connectionSourceMessage, nextReferences);
    closeReferencePicker();
  }

  function canNavigateToReference(reference: MessageReference) {
    if (!conversations.some((conversation) => conversation.id === reference.sourceConversationId)) return false;
    if (reference.type === 'conversation') return true;
    return Boolean(
      messagesByConversation[reference.sourceConversationId]?.some((message) => message.id === reference.sourceMessageId)
    );
  }

  function canNavigateToMessage(messageId: string) {
    return activeMessages.some((message) => message.id === messageId);
  }

  async function synthesizeConversationIndex() {
    if (!activeConversation || activeMessages.length === 0 || isSynthesizingIndex) return;
    setIsSynthesizingIndex(true);
    setSynthesisError(null);
    try {
      await onSynthesizeIndex(activeMessages, activeConversation.title);
    } catch (error) {
      setSynthesisError(error instanceof Error ? error.message : 'Unable to synthesize a conversation index.');
    } finally {
      setIsSynthesizingIndex(false);
    }
  }

  function handleEditImagePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = getImageFilesFromClipboardData(event.clipboardData);
    if (imageFiles.length === 0) return;

    event.preventDefault();
    addEditImageFiles(imageFiles);
  }

  const selectionToolbar = isMergeSelectionMode ? (
    <SelectionToolbar
      selectedCount={selectedMessages.length}
      error={mergeError}
      isMerging={isMerging}
      isApplyingAction={isApplyingSelectedAction}
      onCancel={cancelMergeSelection}
      onMerge={() => void mergeSelectedMessages()}
      onForward={forwardSelectedMessages}
      onMove={moveSelectedMessages}
      onCopyText={() => void copySelectedMessagesText()}
      onDelete={() => void deleteSelectedMessages()}
    />
  ) : null;

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
              {(isSynthesizingIndex || synthesisError) && (
                <p className={synthesisError ? 'conversation-status error' : 'conversation-status'} role={synthesisError ? 'alert' : 'status'}>
                  {synthesisError ?? 'Synthesizing conversation index...'}
                </p>
              )}
            </div>
            <div className="conversation-header-actions">
              <button
                className="icon-button"
                type="button"
                title="Synthesize conversation index"
                disabled={activeMessages.length === 0 || isSynthesizingIndex}
                onClick={() => void synthesizeConversationIndex()}
              >
                <MapIcon size={18} />
              </button>
            </div>
          </header>

          {availableTags.length > 0 && (
            <div className="conversation-tag-filter" aria-label="Filter conversation by tag">
              <span>Tags</span>
              {availableTags.map((tag) => (
                <button
                  key={tag.name}
                  className={selectedTags.includes(tag.name) ? 'tag-filter-chip active' : 'tag-filter-chip'}
                  type="button"
                  onClick={() => onToggleTag(tag.name)}
                >
                  {tag.name}
                  <span>{tag.count}</span>
                </button>
              ))}
              {isTagFilterActive && (
                <button className="text-button compact" type="button" onClick={onClearTags}>
                  Clear
                </button>
              )}
            </div>
          )}

          <div
            className="messages"
            ref={messagesRef}
            onDragOver={handleMessagesDragOver}
            onDrop={handleMessagesDrop}
          >
            {visibleMessages.map((message, messageIndex) => (
              <Fragment key={message.id}>
                {messageDropTarget?.itemId === message.id && messageDropTarget.position === 'before' && (
                  <div className="message-drop-indicator" aria-hidden="true" />
                )}
                <MessageBubble
                  message={message}
                  conversations={conversations}
                  messageIndex={messageIndex}
                  messageCount={activeMessages.length}
                  isReorderDisabled={isTagFilterActive}
                  isSelectionMode={isMergeSelectionMode}
                  isSelected={selectedMessageIds.includes(message.id)}
                  isDragging={draggedMessageId === message.id}
                  isDragOver={false}
                  isEditing={editingMessage?.id === message.id}
                  editText={editText}
                  editReferences={editReferences}
                  editScheduledAt={editScheduledAt}
                  editImagePreviews={editImagePreviews}
                  activeReferenceTarget={activeReferenceTarget}
                  isSavingEdit={isSavingEdit}
                  editTextareaRef={editTextareaRef}
                  copyFeedbackStatus={copyFeedback?.messageId === message.id ? copyFeedback.status : null}
                  sourceConversationTitle={
                    message.forwardedFromConversationTitle ?? getConversationTitle(message.forwardedFromConversationId)
                  }
                  backlinks={backlinksByMessageKey[getMessageReferenceKey(message.conversationId, message.id)] ?? []}
                  onSelect={toggleMessageSelection}
                  onStartSelection={startMergeSelection}
                  onNavigateToReference={onNavigateToReference}
                  onNavigateToConversation={(conversationId) => onNavigateToReference({ conversationId })}
                  canNavigateToReference={canNavigateToReference}
                  onNavigateToMessage={(messageId) =>
                    onNavigateToReference({ conversationId: message.conversationId, messageId })
                  }
                  canNavigateToMessage={canNavigateToMessage}
                  onCancelEdit={onCancelEdit}
                  onEditTextChange={setEditText}
                  onEditScheduledAtChange={setEditScheduledAt}
                  onRemoveEditReference={(referenceId) =>
                    setEditReferences((current) => current.filter((reference) => reference.id !== referenceId))
                  }
                  onEditImagePaste={handleEditImagePaste}
                  onRemoveEditImage={removeEditImage}
                  onSaveEdit={(messageToSave) => void saveInlineEdit(messageToSave)}
                  onEditMessage={onEditMessage}
                  onCopyMessage={(messageToCopy) => void copyMessageText(messageToCopy)}
                  onDownloadMessage={downloadMessageText}
                  onConnectMessage={openConnectionPicker}
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
                  onUpdateTags={onUpdateMessageTags}
                  tagSuggestions={tagSuggestions}
                />
                {messageDropTarget?.itemId === message.id && messageDropTarget.position === 'after' && (
                  <div className="message-drop-indicator" aria-hidden="true" />
                )}
              </Fragment>
            ))}
            {activeMessages.length === 0 && <p className="empty-state">Write the first message here.</p>}
            {activeMessages.length > 0 && visibleMessages.length === 0 && (
              <p className="empty-state">No blocks match those tags.</p>
            )}
          </div>

          {dragPreview && draggedMessage && (
            <MessageDragPreview
              message={draggedMessage}
              x={dragPreview.x}
              y={dragPreview.y}
              width={dragPreview.width}
            />
          )}

          {selectionToolbar}

          {moveNotice && (
            <div className="move-notice" role="status">
              <span>Moved to {moveNotice.targetConversationTitle}</span>
              <button className="text-button" type="button" onClick={onOpenMoveNotice}>
                Open
              </button>
              <button className="icon-button bare" type="button" title="Dismiss move notice" onClick={onDismissMoveNotice}>
                <X size={16} />
              </button>
            </div>
          )}

          {!isMergeSelectionMode && (
            <MessageComposer
              draft={draft}
              conversations={conversations}
              pendingReferences={pendingReferences}
              scheduledAt={draftScheduledAt}
              onDraftChange={onDraftChange}
              onScheduledAtChange={setDraftScheduledAt}
              onSubmitMessage={(imageFiles, scheduledAt) => void submitComposerMessage(imageFiles, scheduledAt)}
              onConvertDraftToEnglish={(imageFiles) => void openDraftEnglishPicker(imageFiles)}
              clearImagePreviewsSignal={clearComposerImagePreviewsSignal}
              onAddConversationReference={() => openReferencePicker('conversation')}
              onAddQuoteReference={() => openReferencePicker('quote')}
              onRemoveReference={(referenceId) =>
                setPendingReferences((current) => current.filter((reference) => reference.id !== referenceId))
              }
            />
          )}

          {englishPicker && (
            <EnglishPickerModal
              state={englishPicker}
              isSaving={englishPickerIsSaving}
              onClose={closeEnglishPicker}
              onSelectionChange={updateEnglishSelection}
              onSave={(action) => void saveEnglishResult(action)}
            />
          )}

          {referencePickerMode && (
            <ReferencePickerModal
              mode={referencePickerMode}
              activeConversation={activeConversation}
              sourceMessage={connectionSourceMessage}
              conversations={conversations}
              messagesByConversation={messagesByConversation}
              onAddReferences={(references) =>
                referencePickerMode === 'connection'
                  ? void addSavedConnections(references)
                  : addPendingReferences(references)
              }
              onClose={closeReferencePicker}
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
