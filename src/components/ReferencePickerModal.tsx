import { Link2, Quote, X } from 'lucide-react';
import { useState } from 'react';
import type { Conversation, Message, MessageReference } from '../types';
import { createConversationReference, createQuoteReference } from '../utils/messageReferences';
import { getTextTokens } from '../utils/textSelection';

export type ReferencePickerMode = 'conversation' | 'quote';

type ReferencePickerModalProps = {
  mode: ReferencePickerMode;
  activeConversation: Conversation;
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  onAddReference: (reference: MessageReference) => void;
  onClose: () => void;
};

function getDefaultConversationId(
  mode: ReferencePickerMode,
  activeConversation: Conversation,
  conversations: Conversation[]
) {
  const defaultConversation =
    mode === 'quote'
      ? conversations.find((conversation) => conversation.id !== activeConversation.id)
      : conversations[0];

  return defaultConversation?.id ?? null;
}

export function ReferencePickerModal({
  mode,
  activeConversation,
  conversations,
  messagesByConversation,
  onAddReference,
  onClose
}: ReferencePickerModalProps) {
  const [referenceConversationId, setReferenceConversationId] = useState<string | null>(() =>
    getDefaultConversationId(mode, activeConversation, conversations)
  );
  const [referenceMessageId, setReferenceMessageId] = useState<string | null>(null);
  const [referenceSelection, setReferenceSelection] = useState({ start: 0, end: 0 });

  const referenceConversation =
    conversations.find((conversation) => conversation.id === referenceConversationId) ?? null;
  const referenceMessages = referenceConversationId ? messagesByConversation[referenceConversationId] ?? [] : [];
  const referenceMessage = referenceMessages.find((message) => message.id === referenceMessageId) ?? null;

  function selectConversation(conversationId: string) {
    setReferenceConversationId(conversationId);
    setReferenceMessageId(null);
    setReferenceSelection({ start: 0, end: 0 });
  }

  function addConversationReference() {
    if (!referenceConversation) return;
    onAddReference(createConversationReference(referenceConversation));
  }

  function addQuoteReference() {
    if (!referenceConversation || !referenceMessage) return;
    const reference = createQuoteReference(
      referenceConversation,
      referenceMessage,
      referenceSelection.start,
      referenceSelection.end
    );
    if (reference) onAddReference(reference);
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

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal reference-picker"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'quote' ? 'Cite text' : 'Add conversation link'}
      >
        <header className="modal-header">
          <h3>{mode === 'quote' ? 'Cite text' : 'Add conversation link'}</h3>
          <button className="icon-button bare" type="button" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="reference-picker-grid">
          <div className="reference-picker-list">
            {conversations
              .filter((conversation) => mode !== 'quote' || conversation.id !== activeConversation.id)
              .map((conversation) => (
                <button
                  key={conversation.id}
                  className={`reference-picker-row ${referenceConversationId === conversation.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                >
                  {conversation.title}
                </button>
              ))}
          </div>

          {mode === 'quote' ? (
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
                          token.startOffset >= referenceSelection.start && token.endOffset <= referenceSelection.end
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
  );
}
