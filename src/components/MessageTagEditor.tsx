import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import type { Message } from '../types';
import {
  addTag as addTagToList,
  getAvailableTagSuggestions,
  normalizeTags,
  removeTag as removeTagFromList,
  type TagSummary
} from '../utils/tags';

type MessageTagEditorProps = {
  message: Message;
  isSelectionMode: boolean;
  tagSuggestions: TagSummary[];
  onUpdateTags: (message: Message, tags: string[]) => void | Promise<void>;
  trailingControl?: ReactNode;
};

export function MessageTagEditor({
  message,
  isSelectionMode,
  tagSuggestions,
  onUpdateTags,
  trailingControl
}: MessageTagEditorProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const tags = useMemo(() => normalizeTags(message.tags ?? []), [message.tags]);
  const visibleSuggestions = useMemo(() => {
    return getAvailableTagSuggestions(tags, tagDraft, tagSuggestions);
  }, [tagDraft, tagSuggestions, tags]);

  useEffect(() => {
    setHighlightedSuggestionIndex(0);
  }, [tagDraft, visibleSuggestions.length]);

  function closeEditor() {
    setTagDraft('');
    setIsEditorOpen(false);
    setTagError(null);
  }

  async function saveTags(tagsToSave: string[]) {
    if (isSavingTags) return;
    setIsSavingTags(true);
    setTagError(null);
    try {
      await onUpdateTags(message, tagsToSave);
      closeEditor();
    } catch (error) {
      setTagError(error instanceof Error ? error.message : 'Unable to update tags.');
    } finally {
      setIsSavingTags(false);
    }
  }

  function addDraftTag() {
    const nextTags = addTagToList(tags, tagDraft);
    if (nextTags.length === tags.length) {
      setTagDraft('');
      return;
    }
    void saveTags(nextTags);
  }

  function addTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addDraftTag();
  }

  function addExistingTag(tagName: string) {
    const nextTags = addTagToList(tags, tagName);
    if (nextTags.length === tags.length) return;
    void saveTags(nextTags);
  }

  function removeTag(tagToRemove: string) {
    void saveTags(removeTagFromList(tags, tagToRemove));
  }

  return (
    <>
      <div className="message-tags" aria-label="Block tags">
        {tags.map((tag) => (
          <span key={tag} className="message-tag-chip">
            <Tag size={12} />
            {tag}
            {!isSelectionMode && (
              <button
                className="tag-remove-button"
                type="button"
                title={`Remove ${tag}`}
                disabled={isSavingTags}
                onClick={() => removeTag(tag)}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {!isSelectionMode && (
          <>
            {isEditorOpen ? (
              <form className="tag-editor-form" onSubmit={addTag}>
                <input
                  aria-label="New tag"
                  value={tagDraft}
                  autoFocus
                  placeholder="Add tag"
                  disabled={isSavingTags}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeEditor();
                      return;
                    }

                    if (event.key === 'ArrowDown' && visibleSuggestions.length > 0) {
                      event.preventDefault();
                      setHighlightedSuggestionIndex((current) => (current + 1) % visibleSuggestions.length);
                      return;
                    }

                    if (event.key === 'ArrowUp' && visibleSuggestions.length > 0) {
                      event.preventDefault();
                      setHighlightedSuggestionIndex(
                        (current) => (current - 1 + visibleSuggestions.length) % visibleSuggestions.length
                      );
                      return;
                    }

                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (visibleSuggestions[highlightedSuggestionIndex]) {
                        addExistingTag(visibleSuggestions[highlightedSuggestionIndex].name);
                      } else {
                        addDraftTag();
                      }
                    }
                  }}
                />
                <button className="icon-button bare" type="submit" title="Save tag" disabled={!tagDraft.trim() || isSavingTags}>
                  <Plus size={14} />
                </button>
                <button className="icon-button bare" type="button" title="Cancel tag" disabled={isSavingTags} onClick={closeEditor}>
                  <X size={14} />
                </button>
                {visibleSuggestions.length > 0 && (
                  <div className="tag-suggestion-list" role="listbox" aria-label="Tag suggestions">
                    {visibleSuggestions.map((tag, index) => (
                      <button
                        key={tag.name}
                        className={index === highlightedSuggestionIndex ? 'tag-suggestion active' : 'tag-suggestion'}
                        type="button"
                        role="option"
                        aria-selected={index === highlightedSuggestionIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                        onClick={() => addExistingTag(tag.name)}
                      >
                        <span>{tag.name}</span>
                        <small>{tag.count}</small>
                      </button>
                    ))}
                  </div>
                )}
              </form>
            ) : (
              <button className="add-tag-button" type="button" title="Add tag" onClick={() => setIsEditorOpen(true)}>
                <Plus size={13} />
                Tag
              </button>
            )}
          </>
        )}
        {trailingControl}
      </div>
      {tagError && (
        <p className="tag-error" role="alert">
          {tagError}
        </p>
      )}
    </>
  );
}
