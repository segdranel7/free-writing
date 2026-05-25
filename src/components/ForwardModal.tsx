import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Conversation, Message } from '../types';
import {
  getSelectedTextFromRanges,
  getTextTokens,
  type TextSelectionRange,
} from '../utils/textSelection';
import { useWordRangeSelection } from '../hooks/useWordRangeSelection';
import type { MessageSelection } from '../utils/transferActions';
import {
  buildMessageSelections,
  getMessageSelectionRangeCount,
  getSelectedMessageText,
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
    messageSelections?: MessageSelection[],
  ) => void | Promise<void>;
};

export function ForwardModal({
  conversations,
  mode,
  sourceMessage,
  sourceMessages = [],
  onClose,
  onForward,
}: ForwardModalProps) {
  const [isForwarding, setIsForwarding] = useState(false);
  const [transferError, setTransferError] = useState('');
  const isForwardingRef = useRef(false);
  const actionLabel = mode === 'move' ? 'Move' : 'Forward';
  const selectedMessages =
    sourceMessages.length > 0
      ? sourceMessages
      : sourceMessage
        ? [sourceMessage]
        : [];
  const primarySourceMessage = selectedMessages[0];
  const isSelectedBlockTransfer = sourceMessages.length > 0;
  const {
    selectionRanges,
    messageSelectionRanges,
    clearSelection,
    isSelected,
    handleWordPointerDown,
    handlePointerMove,
    endDragSelection,
    handleWordClick,
  } = useWordRangeSelection({
    wordSelector: '[data-transfer-word="true"]',
    captureSelector: '.transfer-source-text',
  });
  const selectedText = sourceMessage
    ? getSelectedTextFromRanges(sourceMessage.text, selectionRanges)
    : '';
  const selectedMessageText = getSelectedMessageText(
    selectedMessages,
    messageSelectionRanges,
  );
  const transferText = isSelectedBlockTransfer
    ? selectedMessageText ||
      selectedMessages
        .map((message) => message.text.trim())
        .filter(Boolean)
        .join('\n\n')
    : selectedText || (sourceMessage?.text ?? '');
  const selectedWordCount = isSelectedBlockTransfer
    ? getMessageSelectionRangeCount(messageSelectionRanges)
    : selectionRanges.length;

  if (!primarySourceMessage) return null;

  async function forwardToConversation(targetConversationId: string) {
    if (isForwardingRef.current) return;
    isForwardingRef.current = true;
    setIsForwarding(true);
    setTransferError('');

    try {
      if (isSelectedBlockTransfer && selectedWordCount > 0) {
        await onForward(
          targetConversationId,
          undefined,
          buildMessageSelections(
            selectedMessages,
            messageSelectionRanges,
          ),
        );
        return;
      }

      await onForward(
        targetConversationId,
        !isSelectedBlockTransfer && selectionRanges.length > 0
          ? selectionRanges
          : undefined,
      );
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : `Unable to ${actionLabel.toLowerCase()} this block.`);
    } finally {
      isForwardingRef.current = false;
      setIsForwarding(false);
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
              onPointerMove={handlePointerMove}
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
                              isSelected(
                                token.startOffset,
                                token.endOffset,
                                message.id,
                              )
                                ? 'selected'
                                : ''
                            }`}
                            type="button"
                            aria-pressed={isSelected(
                              token.startOffset,
                              token.endOffset,
                              message.id,
                            )}
                            data-transfer-word="true"
                            data-message-id={message.id}
                            data-start-offset={token.startOffset}
                            data-end-offset={token.endOffset}
                            onPointerDown={(event) =>
                              handleWordPointerDown(
                                event,
                                token.startOffset,
                                token.endOffset,
                                message.id,
                              )
                            }
                            onClick={(event) =>
                              handleWordClick(
                                token.startOffset,
                                token.endOffset,
                                event.detail,
                                message.id,
                              )
                            }
                          >
                            {token.text}
                          </button>
                        ) : (
                          <span
                            key={`${message.id}-${token.startOffset}-${token.endOffset}`}
                          >
                            {token.text}
                          </span>
                        ),
                      )}
                    </div>
                  ))
                : getTextTokens(sourceMessage?.text ?? '').map((token) =>
                    token.isWord ? (
                      <button
                        key={`${token.startOffset}-${token.endOffset}`}
                        className={`word-token ${isSelected(token.startOffset, token.endOffset) ? 'selected' : ''}`}
                        type="button"
                        aria-pressed={isSelected(
                          token.startOffset,
                          token.endOffset,
                        )}
                        data-transfer-word="true"
                        data-start-offset={token.startOffset}
                        data-end-offset={token.endOffset}
                        onPointerDown={(event) =>
                          handleWordPointerDown(
                            event,
                            token.startOffset,
                            token.endOffset,
                          )
                        }
                        onClick={(event) =>
                          handleWordClick(
                            token.startOffset,
                            token.endOffset,
                            event.detail,
                          )
                        }
                      >
                        {token.text}
                      </button>
                    ) : (
                      <span key={`${token.startOffset}-${token.endOffset}`}>
                        {token.text}
                      </span>
                    ),
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
                  onClick={clearSelection}
                >
                  Use whole block
                </button>
              )}
            </div>
            <p className="transfer-preview">{transferText}</p>
            {transferError && (
              <p className="notice error" role="alert">
                {transferError}
              </p>
            )}
          </div>
          <div className="transfer-target-list">
            {conversations
              .filter(
                (conversation) =>
                  conversation.id !== primarySourceMessage.conversationId,
              )
              .map((conversation) => (
                <button
                  key={conversation.id}
                  className="target-row"
                  disabled={isForwarding}
                  onClick={() => void forwardToConversation(conversation.id)}
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
