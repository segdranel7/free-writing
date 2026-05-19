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
import { ArrowLeft, Combine, Link2, MoreVertical, Quote, X } from 'lucide-react';
import { EnglishPickerModal, type EnglishPickerState } from './EnglishPickerModal';
import { MessageComposer } from './MessageComposer';
import { MessageBubble, type CopyFeedbackStatus } from './MessageBubble';
import type { Conversation, EnglishConversion, Message, MessageImageAttachment, MessageReference } from '../types';
import { resolveNearestDropTarget, type DropPosition, type DropTargetCandidate } from '../utils/dropTargets';
import { assembleEnglishText } from '../utils/englishConversion';
import {
  createConversationReference,
  createQuoteReference,
  type MessageReferenceNavigationTarget
} from '../utils/messageReferences';
import { getTextTokens } from '../utils/textSelection';

type ConversationPaneProps = {
  activeConversation: Conversation | null;
  conversations: Conversation[];
  activeMessages: Message[];
  messagesByConversation: Record<string, Message[]>;
  navigationTarget: MessageReferenceNavigationTarget | null;
  draft: string;
  editingMessage: Message | null;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onSubmitMessage: (textOverride?: string, imageFiles?: File[], references?: MessageReference[]) => void | Promise<void>;
  onCancelEdit: () => void;
  onEditMessage: (message: Message) => void;
  onSaveEdit: (message: Message, text: string, imageFiles?: File[], references?: MessageReference[]) => void | Promise<void>;
  onForwardMessage: (message: Message) => void;
  onMoveToConversation: (message: Message) => void;
  onNavigateToReference: (target: MessageReferenceNavigationTarget) => void;
  onNavigationHandled: () => void;
  onDeleteMessage: (message: Message) => void;
  onMoveMessage: (messageIndex: number, direction: -1 | 1) => void;
  onReorderMessage: (draggedMessageId: string, targetMessageId: string, position: DropPosition) => void;
  onMergeMessages: (messages: Message[]) => Promise<void>;
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

type ReferencePickerMode = 'conversation' | 'quote';

function createPreviewId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getImageFilesFromClipboardData(clipboardData: DataTransfer) {
  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (itemFiles.length > 0) return itemFiles;
  return Array.from(clipboardData.files).filter((file) => file.type.startsWith('image/'));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTextAsClipboardHtml(text: string) {
  const trimmedText = text.trim();
  if (!trimmedText) return '';

  return trimmedText
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function getDataUrlBlob(dataUrl: string, fallbackType: string) {
  const [metadata = '', data = ''] = dataUrl.split(',');
  const contentType = metadata.match(/^data:([^;]+)/)?.[1] ?? fallbackType;
  const isBase64 = metadata.includes(';base64');
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function getClipboardHtml(message: Message) {
  const textHtml = renderTextAsClipboardHtml(message.text);
  const imageHtml = (message.attachments ?? [])
    .filter((attachment): attachment is MessageImageAttachment => attachment.type === 'image')
    .map(
      (attachment) =>
        `<p><img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name || 'Attached image')}"></p>`
    )
    .join('');

  return `<!doctype html><html><body>${textHtml}${imageHtml}</body></html>`;
}

async function copyMessageToClipboard(message: Message) {
  const attachments = message.attachments ?? [];

  if (attachments.length === 0 || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
    if (!message.text.trim()) throw new Error('This block has no text to copy.');
    await navigator.clipboard.writeText(message.text);
    return;
  }

  const clipboardParts: Record<string, Blob> = {
    'text/plain': new Blob([message.text], { type: 'text/plain' }),
    'text/html': new Blob([getClipboardHtml(message)], { type: 'text/html' })
  };
  const firstImage = attachments.find(
    (attachment): attachment is MessageImageAttachment => attachment.type === 'image' && attachment.url.startsWith('data:')
  );

  if (firstImage) {
    const imageBlob = getDataUrlBlob(firstImage.url, firstImage.contentType);
    clipboardParts[imageBlob.type || firstImage.contentType] = imageBlob;
  }

  try {
    await navigator.clipboard.write([new ClipboardItem(clipboardParts)]);
  } catch (error) {
    if (!message.text.trim()) throw error;
    await navigator.clipboard.writeText(message.text);
  }
}

export function ConversationPane({
  activeConversation,
  conversations,
  activeMessages,
  messagesByConversation,
  navigationTarget,
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
  onNavigateToReference,
  onNavigationHandled,
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
  const [clearComposerImagePreviewsSignal, setClearComposerImagePreviewsSignal] = useState(0);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [pendingReferences, setPendingReferences] = useState<MessageReference[]>([]);
  const [referencePickerMode, setReferencePickerMode] = useState<ReferencePickerMode | null>(null);
  const [referenceConversationId, setReferenceConversationId] = useState<string | null>(null);
  const [referenceMessageId, setReferenceMessageId] = useState<string | null>(null);
  const [referenceSelection, setReferenceSelection] = useState({ start: 0, end: 0 });
  const [activeReferenceTarget, setActiveReferenceTarget] = useState<MessageReferenceNavigationTarget | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null);
  const [messageDropTarget, setMessageDropTarget] = useState<MessageDropTarget | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [editText, setEditText] = useState('');
  const [editReferences, setEditReferences] = useState<MessageReference[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<EditImagePreview[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editImagePreviewsRef = useRef<EditImagePreview[]>([]);
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
  const referenceConversation = conversations.find((conversation) => conversation.id === referenceConversationId) ?? null;
  const referenceMessages = referenceConversationId ? messagesByConversation[referenceConversationId] ?? [] : [];
  const referenceMessage = referenceMessages.find((message) => message.id === referenceMessageId) ?? null;

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
    setMergeError(null);
    setSelectedMessageIds((currentIds) =>
      currentIds.includes(messageId)
        ? currentIds.filter((currentId) => currentId !== messageId)
        : [...currentIds, messageId]
    );
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
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Unable to merge the selected blocks.');
    } finally {
      setIsMerging(false);
    }
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
    const defaultConversation =
      mode === 'quote'
        ? conversations.find((conversation) => conversation.id !== activeConversation?.id)
        : conversations[0];
    setReferencePickerMode(mode);
    setReferenceConversationId(defaultConversation?.id ?? null);
    setReferenceMessageId(null);
    setReferenceSelection({ start: 0, end: 0 });
  }

  function closeReferencePicker() {
    setReferencePickerMode(null);
    setReferenceConversationId(null);
    setReferenceMessageId(null);
    setReferenceSelection({ start: 0, end: 0 });
  }

  function addConversationReference() {
    if (!referenceConversation) return;
    setPendingReferences((current) => [...current, createConversationReference(referenceConversation)]);
    closeReferencePicker();
  }

  function addQuoteReference() {
    if (!referenceConversation || !referenceMessage) return;
    const reference = createQuoteReference(
      referenceConversation,
      referenceMessage,
      referenceSelection.start,
      referenceSelection.end
    );
    if (!reference) return;
    setPendingReferences((current) => [...current, reference]);
    closeReferencePicker();
  }

  function selectReferenceWord(startOffset: number, endOffset: number) {
    setReferenceSelection((currentSelection) => {
      if (currentSelection.start === currentSelection.end) {
        return { start: startOffset, end: endOffset };
      }

      return {
        start: Math.min(currentSelection.start, startOffset),
        end: Math.max(currentSelection.end, endOffset)
      };
    });
  }

  function canNavigateToReference(reference: MessageReference) {
    if (!conversations.some((conversation) => conversation.id === reference.sourceConversationId)) return false;
    if (reference.type === 'conversation') return true;
    return Boolean(
      messagesByConversation[reference.sourceConversationId]?.some((message) => message.id === reference.sourceMessageId)
    );
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
                  onSelect={toggleMessageSelection}
                  onNavigateToReference={onNavigateToReference}
                  canNavigateToReference={canNavigateToReference}
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
            <div
              className="message-drag-preview"
              style={{
                left: dragPreview.x,
                top: dragPreview.y,
                width: dragPreview.width
              }}
              aria-hidden="true"
            >
              {(draggedMessage.attachments?.length ?? 0) > 0 && (
                <div className="message-drag-preview-images">
                  {draggedMessage.attachments?.slice(0, 2).map((attachment) => (
                    <img key={attachment.id} src={attachment.url} alt="" />
                  ))}
                </div>
              )}
              {draggedMessage.text && <p>{draggedMessage.text}</p>}
            </div>
          )}

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
            <div className="modal-backdrop" role="presentation">
              <section
                className="modal reference-picker"
                role="dialog"
                aria-modal="true"
                aria-label={referencePickerMode === 'quote' ? 'Cite text' : 'Add conversation link'}
              >
                <header className="modal-header">
                  <h3>{referencePickerMode === 'quote' ? 'Cite text' : 'Add conversation link'}</h3>
                  <button className="icon-button bare" type="button" title="Close" onClick={closeReferencePicker}>
                    <X size={18} />
                  </button>
                </header>

                <div className="reference-picker-grid">
                  <div className="reference-picker-list">
                    {conversations
                      .filter(
                        (conversation) => referencePickerMode !== 'quote' || conversation.id !== activeConversation.id
                      )
                      .map((conversation) => (
                        <button
                          key={conversation.id}
                          className={`reference-picker-row ${
                            referenceConversationId === conversation.id ? 'active' : ''
                          }`}
                          type="button"
                          onClick={() => {
                            setReferenceConversationId(conversation.id);
                            setReferenceMessageId(null);
                            setReferenceSelection({ start: 0, end: 0 });
                          }}
                        >
                          {conversation.title}
                        </button>
                      ))}
                  </div>

                  {referencePickerMode === 'quote' ? (
                    <div className="reference-picker-detail">
                      <div className="reference-picker-message-list">
                        {referenceMessages
                          .filter((message) => message.text.trim())
                          .map((message) => (
                            <button
                              key={message.id}
                              className={`reference-picker-row ${referenceMessageId === message.id ? 'active' : ''}`}
                              type="button"
                              onClick={() => {
                                setReferenceMessageId(message.id);
                                setReferenceSelection({ start: 0, end: 0 });
                              }}
                            >
                              {message.text}
                            </button>
                          ))}
                      </div>
                      {referenceMessage ? (
                        <div className="reference-word-picker" aria-label="Source message text">
                          {getTextTokens(referenceMessage.text).map((token) =>
                            token.isWord ? (
                              <button
                                key={`${token.startOffset}-${token.endOffset}`}
                                className={`word-token ${
                                  token.startOffset >= referenceSelection.start &&
                                  token.endOffset <= referenceSelection.end
                                    ? 'selected'
                                    : ''
                                }`}
                                type="button"
                                onClick={() => selectReferenceWord(token.startOffset, token.endOffset)}
                              >
                                {token.text}
                              </button>
                            ) : (
                              <span key={`${token.startOffset}-${token.endOffset}`}>{token.text}</span>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="empty-state">Choose a text block.</p>
                      )}
                      <button
                        className="primary-button"
                        type="button"
                        disabled={!referenceMessage || referenceSelection.end <= referenceSelection.start}
                        onClick={addQuoteReference}
                      >
                        <Quote size={16} />
                        Insert citation
                      </button>
                    </div>
                  ) : (
                    <div className="reference-picker-detail">
                      <p>{referenceConversation?.title ?? 'Choose a conversation.'}</p>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={!referenceConversation}
                        onClick={addConversationReference}
                      >
                        <Link2 size={16} />
                        Insert link
                      </button>
                    </div>
                  )}
                </div>
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
