import { useRef, useState, type PointerEvent } from 'react';
import { X } from 'lucide-react';
import type { Conversation, Message } from '../types';
import { getSelectedTextFromRanges, getTextTokens, type TextSelectionRange } from '../utils/textSelection';
import type { MessageSelection } from '../utils/transferActions';
import {
  buildMessageSelections,
  getMessageSelectionRangeCount,
  getSelectedMessageText,
  isTextRangeSelected,
  updateTextSelectionRanges
} from '../utils/transferSelection';

type ForwardModalProps = {
  conversations: Conversation[];
  mode: 'forward' | 'move';
  sourceMessage?: Message;
  sourceMessages?: Message[];
  onClose: () => void;
  onForward: (
    targetConversationId: string,
    ranges?: TextSelectionRange[],
    messageSelections?: MessageSelection[]
  ) => void;
};

export function ForwardModal({ conversations, mode, sourceMessage, sourceMessages = [], onClose, onForward }: ForwardModalProps) {
  const actionLabel = mode === 'move' ? 'Move' : 'Forward';
  const selectedMessages = sourceMessages.length > 0 ? sourceMessages : sourceMessage ? [sourceMessage] : [];
  const primarySourceMessage = selectedMessages[0];
  const isSelectedBlockTransfer = sourceMessages.length > 0;
  const [selectionRanges, setSelectionRanges] = useState<TextSelectionRange[]>([]);
  const [messageSelectionRanges, setMessageSelectionRanges] = useState<Record<string, TextSelectionRange[]>>({});
  const dragSelection = useRef<{
    pointerId: number;
    mode: 'select' | 'unselect';
  } | null>(null);
  const handledPointerClick = useRef(false);
  const selectedText = sourceMessage ? getSelectedTextFromRanges(sourceMessage.text, selectionRanges) : '';
  const selectedMessageText = getSelectedMessageText(selectedMessages, messageSelectionRanges);
  const transferText = isSelectedBlockTransfer
    ? selectedMessageText || selectedMessages.map((message) => message.text.trim()).filter(Boolean).join('\n\n')
    : selectedText || (sourceMessage?.text ?? '');
  const selectedWordCount = isSelectedBlockTransfer
    ? getMessageSelectionRangeCount(messageSelectionRanges)
    : selectionRanges.length;

  if (!primarySourceMessage) return null;

  function updateWordSelection(startOffset: number, endOffset: number, mode: 'toggle' | 'select' | 'unselect') {
    setSelectionRanges((currentSelectionRanges) => {
      return updateTextSelectionRanges(currentSelectionRanges, startOffset, endOffset, mode);
    });
  }

  function updateMessageWordSelection(
    messageId: string,
    startOffset: number,
    endOffset: number,
    mode: 'toggle' | 'select' | 'unselect'
  ) {
    setMessageSelectionRanges((currentSelectionRanges) => {
      const nextRanges = updateTextSelectionRanges(
        currentSelectionRanges[messageId] ?? [],
        startOffset,
        endOffset,
        mode
      );
      return {
        ...currentSelectionRanges,
        [messageId]: nextRanges
      };
    });
  }

  function isWordSelected(startOffset: number, endOffset: number) {
    return isTextRangeSelected(selectionRanges, startOffset, endOffset);
  }

  function isMessageWordSelected(messageId: string, startOffset: number, endOffset: number) {
    return isTextRangeSelected(messageSelectionRanges[messageId] ?? [], startOffset, endOffset);
  }

  function getWordRangeFromElement(element: Element | null) {
    const wordElement = element?.closest<HTMLElement>('[data-transfer-word="true"]');
    if (!wordElement) return null;
    const messageId = wordElement.dataset.messageId;
    const startOffset = Number(wordElement.dataset.startOffset);
    const endOffset = Number(wordElement.dataset.endOffset);
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return null;
    return { messageId, startOffset, endOffset };
  }

  function handleWordPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    startOffset: number,
    endOffset: number,
    messageId?: string
  ) {
    const mode = messageId
      ? isMessageWordSelected(messageId, startOffset, endOffset) ? 'unselect' : 'select'
      : isWordSelected(startOffset, endOffset) ? 'unselect' : 'select';
    dragSelection.current = { pointerId: event.pointerId, mode };
    handledPointerClick.current = true;
    event.preventDefault();
    event.currentTarget.closest<HTMLElement>('.transfer-source-text')?.setPointerCapture?.(event.pointerId);
    if (messageId) {
      updateMessageWordSelection(messageId, startOffset, endOffset, mode);
    } else {
      updateWordSelection(startOffset, endOffset, mode);
    }
  }

  function handleSourcePointerMove(event: PointerEvent<HTMLDivElement>) {
    const currentDragSelection = dragSelection.current;
    if (!currentDragSelection || currentDragSelection.pointerId !== event.pointerId) return;

    event.preventDefault();
    const wordRange = getWordRangeFromElement(document.elementFromPoint(event.clientX, event.clientY));
    if (!wordRange) return;
    if (wordRange.messageId) {
      updateMessageWordSelection(
        wordRange.messageId,
        wordRange.startOffset,
        wordRange.endOffset,
        currentDragSelection.mode
      );
    } else {
      updateWordSelection(wordRange.startOffset, wordRange.endOffset, currentDragSelection.mode);
    }
  }

  function endDragSelection(event: PointerEvent<HTMLDivElement>) {
    if (dragSelection.current?.pointerId === event.pointerId) {
      dragSelection.current = null;
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal transfer-modal">
        <header>
          <h2>{actionLabel} to</h2>
          <button className="icon-button bare" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="transfer-modal-grid">
          <div className="transfer-selection-panel">
            <div
              className="transfer-source-text"
              aria-label="Choose text to transfer"
              onPointerMove={handleSourcePointerMove}
              onPointerUp={endDragSelection}
              onPointerCancel={endDragSelection}
              onLostPointerCapture={endDragSelection}
            >
              {isSelectedBlockTransfer
                ? selectedMessages.map((message) => (
                    <div key={message.id} className="transfer-source-block">
                      {getTextTokens(message.text).map((token) =>
                        token.isWord ? (
                          <button
                            key={`${message.id}-${token.startOffset}-${token.endOffset}`}
                            className={`word-token ${
                              isMessageWordSelected(message.id, token.startOffset, token.endOffset) ? 'selected' : ''
                            }`}
                            type="button"
                            aria-pressed={isMessageWordSelected(message.id, token.startOffset, token.endOffset)}
                            data-transfer-word="true"
                            data-message-id={message.id}
                            data-start-offset={token.startOffset}
                            data-end-offset={token.endOffset}
                            onPointerDown={(event) =>
                              handleWordPointerDown(event, token.startOffset, token.endOffset, message.id)
                            }
                            onClick={(event) => {
                              if (handledPointerClick.current && event.detail !== 0) {
                                handledPointerClick.current = false;
                                return;
                              }
                              updateMessageWordSelection(message.id, token.startOffset, token.endOffset, 'toggle');
                            }}
                          >
                            {token.text}
                          </button>
                        ) : (
                          <span key={`${message.id}-${token.startOffset}-${token.endOffset}`}>{token.text}</span>
                        )
                      )}
                    </div>
                  ))
                : getTextTokens(sourceMessage?.text ?? '').map((token) =>
                    token.isWord ? (
                      <button
                        key={`${token.startOffset}-${token.endOffset}`}
                        className={`word-token ${isWordSelected(token.startOffset, token.endOffset) ? 'selected' : ''}`}
                        type="button"
                        aria-pressed={isWordSelected(token.startOffset, token.endOffset)}
                        data-transfer-word="true"
                        data-start-offset={token.startOffset}
                        data-end-offset={token.endOffset}
                        onPointerDown={(event) => handleWordPointerDown(event, token.startOffset, token.endOffset)}
                        onClick={(event) => {
                          if (handledPointerClick.current && event.detail !== 0) {
                            handledPointerClick.current = false;
                            return;
                          }
                          updateWordSelection(token.startOffset, token.endOffset, 'toggle');
                        }}
                      >
                        {token.text}
                      </button>
                    ) : (
                      <span key={`${token.startOffset}-${token.endOffset}`}>{token.text}</span>
                    )
                  )}
            </div>
            <div className="transfer-selection-summary">
              <span>
                {isSelectedBlockTransfer
                  ? selectedWordCount > 0
                    ? `${selectedWordCount} selected`
                    : `${selectedMessages.length} block${selectedMessages.length === 1 ? '' : 's'}`
                  : selectedWordCount > 0
                    ? `${selectedWordCount} selected`
                    : 'Whole block'}
              </span>
              {selectedWordCount > 0 && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setSelectionRanges([]);
                    setMessageSelectionRanges({});
                  }}
                >
                  Use whole block
                </button>
              )}
            </div>
            <p className="transfer-preview">{transferText}</p>
          </div>
          <div className="transfer-target-list">
            {conversations
              .filter((conversation) => conversation.id !== primarySourceMessage.conversationId)
              .map((conversation) => (
                <button
                  key={conversation.id}
                  className="target-row"
                  onClick={() => {
                    if (isSelectedBlockTransfer && selectedWordCount > 0) {
                      onForward(
                        conversation.id,
                        undefined,
                        buildMessageSelections(selectedMessages, messageSelectionRanges)
                      );
                      return;
                    }
                    onForward(
                      conversation.id,
                      !isSelectedBlockTransfer && selectionRanges.length > 0 ? selectionRanges : undefined
                    );
                  }}
                >
                  {conversation.title}
                </button>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
