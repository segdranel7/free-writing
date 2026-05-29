import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { CalendarClock, ClipboardPaste, ImagePlus, Languages, Link2, Quote, Send, X } from 'lucide-react';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
import { useImagePreviews } from '../hooks/useImagePreviews';
import type { Conversation, MessageReference } from '../types';
import { formatDateTimeLocalInput, parseDateTimeLocalInput } from '../utils/calendar';
import { getImageExtension, getImageFilesFromClipboardData } from '../utils/imageFiles';
import {
  completeInlineConversationLinkDraft,
  getActiveInlineConversationLinkDraft,
  getInlineConversationLinkSuggestions
} from '../utils/inlineConversationLinks';
import { truncateReferenceText } from '../utils/messageReferences';

const scheduleControlId = 'composer-schedule-control';

type MessageComposerProps = {
  draft: string;
  conversations: Conversation[];
  pendingReferences: MessageReference[];
  scheduledAt: Date | null;
  onDraftChange: (value: string) => void;
  onScheduledAtChange: (scheduledAt: Date | null) => void;
  onSubmitMessage: (imageFiles: File[], scheduledAt: Date | null) => void | Promise<void>;
  onConvertDraftToEnglish: (imageFiles: File[]) => void;
  clearImagePreviewsSignal: number;
  onAddConversationReference: () => void;
  onAddQuoteReference: () => void;
  onRemoveReference: (referenceId: string) => void;
};

