import { Combine, Copy, Forward, MoveRight, Trash2, X } from 'lucide-react';

type SelectionToolbarProps = {
  selectedCount: number;
  error: string | null;
  isMerging: boolean;
  isApplyingAction: boolean;
  onCancel: () => void;
  onMerge: () => void;
  onForward: () => void;
  onMove: () => void;
  onCopyText: () => void;
  onDelete: () => void;
};

export function SelectionToolbar({
  selectedCount,
  error,
  isMerging,
  isApplyingAction,
  onCancel,
  onMerge,
  onForward,
  onMove,
  onCopyText,
  onDelete
}: SelectionToolbarProps) {
  return (
    <div className="selection-toolbar" aria-live="polite">
      <span>{selectedCount} selected</span>
      {error && (
        <span className="merge-error" role="alert">
          {error}
        </span>
      )}
      <button
        className="icon-button cancel-merge-button"
        type="button"
        title="Cancel merge selection"
        onClick={onCancel}
      >
        <X size={16} />
      </button>
      <div className="selection-actions">
        <button
          className="icon-button merge-button"
          type="button"
          title="Merge selected text blocks"
          disabled={selectedCount < 2 || isMerging}
          onClick={onMerge}
        >
          <Combine size={16} />
        </button>
        <button
          className="icon-button"
          type="button"
          title="Copy selected blocks to conversation"
          disabled={selectedCount === 0}
          onClick={onForward}
        >
          <Forward size={16} />
        </button>
        <button
          className="icon-button"
          type="button"
          title="Move selected blocks to conversation"
          disabled={selectedCount === 0}
          onClick={onMove}
        >
          <MoveRight size={16} />
        </button>
        <button
          className="icon-button"
          type="button"
          title="Copy selected text"
          disabled={selectedCount === 0}
          onClick={onCopyText}
        >
          <Copy size={16} />
        </button>
        <button
          className="icon-button"
          type="button"
          title="Delete selected blocks"
          disabled={selectedCount === 0 || isApplyingAction}
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
