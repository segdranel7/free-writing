import { X } from 'lucide-react';
import type { EnglishPickerAction, EnglishPickerState } from '../hooks/useEnglishConversionPicker';
import { useWordRangeSelection } from '../hooks/useWordRangeSelection';
import { getTextTokens, type TextSelectionRange } from '../utils/textSelection';

type EnglishPickerModalProps = {
  state: EnglishPickerState;
  isSaving: boolean;
  onClose: () => void;
  onConvertSelection: (ranges: TextSelectionRange[]) => void;
  onSelectionChange: (segmentIndex: number, optionIndex: number) => void;
  onSave: (action: EnglishPickerAction) => void;
};

export function EnglishPickerModal({
  state,
  isSaving,
  onClose,
  onConvertSelection,
  onSelectionChange,
  onSave
}: EnglishPickerModalProps) {
  const {
    selectionRanges,
    clearSelection,
    isSelected,
    handleWordPointerDown,
    handlePointerMove,
    endDragSelection,
    handleWordClick
  } = useWordRangeSelection({
    wordSelector: '[data-english-word="true"]',
    captureSelector: '.english-source-text'
  });
  const selectionMessage = state.source.type === 'message' && state.status === 'selecting'
    ? state.source.message
    : null;
  const isMessageSelection = Boolean(selectionMessage);
  const selectedWordCount = selectionRanges.length;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="english-picker" role="dialog" aria-modal="true" aria-labelledby="english-picker-title">
        <header className="english-picker-header">
          <div>
            <p className="eyebrow">English conversion</p>
            <h3 id="english-picker-title">Choose English versions</h3>
          </div>
          <button className="icon-button bare" type="button" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {state.status === 'loading' && <p className="picker-status">Preparing English options...</p>}

        {state.error && (
          <p className="notice error" role="alert">
            {state.error}
          </p>
        )}

        {isMessageSelection && (
          <div className="english-selection-panel">
            <div
              className="english-source-text"
              aria-label="Choose text to convert"
              onPointerMove={handlePointerMove}
              onPointerUp={endDragSelection}
              onPointerCancel={endDragSelection}
              onLostPointerCapture={endDragSelection}
            >
              {getTextTokens(selectionMessage?.text ?? '').map((token) =>
                token.isWord ? (
                  <button
                    key={`${token.startOffset}-${token.endOffset}`}
                    className={`word-token ${isSelected(token.startOffset, token.endOffset) ? 'selected' : ''}`}
                    type="button"
                    aria-pressed={isSelected(token.startOffset, token.endOffset)}
                    data-english-word="true"
                    data-start-offset={token.startOffset}
                    data-end-offset={token.endOffset}
                    onPointerDown={(event) =>
                      handleWordPointerDown(event, token.startOffset, token.endOffset)
                    }
                    onClick={(event) =>
                      handleWordClick(token.startOffset, token.endOffset, event.detail)
                    }
                  >
                    {token.text}
                  </button>
                ) : (
                  <span key={`${token.startOffset}-${token.endOffset}`}>{token.text}</span>
                )
              )}
            </div>
            <div className="english-selection-summary">
              <span>{selectedWordCount > 0 ? `${selectedWordCount} selected` : 'Whole block'}</span>
              {selectedWordCount > 0 && (
                <button className="text-button" type="button" onClick={clearSelection}>
                  Use whole block
                </button>
              )}
            </div>
          </div>
        )}

        {state.conversion && (
          <>
            <div className="english-segments">
              {state.conversion.segments.map((segment, segmentIndex) => (
                <fieldset className="english-segment" key={`${segment.original}-${segmentIndex}`}>
                  <legend className="visually-hidden">English option group {segmentIndex + 1}</legend>
                  {segment.options.map((option, optionIndex) => (
                    <label className="english-option" key={option}>
                      <input
                        type="radio"
                        name={`english-segment-${segmentIndex}`}
                        checked={(state.selections[segmentIndex] ?? 0) === optionIndex}
                        onChange={() => onSelectionChange(segmentIndex, optionIndex)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </>
        )}

        <footer className="english-picker-actions">
          <button className="text-button" type="button" onClick={onClose}>
            Cancel
          </button>
          {isMessageSelection ? (
            <button
              className="primary-button"
              type="button"
              disabled={!selectionMessage?.text.trim()}
              onClick={() => onConvertSelection(selectionRanges)}
            >
              Convert {selectedWordCount > 0 ? 'selection' : 'block'}
            </button>
          ) : state.source.type === 'message' ? (
            <>
              <button
                className="text-button"
                type="button"
                disabled={!state.conversion || isSaving}
                onClick={() => onSave('replace')}
              >
                {state.status === 'formatting-replace'
                  ? 'Organizing...'
                  : state.status === 'replacing'
                    ? 'Replacing...'
                    : 'Replace block'}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!state.conversion || isSaving}
                onClick={() => onSave('create')}
              >
                {state.status === 'formatting-create'
                  ? 'Organizing...'
                  : state.status === 'creating'
                    ? 'Creating...'
                    : 'Create block'}
              </button>
            </>
          ) : (
            <button
              className="primary-button"
              type="button"
              disabled={!state.conversion || isSaving}
              onClick={() => onSave('draft')}
            >
              {state.status === 'formatting-draft'
                ? 'Organizing...'
                : state.status === 'sending-draft'
                  ? 'Sending...'
                  : 'Send English'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
