import { CalendarClock, Link2, Quote, X } from 'lucide-react';
import type { ClipboardEvent, RefObject } from 'react';
import type { Message, MessageReference } from '../types';
import { formatDateTimeLocalInput, parseDateTimeLocalInput } from '../utils/calendar';
import { truncateReferenceText } from '../utils/messageReferences';

type MessageEditFormProps = {
  message: Message;
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
  const hasExistingAttachments = (message.attachments?.length ?? 0) > 0;
  const hasEditableContent =
    editText.trim() || hasExistingAttachments || editImagePreviews.length > 0 || editReferences.length > 0;

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
        onChange={(event) => onEditTextChange(event.target.value)}
        onPaste={onEditImagePaste}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            onSaveEdit(message);
          }
        }}
      />
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
