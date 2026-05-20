import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type PointerEvent
} from 'react';
import { ArrowLeft, Map as MapIcon, MoreVertical, X } from 'lucide-react';
import { EnglishPickerModal, type EnglishPickerState } from './EnglishPickerModal';
import { MessageDragPreview } from './MessageDragPreview';
import { MessageComposer } from './MessageComposer';
import { MessageBubble, type CopyFeedbackStatus } from './MessageBubble';
import { ReferencePickerModal, type ReferencePickerMode } from './ReferencePickerModal';
import { SelectionToolbar } from './SelectionToolbar';
import type { Conversation, EnglishConversion, Message, MessageReference } from '../types';
import { resolveNearestDropTarget, type DropPosition, type DropTargetCandidate } from '../utils/dropTargets';
import { assembleEnglishText } from '../utils/englishConversion';
import { copyMessageToClipboard } from '../utils/messageClipboard';
import type { MessageReferenceNavigationTarget } from '../utils/messageReferences';

type ConversationPaneProps = {
  activeConversation: Conversation | null;
  conversations: Conversation[];
  activeMessages: Message[];
  messagesByConversation: Record<string, Message[]>;
  navigationTarget: MessageReferenceNavigationTarget | null;
  moveNotice: { targetConversationId: string; targetConversationTitle: string } | null;
  draft: string;
  editingMessage: Message | null;
  onOpenMoveNotice: () => void;
  onDismissMoveNotice: () => void;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onSubmitMessage: (textOverride?: string, imageFiles?: File[], references?: MessageReference[]) => void | Promise<void>;
  onCancelEdit: () => void;
  onEditMessage: (message: Message) => void;
  onSaveEdit: (message: Message, text: string, imageFiles?: File[], references?: MessageReference[]) => void | Promise<void>;
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
  onCreateEnglishBlock: (message: Message, text: string) => Promise<void>;
  onReplaceWithEnglish: (message: Message, text: string) => Promise<void>;
};

const COPY_FEEDBACK_TIMEOUT_MS = 1600;
const DRAG_AUTOSCROLL_EDGE_PX = 72;
const DRAG_AUTOSCROLL_MAX_PX = 18;

type MessageDropTarget = {
  messageId: string;
  position: DropPosition;
};

type CopyFeedback = {
  messageId: string;
  status: CopyFeedbackStatus;
};

type TouchDragState = {
  messageId: string;
  pointerId: number;
};

type DragPreview = {
  messageId: string;
  x: number;
  y: number;
  width: number;
};

type EditImagePreview = {
  id: string;
  file: File;
  url: string;
};

function createPreviewId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function findMessageElement(container: HTMLElement | null, messageId: string) {
  return (
    Array.from(container?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []).find(
      (element) => element.dataset.messageId === messageId
    ) ?? null
  );
}

function getImageFilesFromClipboardData(clipboardData: DataTransfer) {
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (itemFiles.length > 0) return itemFiles;
  return Array.from(clipboardData.files).filter((file) => file.type.startsWith('image/'));
}

