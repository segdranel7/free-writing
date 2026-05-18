import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { ClipboardPaste, ImagePlus, Languages, Link2, Quote, Send, X } from 'lucide-react';
import type { MessageReference } from '../types';
import { truncateReferenceText } from '../utils/messageReferences';

type MessageComposerProps = {
  draft: string;
  pendingReferences: MessageReference[];
  onDraftChange: (value: string) => void;
  onSubmitMessage: (imageFiles: File[]) => void | Promise<void>;
  onConvertDraftToEnglish: (imageFiles: File[]) => void;
  clearImagePreviewsSignal: number;
  onAddConversationReference: () => void;
  onAddQuoteReference: () => void;
  onRemoveReference: (referenceId: string) => void;
};

type ImagePreview = {
  id: string;
  file: File;
  url: string;
};

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

function getImageExtension(contentType: string) {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/svg+xml') return 'svg';
  return contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
}

export function MessageComposer({
  draft,
  pendingReferences,
  onDraftChange,
  onSubmitMessage,
  onConvertDraftToEnglish,
  clearImagePreviewsSignal,
  onAddConversationReference,
  onAddQuoteReference,
  onRemoveReference
}: MessageComposerProps) {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [pasteStatus, setPasteStatus] = useState('');
  const [sendError, setSendError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagePreviewsRef = useRef<ImagePreview[]>([]);
  const lastClearImagePreviewsSignal = useRef(clearImagePreviewsSignal);
  const canSend = Boolean(draft.trim() || imagePreviews.length > 0 || pendingReferences.length > 0);

  useEffect(() => {
    return () => {
      imagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, []);

  useEffect(() => {
    imagePreviewsRef.current = imagePreviews;
  }, [imagePreviews]);

  useEffect(() => {
    if (clearImagePreviewsSignal === lastClearImagePreviewsSignal.current) return;
    lastClearImagePreviewsSignal.current = clearImagePreviewsSignal;
    clearImagePreviews();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [clearImagePreviewsSignal]);

  function getImageFiles() {
    return imagePreviewsRef.current.map((preview) => preview.file);
  }

  function clearImagePreviews() {
    setImagePreviews((current) => {
      current.forEach((preview) => URL.revokeObjectURL(preview.url));
      return [];
    });
  }

  function addImageFiles(files: FileList | File[] | null) {
    if (!files) return;
    setSendError('');
    const nextPreviews = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: createPreviewId(),
        file,
        url: URL.createObjectURL(file)
      }));
    setImagePreviews((current) => [...current, ...nextPreviews]);
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const imageFiles = getImageFilesFromClipboardData(event.clipboardData);
    if (imageFiles.length === 0) return;

    event.preventDefault();
    addImageFiles(imageFiles);
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

      addImageFiles(imageFiles);
      setPasteStatus(`${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} pasted`);
    } catch (error) {
      console.error('Unable to paste image from clipboard.', error);
      fileInputRef.current?.click();
    }
  }

  function removeImage(previewId: string) {
    setImagePreviews((current) => {
      const preview = current.find((item) => item.id === previewId);
      if (preview) URL.revokeObjectURL(preview.url);
      return current.filter((item) => item.id !== previewId);
    });
  }

  async function submitMessage() {
    if (!canSend || isSending) return;
    setIsSending(true);
    setSendError('');
    try {
      await onSubmitMessage(getImageFiles());
      clearImagePreviews();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Unable to send message.', error);
      setSendError(error instanceof Error ? error.message : 'Unable to send this message.');
    } finally {
      setIsSending(false);
    }
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
                <span>
                  {reference.type === 'quote'
                    ? `"${truncateReferenceText(reference.quoteText, 72)}"`
                    : reference.sourceConversationTitle}
                </span>
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
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              onConvertDraftToEnglish(getImageFiles());
            }
          }}
          placeholder="Write a message"
          rows={2}
        />
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
          onChange={(event) => addImageFiles(event.target.files)}
        />
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
        <button className="primary-button send-button" disabled={!canSend || isSending}>
          <Send size={16} />
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
}
