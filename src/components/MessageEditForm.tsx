import { CalendarClock, Link2, Quote, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type RefObject } from 'react';
import type { Conversation, Message, MessageReference } from '../types';
import { formatDateTimeLocalInput, parseDateTimeLocalInput } from '../utils/calendar';
import {
  completeInlineConversationLinkDraft,
  getActiveInlineConversationLinkDraft,
  getInlineConversationLinkSuggestions
} from '../utils/inlineConversationLinks';
import { truncateReferenceText } from '../utils/messageReferences';

type MessageEditFormProps = {
  message: Message;
  conversations: Conversation[];
  editText: string;
  editReferences: MessageReference[];
  editScheduledAt: Date | null;
  editImagePreviews: Array<{ id: string; file: File; url: string }>;
  isSavingEdit: boolean;
  editTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onCancelEdit: () => void;
  onEditTextChange: (value: string) => void;
  onEditScheduledAtChange: (scheduledAt: Date | null) => void;
  onRemoveEditReference: (referenceId: string) => void;
  onEditImagePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemoveEditImage: (previewId: string) => void;
  onSaveEdit: (message: Message) => void;
};

export function MessageEditForm({
  message,
  conversations,
  editText,
  editReferences,
  editScheduledAt,
  editImagePreviews,
  isSavingEdit,
  editTextareaRef,
  onCancelEdit,
  onEditTextChange,
  onEditScheduledAtChange,
  onRemoveEditReference,
  onEditImagePaste,
  onRemoveEditImage,
  onSaveEdit
}: MessageEditFormProps) {
  const [editCursorOffset, setEditCursorOffset] = useState<number | null>(null);
  const [highlightedInlineLinkSuggestionIndex, setHighlightedInlineLinkSuggestionIndex] = useState(0);
  const pendingCursorOffset = useRef<number | null>(null);
  const skipNextEditCursorUpdate = useRef(false);
  const hasExistingAttachments = (message.attachments?.length ?? 0) > 0;
  const hasEditableContent =
    editText.trim() || hasExistingAttachments || editImagePreviews.length > 0 || editReferences.length > 0;
  const activeInlineLinkDraft = useMemo(() => {
    return editCursorOffset === null ? null : getActiveInlineConversationLinkDraft(editText, editCursorOffset);
  }, [editCursorOffset, editText]);
  const inlineLinkSuggestions = useMemo(() => {
    if (!activeInlineLinkDraft) return [];
    return getInlineConversationLinkSuggestions(conversations, activeInlineLinkDraft.query);
  }, [activeInlineLinkDraft, conversations]);

  useLayoutEffect(() => {
    if (pendingCursorOffset.current === null || !editTextareaRef.current) return;
    const nextCursorOffset = pendingCursorOffset.current;
    pendingCursorOffset.current = null;
    editTextareaRef.current.focus();
    editTextareaRef.current.setSelectionRange(nextCursorOffset, nextCursorOffset);
  }, [editText, editTextareaRef]);

  useEffect(() => {
    setHighlightedInlineLinkSuggestionIndex(0);
  }, [activeInlineLinkDraft?.query, inlineLinkSuggestions.length]);

  function getReferenceLabel(reference: MessageReference) {
    if (reference.type === 'quote') return `"${truncateReferenceText(reference.quoteText, 88)}"`;
    if (reference.type === 'block') return truncateReferenceText(reference.sourceMessagePreview, 88);
    return reference.sourceConversationTitle;
  }

  function updateEditCursorOffset(textarea: HTMLTextAreaElement) {
    setEditCursorOffset(textarea.selectionStart);
  }

  function completeInlineLinkSuggestion(conversationTitle: string) {
    if (!activeInlineLinkDraft) return;
    const completion = completeInlineConversationLinkDraft(editText, activeInlineLinkDraft, conversationTitle);
    pendingCursorOffset.current = completion.cursorOffset;
    setEditCursorOffset(completion.cursorOffset);
    onEditTextChange(completion.text);
  }

  function completeHighlightedInlineLinkSuggestion() {
    const suggestion = inlineLinkSuggestions[highlightedInlineLinkSuggestionIndex];
    if (!suggestion) return;
    skipNextEditCursorUpdate.current = true;
    completeInlineLinkSuggestion(suggestion.title);
  }

  function insertInlineLinkMarker() {
    const textarea = editTextareaRef.current;
    const startOffset = textarea?.selectionStart ?? editText.length;
    const endOffset = textarea?.selectionEnd ?? startOffset;
    const nextText = `${editText.slice(0, startOffset)}[[${editText.slice(endOffset)}`;
    const nextCursorOffset = startOffset + 2;
    pendingCursorOffset.current = nextCursorOffset;
    setEditCursorOffset(nextCursorOffset);
    onEditTextChange(nextText);
  }

  return (
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
        onChange={(event) => {
          onEditTextChange(event.target.value);
          updateEditCursorOffset(event.target);
        }}
        onClick={(event) => updateEditCursorOffset(event.currentTarget)}
        onFocus={(event) => updateEditCursorOffset(event.currentTarget)}
        onBlur={() => setEditCursorOffset(null)}
        onSelect={(event) => updateEditCursorOffset(event.currentTarget)}
        onPaste={onEditImagePaste}
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
              setEditCursorOffset(null);
              return;
            }
          }

          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            onSaveEdit(message);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Escape' || skipNextEditCursorUpdate.current) {
            skipNextEditCursorUpdate.current = false;
            return;
          }
          updateEditCursorOffset(event.currentTarget);
        }}
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
      <div className="message-edit-tools">
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
      </div>
      <div className="message-edit-schedule">
        <CalendarClock size={16} />
        <input
          aria-label="Edit block date and time"
          type="datetime-local"
          value={formatDateTimeLocalInput(editScheduledAt)}
          onChange={(event) => onEditScheduledAtChange(parseDateTimeLocalInput(event.target.value))}
        />
        {editScheduledAt && (
          <button
            className="icon-button bare"
            type="button"
            title="Clear date and time"
            onClick={() => onEditScheduledAtChange(null)}
          >
            <X size={15} />
          </button>
        )}
      </div>
      {editReferences.length > 0 && (
        <div className="message-reference-list" aria-label="Block references">
          {editReferences.map((reference) => (
            <div key={reference.id} className="message-reference-card">
              {reference.type === 'quote' ? <Quote size={15} /> : <Link2 size={15} />}
              <span>{getReferenceLabel(reference)}</span>
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
      {(hasExistingAttachments || editImagePreviews.length > 0) && (
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
        <button className="primary-button" type="submit" disabled={!hasEditableContent || isSavingEdit}>
          {isSavingEdit ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