export function ConversationPane({
  activeConversation,
  conversations,
  activeMessages,
  messagesByConversation,
  navigationTarget,
  moveNotice,
  draft,
  editingMessage,
  onOpenMoveNotice,
  onDismissMoveNotice,
  onBack,
  onDraftChange,
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
  onCreateEnglishBlock,
  onReplaceWithEnglish
}: ConversationPaneProps) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const [englishPicker, setEnglishPicker] = useState<EnglishPickerState | null>(null);
  const [clearComposerImagePreviewsSignal, setClearComposerImagePreviewsSignal] = useState(0);
  const [isMergeSelectionMode, setIsMergeSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [pendingReferences, setPendingReferences] = useState<MessageReference[]>([]);
  const [referencePickerMode, setReferencePickerMode] = useState<ReferencePickerMode | null>(null);
  const [activeReferenceTarget, setActiveReferenceTarget] = useState<MessageReferenceNavigationTarget | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isSynthesizingIndex, setIsSynthesizingIndex] = useState(false);
  const [isApplyingSelectedAction, setIsApplyingSelectedAction] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null);
  const [messageDropTarget, setMessageDropTarget] = useState<MessageDropTarget | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [editText, setEditText] = useState('');
  const [editReferences, setEditReferences] = useState<MessageReference[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<EditImagePreview[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editImagePreviewsRef = useRef<EditImagePreview[]>([]);
  const selectionAnchorRef = useRef<{ messageId: string; top: number } | null>(null);
  const touchDrag = useRef<TouchDragState | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const dragAutoScroll = useRef<{ speedY: number; animationId: number | null }>({
    speedY: 0,
    animationId: null
  });

  const selectedMessages = activeMessages.filter((message) => selectedMessageIds.includes(message.id));
  const draggedMessage = dragPreview
    ? activeMessages.find((message) => message.id === dragPreview.messageId) ?? null
    : null;

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
    const activeMessageIds = new Set(activeMessages.map((message) => message.id));
    setSelectedMessageIds((currentIds) => {
      const nextIds = currentIds.filter((messageId) => activeMessageIds.has(messageId));
      return nextIds.length === currentIds.length ? currentIds : nextIds;
    });
  }, [activeConversation?.id, activeMessages]);

  useEffect(() => {
    setIsMergeSelectionMode(false);
    setSelectedMessageIds([]);
    setMergeError(null);
    setSynthesisError(null);
  }, [activeConversation?.id]);

  useEffect(() => {
    setEditText(editingMessage?.text ?? '');
    setEditReferences(editingMessage?.references ?? []);
    setEditImagePreviews((currentPreviews) => {
      currentPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
      return [];
    });
    setIsSavingEdit(false);
  }, [editingMessage?.id, editingMessage?.text]);

  useEffect(() => {
    editImagePreviewsRef.current = editImagePreviews;
  }, [editImagePreviews]);

  useEffect(() => {
    return () => {
      editImagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, []);

  useLayoutEffect(() => {
    const textarea = editTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editText, editingMessage?.id]);

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
    if (!draggedMessageId) return undefined;

    function handleWindowDragOver(event: globalThis.DragEvent) {
      updateDragAutoScroll(event.clientY);
      updateDragPreview(event.clientX, event.clientY);
    }

    window.addEventListener('dragover', handleWindowDragOver);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      stopDragAutoScroll();
    };
  }, [draggedMessageId]);

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

  function toggleMessageSelection(messageId: string) {
    if (!isMergeSelectionMode) return;
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

  function startMergeSelection(messageId: string) {
    const messageElement = findMessageElement(messagesRef.current, messageId);
    if (messageElement) {
      selectionAnchorRef.current = {
        messageId,
        top: messageElement.getBoundingClientRect().top
      };
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

  function handleMessageDragStart(event: DragEvent<HTMLElement>, messageId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', messageId);
    const messageElement = event.currentTarget.closest<HTMLElement>('[data-message-id]');
    const rect = messageElement?.getBoundingClientRect();
    if (rect) {
      setDragPreview({
        messageId,
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
    setDraggedMessageId(messageId);
    updateDragAutoScroll(event.clientY);
  }

  function handleMessageDragOver(event: DragEvent<HTMLElement>, messageId: string) {
    const isSameMessage = draggedMessageId === messageId;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    updateDragAutoScroll(event.clientY);
    updateDragPreview(event.clientX, event.clientY);
    setMessageDropTarget(
      isSameMessage
        ? getNearestMessageDropTarget(event.clientY, messageId)
        : getMessageDropTarget(event.currentTarget, messageId, event.clientY, draggedMessageId)
    );
  }

  function handleMessageDragLeave(event: DragEvent<HTMLElement>, messageId: string) {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setMessageDropTarget((currentTarget) => (currentTarget?.messageId === messageId ? null : currentTarget));
  }

  function handleMessageDrop(event: DragEvent<HTMLElement>, targetMessageId: string) {
    event.preventDefault();
    event.stopPropagation();
    const droppedMessageId = event.dataTransfer.getData('text/plain') || draggedMessageId;
    const dropPosition = getMessageDropPosition(event.currentTarget, event.clientY);
    stopDragAutoScroll();
    setDraggedMessageId(null);
    setMessageDropTarget(null);
    setDragPreview(null);
    if (!droppedMessageId || droppedMessageId === targetMessageId) return;
    onReorderMessage(droppedMessageId, targetMessageId, dropPosition);
  }

  function handleMessagesDragOver(event: DragEvent<HTMLDivElement>) {
    if (!draggedMessageId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    updateDragAutoScroll(event.clientY);
    updateDragPreview(event.clientX, event.clientY);
    setMessageDropTarget(getNearestMessageDropTarget(event.clientY, draggedMessageId));
  }

  function handleMessagesDrop(event: DragEvent<HTMLDivElement>) {
    if (!draggedMessageId) return;
    event.preventDefault();
    const droppedMessageId = event.dataTransfer.getData('text/plain') || draggedMessageId;
    const dropTarget = getNearestMessageDropTarget(event.clientY, droppedMessageId);
    stopDragAutoScroll();
    setDraggedMessageId(null);
    setMessageDropTarget(null);
    setDragPreview(null);
    if (dropTarget) onReorderMessage(droppedMessageId, dropTarget.messageId, dropTarget.position);
  }

  function handleMessageDragEnd() {
    stopDragAutoScroll();
    setDraggedMessageId(null);
    setMessageDropTarget(null);
    setDragPreview(null);
  }

  function stopDragAutoScroll() {
    const currentAutoScroll = dragAutoScroll.current;
    if (currentAutoScroll.animationId !== null) {
      window.cancelAnimationFrame(currentAutoScroll.animationId);
    }
    dragAutoScroll.current = { speedY: 0, animationId: null };
  }

  function runDragAutoScroll() {
    const container = messagesRef.current;
    const currentAutoScroll = dragAutoScroll.current;
    if (!container || currentAutoScroll.speedY === 0) {
      stopDragAutoScroll();
      return;
    }

    container.scrollBy({ top: currentAutoScroll.speedY });
    currentAutoScroll.animationId = window.requestAnimationFrame(runDragAutoScroll);
  }

  function updateDragAutoScroll(clientY: number) {
    const container = messagesRef.current;
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

  function getMessageDropPosition(messageElement: HTMLElement, clientY: number): DropPosition {
    const rect = messageElement.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  function getMessageDropTarget(
    messageElement: HTMLElement,
    messageId: string,
    clientY: number,
    currentDraggedMessageId: string | null
  ) {
    if (currentDraggedMessageId === messageId) return null;
    return {
      messageId,
      position: getMessageDropPosition(messageElement, clientY)
    };
  }

  function getMessageElements() {
    return Array.from(messagesRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? []).filter(
      (element) => element.dataset.messageId
    );
  }

  function getNearestMessageDropTarget(clientY: number, currentDraggedMessageId: string | null): MessageDropTarget | null {
    const candidates = getMessageElements().reduce<DropTargetCandidate[]>((currentCandidates, messageElement) => {
      const messageId = messageElement.dataset.messageId;
      if (!messageId) return currentCandidates;

      const rect = messageElement.getBoundingClientRect();
      currentCandidates.push({ id: messageId, top: rect.top, height: rect.height });
      return currentCandidates;
    }, []);
    const dropTarget = resolveNearestDropTarget(candidates, clientY, currentDraggedMessageId);
    return dropTarget ? { messageId: dropTarget.itemId, position: dropTarget.position } : null;
  }

  function findMessageDropTargetAtPoint(clientX: number, clientY: number, currentDraggedMessageId: string | null) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof Element)) return getNearestMessageDropTarget(clientY, currentDraggedMessageId);
    const messageElement = target.closest<HTMLElement>('[data-message-id]');
    const messageId = messageElement?.dataset.messageId;
    if (!messageElement || !messageId || currentDraggedMessageId === messageId) {
      return getNearestMessageDropTarget(clientY, currentDraggedMessageId);
    }
    return getMessageDropTarget(messageElement, messageId, clientY, currentDraggedMessageId);
  }

  function clearTouchDrag() {
    touchDrag.current = null;
    stopDragAutoScroll();
    setDraggedMessageId(null);
    setMessageDropTarget(null);
    setDragPreview(null);
  }

  function handleMessagePointerDown(event: PointerEvent<HTMLElement>, messageId: string) {
    if (activeMessages.length < 2) return;

    const messageElement = event.currentTarget.closest<HTMLElement>('[data-message-id]');
    const rect = messageElement?.getBoundingClientRect();
    const width = rect?.width ?? 280;

    touchDrag.current = {
      messageId,
      pointerId: event.pointerId
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggedMessageId(messageId);
    setDragPreview({
      messageId,
      x: event.clientX,
      y: event.clientY,
      width
    });
    updateDragAutoScroll(event.clientY);
  }

  function handleMessagePointerMove(event: PointerEvent<HTMLElement>) {
    const currentDrag = touchDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    event.preventDefault();

    updateDragAutoScroll(event.clientY);
    updateDragPreview(event.clientX, event.clientY);
    setMessageDropTarget(findMessageDropTargetAtPoint(event.clientX, event.clientY, currentDrag.messageId));
  }

  function handleMessagePointerUp(event: PointerEvent<HTMLElement>) {
    const currentDrag = touchDrag.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    const dropTarget = findMessageDropTargetAtPoint(event.clientX, event.clientY, currentDrag.messageId);
    clearTouchDrag();
    if (dropTarget) onReorderMessage(currentDrag.messageId, dropTarget.messageId, dropTarget.position);
  }

  function handleMessagePointerCancel(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse' && touchDrag.current?.pointerId === event.pointerId) clearTouchDrag();
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
      await onSaveEdit(message, editText, editImagePreviews.map((preview) => preview.file), editReferences);
      setEditImagePreviews((currentPreviews) => {
        currentPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        return [];
      });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function submitComposerMessage(imageFiles: File[]) {
    await onSubmitMessage(undefined, imageFiles, pendingReferences);
    setPendingReferences([]);
  }

  function openReferencePicker(mode: ReferencePickerMode) {
    setReferencePickerMode(mode);
  }

  function closeReferencePicker() {
    setReferencePickerMode(null);
  }

  function addPendingReference(reference: MessageReference) {
    setPendingReferences((current) => [...current, reference]);
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
    setEditImagePreviews((currentPreviews) => [
      ...currentPreviews,
      ...imageFiles.map((file) => ({
        id: createPreviewId(),
        file,
        url: URL.createObjectURL(file)
      }))
    ]);
  }

  function removeEditImage(previewId: string) {
    setEditImagePreviews((currentPreviews) => {
      const preview = currentPreviews.find((item) => item.id === previewId);
      if (preview) URL.revokeObjectURL(preview.url);
      return currentPreviews.filter((item) => item.id !== previewId);
    });
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

  async function openDraftEnglishPicker(imageFiles: File[] = []) {
    if (!draft.trim()) return;
    const draftImageFiles = [...imageFiles];
    setEnglishPicker({
      source: { type: 'draft', imageFiles: draftImageFiles },
      status: 'loading',
      conversion: null,
      selections: [],
      error: null
    });

    try {
      const conversion = await onConvertToEnglish(draft);
      setEnglishPicker({
        source: { type: 'draft', imageFiles: draftImageFiles },
        status: 'ready',
        conversion,
        selections: conversion.segments.map(() => 0),
        error: null
      });
    } catch (error) {
      setEnglishPicker({
        source: { type: 'draft', imageFiles: draftImageFiles },
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
        const draftImageFiles = englishPicker.source.type === 'draft' ? englishPicker.source.imageFiles : [];
        await onSubmitMessage(englishText, draftImageFiles, pendingReferences);
        setPendingReferences([]);
        setClearComposerImagePreviewsSignal((signal) => signal + 1);
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

          <div
            className="messages"
            ref={messagesRef}
            onDragOver={handleMessagesDragOver}
            onDrop={handleMessagesDrop}
          >
            {activeMessages.map((message, messageIndex) => (
              <Fragment key={message.id}>
                {messageDropTarget?.messageId === message.id && messageDropTarget.position === 'before' && (
                  <div className="message-drop-indicator" aria-hidden="true" />
                )}
                <MessageBubble
                  message={message}
                  messageIndex={messageIndex}
                  messageCount={activeMessages.length}
                  isSelectionMode={isMergeSelectionMode}
                  isSelected={selectedMessageIds.includes(message.id)}
                  isDragging={draggedMessageId === message.id}
                  isDragOver={false}
                  isEditing={editingMessage?.id === message.id}
                  editText={editText}
                  editReferences={editReferences}
                  editImagePreviews={editImagePreviews}
                  activeReferenceTarget={activeReferenceTarget}
                  isSavingEdit={isSavingEdit}
                  editTextareaRef={editTextareaRef}
                  copyFeedbackStatus={copyFeedback?.messageId === message.id ? copyFeedback.status : null}
                  sourceConversationTitle={
                    message.forwardedFromConversationTitle ?? getConversationTitle(message.forwardedFromConversationId)
                  }
                  onSelect={toggleMessageSelection}
                  onStartSelection={startMergeSelection}
                  onNavigateToReference={onNavigateToReference}
                  canNavigateToReference={canNavigateToReference}
                  onNavigateToMessage={(messageId) =>
                    onNavigateToReference({ conversationId: message.conversationId, messageId })
                  }
                  canNavigateToMessage={canNavigateToMessage}
                  onCancelEdit={onCancelEdit}
                  onEditTextChange={setEditText}
                  onRemoveEditReference={(referenceId) =>
                    setEditReferences((current) => current.filter((reference) => reference.id !== referenceId))
                  }
                  onEditImagePaste={handleEditImagePaste}
                  onRemoveEditImage={removeEditImage}
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
                {messageDropTarget?.messageId === message.id && messageDropTarget.position === 'after' && (
                  <div className="message-drop-indicator" aria-hidden="true" />
                )}
              </Fragment>
            ))}
            {activeMessages.length === 0 && <p className="empty-state">Write the first message here.</p>}
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
              pendingReferences={pendingReferences}
              onDraftChange={onDraftChange}
              onSubmitMessage={(imageFiles) => void submitComposerMessage(imageFiles)}
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
              onClose={() => setEnglishPicker(null)}
              onSelectionChange={updateEnglishSelection}
              onSave={(action) => void saveEnglishResult(action)}
            />
          )}

          {referencePickerMode && (
            <ReferencePickerModal
              mode={referencePickerMode}
              activeConversation={activeConversation}
              conversations={conversations}
              messagesByConversation={messagesByConversation}
              onAddReference={addPendingReference}
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