export function MessageComposer({
  draft,
  conversations,
  pendingReferences,
  scheduledAt,
  onDraftChange,
  onScheduledAtChange,
  onSubmitMessage,
  onConvertDraftToEnglish,
  clearImagePreviewsSignal,
  onAddConversationReference,
  onAddQuoteReference,
  onRemoveReference
}: MessageComposerProps) {
  const { imagePreviews, getImageFiles, addImageFiles, removeImage, clearImagePreviews } = useImagePreviews();
  const [isSending, setIsSending] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [pasteStatus, setPasteStatus] = useState('');
  const [sendError, setSendError] = useState('');
  const [draftCursorOffset, setDraftCursorOffset] = useState<number | null>(null);
  const [highlightedInlineLinkSuggestionIndex, setHighlightedInlineLinkSuggestionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastClearImagePreviewsSignal = useRef(clearImagePreviewsSignal);
  const pendingCursorOffset = useRef<number | null>(null);
  const skipNextDraftCursorUpdate = useRef(false);
  const isSendingRef = useRef(false);
  const canSend = Boolean(draft.trim() || imagePreviews.length > 0 || pendingReferences.length > 0);
  const isScheduleVisible = isScheduleOpen || Boolean(scheduledAt);
  const activeInlineLinkDraft = useMemo(() => {
    return draftCursorOffset === null ? null : getActiveInlineConversationLinkDraft(draft, draftCursorOffset);
  }, [draft, draftCursorOffset]);
  const inlineLinkSuggestions = useMemo(() => {
    if (!activeInlineLinkDraft) return [];
    return getInlineConversationLinkSuggestions(conversations, activeInlineLinkDraft.query);
  }, [activeInlineLinkDraft, conversations]);
  const secondaryComposerActions = [
    {
      label: 'Paste image',
      icon: <ClipboardPaste size={17} />,
      onClick: () => void pasteImagesFromClipboard()
    },
    {
      label: 'Add conversation link',
      icon: <Link2 size={17} />,
      onClick: onAddConversationReference
    },
    {
      label: 'Cite text',
      icon: <Quote size={17} />,
      onClick: onAddQuoteReference
    },
    {
      label: 'Convert draft to English',
      icon: <Languages size={17} />,
      disabled: !draft.trim(),
      onClick: () => onConvertDraftToEnglish(getImageFiles())
    }
  ];

  function getPendingReferenceLabel(reference: MessageReference) {
    if (reference.type === 'quote') return `"${truncateReferenceText(reference.quoteText, 72)}"`;
    if (reference.type === 'block') return truncateReferenceText(reference.sourceMessagePreview, 72);
    return reference.sourceConversationTitle;
  }

  useEffect(() => {
    if (clearImagePreviewsSignal === lastClearImagePreviewsSignal.current) return;
    lastClearImagePreviewsSignal.current = clearImagePreviewsSignal;
    clearImagePreviews();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [clearImagePreviews, clearImagePreviewsSignal]);

  useLayoutEffect(() => {
    if (pendingCursorOffset.current === null || !textareaRef.current) return;
    const nextCursorOffset = pendingCursorOffset.current;
    pendingCursorOffset.current = null;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(nextCursorOffset, nextCursorOffset);
  }, [draft]);

  useEffect(() => {
    setHighlightedInlineLinkSuggestionIndex(0);
  }, [activeInlineLinkDraft?.query, inlineLinkSuggestions.length]);

  function updateDraftCursorOffset(textarea: HTMLTextAreaElement) {
    setDraftCursorOffset(textarea.selectionStart);
  }

  function addComposerImageFiles(files: FileList | File[] | null) {
    if (!files) return;
    setSendError('');
    addImageFiles(files);
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const imageFiles = getImageFilesFromClipboardData(event.clipboardData);
    if (imageFiles.length === 0) return;

    event.preventDefault();
    addComposerImageFiles(imageFiles);
    setPasteStatus(`${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} pasted`);
  }

  async function pasteImagesFromClipboard() {
    if (!navigator.clipboard?.read) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        imageFiles.push(new File([blob], `pasted-image.${getImageExtension(imageType)}`, { type: imageType }));
      }

      if (imageFiles.length === 0) {
        setPasteStatus('No image found on clipboard');
        return;
      }

      addComposerImageFiles(imageFiles);
      setPasteStatus(`${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} pasted`);
    } catch (error) {
      console.error('Unable to paste image from clipboard.', error);
      fileInputRef.current?.click();
    }
  }

  async function submitMessage() {
    if (!canSend || isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);
    setSendError('');
    try {
      await onSubmitMessage(getImageFiles(), scheduledAt);
      clearImagePreviews();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Unable to send message.', error);
      setSendError(error instanceof Error ? error.message : 'Unable to send this message.');
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  function completeInlineLinkSuggestion(conversationTitle: string) {
    if (!activeInlineLinkDraft) return;
    const completion = completeInlineConversationLinkDraft(draft, activeInlineLinkDraft, conversationTitle);
    pendingCursorOffset.current = completion.cursorOffset;
    setDraftCursorOffset(completion.cursorOffset);
    onDraftChange(completion.text);
  }

  function completeHighlightedInlineLinkSuggestion() {
    const suggestion = inlineLinkSuggestions[highlightedInlineLinkSuggestionIndex];
    if (!suggestion) return;
    skipNextDraftCursorUpdate.current = true;
    completeInlineLinkSuggestion(suggestion.title);
  }

  function insertInlineLinkMarker() {
    const textarea = textareaRef.current;
    const startOffset = textarea?.selectionStart ?? draft.length;
    const endOffset = textarea?.selectionEnd ?? startOffset;
    const nextText = `${draft.slice(0, startOffset)}[[${draft.slice(endOffset)}`;
    const nextCursorOffset = startOffset + 2;
    pendingCursorOffset.current = nextCursorOffset;
    setDraftCursorOffset(nextCursorOffset);
    onDraftChange(nextText);
  }

  return (
    <form
      className="composer"
      onPaste={handlePaste}
      onSubmit={(event) => {
        event.preventDefault();
        void submitMessage();
      }}
    >
      <div className="composer-inputs">
        {pendingReferences.length > 0 && (
          <div className="pending-references" aria-label="Pending references">
            {pendingReferences.map((reference) => (
              <div key={reference.id} className="pending-reference">
                <span>{getPendingReferenceLabel(reference)}</span>
                <button
                  className="icon-button bare"
                  type="button"
                  title="Remove reference"
                  onClick={() => onRemoveReference(reference.id)}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        {imagePreviews.length > 0 && (
          <div className="composer-images" aria-label="Selected images">
            {imagePreviews.map((preview) => (
              <figure key={preview.id} className="composer-image-preview">
                <img src={preview.url} alt={preview.file.name} />
                <button
                  className="icon-button bare remove-image-button"
                  type="button"
                  title="Remove image"
                  onClick={() => removeImage(preview.id)}
                >
                  <X size={15} />
                </button>
              </figure>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
            updateDraftCursorOffset(event.target);
          }}
          onClick={(event) => updateDraftCursorOffset(event.currentTarget)}
          onFocus={(event) => updateDraftCursorOffset(event.currentTarget)}
          onBlur={() => setDraftCursorOffset(null)}
          onSelect={(event) => updateDraftCursorOffset(event.currentTarget)}
          onKeyDown={(event) => {
            if (inlineLinkSuggestions.length > 0 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlightedInlineLinkSuggestionIndex((currentIndex) => (currentIndex + 1) % inlineLinkSuggestions.length);
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlightedInlineLinkSuggestionIndex(
                  (currentIndex) => (currentIndex - 1 + inlineLinkSuggestions.length) % inlineLinkSuggestions.length
                );
                return;
              }

              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                completeHighlightedInlineLinkSuggestion();
                return;
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                setDraftCursorOffset(null);
                return;
              }
            }

            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Enter') {
              event.preventDefault();
              void submitMessage();
              return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              onConvertDraftToEnglish(getImageFiles());
            }
          }}
          onKeyUp={(event) => {
            if (event.key === 'Escape' || skipNextDraftCursorUpdate.current) {
              skipNextDraftCursorUpdate.current = false;
              return;
            }
            updateDraftCursorOffset(event.currentTarget);
          }}
          placeholder="Write a message"
          rows={2}
        />
        {inlineLinkSuggestions.length > 0 && (
          <div className="inline-link-suggestions" role="listbox" aria-label="Conversation link suggestions">
            {inlineLinkSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.conversationId}
                className={index === highlightedInlineLinkSuggestionIndex ? 'inline-link-suggestion active' : 'inline-link-suggestion'}
                type="button"
                role="option"
                aria-selected={index === highlightedInlineLinkSuggestionIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedInlineLinkSuggestionIndex(index)}
                onClick={() => completeInlineLinkSuggestion(suggestion.title)}
              >
                {suggestion.title}
              </button>
            ))}
          </div>
        )}
        {isScheduleVisible && (
          <div id={scheduleControlId} className="composer-schedule">
            <CalendarClock size={16} />
            <input
              aria-label="Block date and time"
              type="datetime-local"
              value={formatDateTimeLocalInput(scheduledAt)}
              onChange={(event) => onScheduledAtChange(parseDateTimeLocalInput(event.target.value))}
            />
            {scheduledAt && (
              <button
                className="icon-button bare"
                type="button"
                title="Clear date and time"
                onClick={() => onScheduledAtChange(null)}
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
        {sendError && (
          <p className="composer-error" role="alert">
            {sendError}
          </p>
        )}
      </div>
      <div className="composer-actions">
        <span className="visually-hidden" aria-live="polite">
          {pasteStatus}
        </span>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          multiple
          aria-label="Add images"
          onChange={(event) => addComposerImageFiles(event.target.files)}
        />
        <div className="composer-primary-tools" aria-label="Primary composer actions">
          <button
            className="icon-button composer-date-button"
            type="button"
            title="Add date and time"
            aria-controls={scheduleControlId}
            aria-expanded={isScheduleVisible}
            onClick={() => setIsScheduleOpen((isOpen) => !isOpen)}
          >
            <CalendarClock size={17} />
            <span>Date</span>
          </button>
          <button
            className="icon-button"
            type="button"
            title="Add images"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Insert [["
            aria-label="Insert [["
            onMouseDown={(event) => event.preventDefault()}
            onClick={insertInlineLinkMarker}
          >
            <span className="inline-link-marker-icon">[[</span>
          </button>
          <div className="composer-more-tools">
            <HeaderOverflowMenu label="More composer actions" items={secondaryComposerActions} />
          </div>
        </div>
        <div className="composer-secondary-tools" aria-label="Secondary composer actions">
          <button
            className="icon-button"
            type="button"
            title="Paste image"
            onClick={() => void pasteImagesFromClipboard()}
          >
            <ClipboardPaste size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Add conversation link"
            onClick={onAddConversationReference}
          >
            <Link2 size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Cite text"
            onClick={onAddQuoteReference}
          >
            <Quote size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Convert draft to English"
            disabled={!draft.trim()}
            onClick={() => onConvertDraftToEnglish(getImageFiles())}
          >
            <Languages size={17} />
          </button>
        </div>
        <button className="primary-button send-button" title="Send (Ctrl+Shift+Enter)" disabled={!canSend || isSending}>
          <Send size={16} />
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
}
