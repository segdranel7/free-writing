import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Edit3, Forward, Languages, MoreVertical, MoveRight, Reply, Trash2, X } from 'lucide-react';
import type { Conversation, EnglishConversion, Message } from '../types';
import { formatDate } from '../utils/date';

type ConversationPaneProps = {
  activeConversation: Conversation | null;
  activeMessages: Message[];
  draft: string;
  editingMessage: Message | null;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onSubmitMessage: () => void;
  onCancelEdit: () => void;
  onEditMessage: (message: Message) => void;
  onForwardMessage: (message: Message) => void;
  onMoveToConversation: (message: Message) => void;
  onNavigateToSource: (conversationId: string) => void;
  onDeleteMessage: (message: Message) => void;
  onMoveMessage: (messageIndex: number, direction: -1 | 1) => void;
  onConvertToEnglish: (message: Message) => Promise<EnglishConversion>;
  onCreateEnglishBlock: (message: Message, text: string) => Promise<void>;
};

const COPY_FEEDBACK_TIMEOUT_MS = 1600;

type CopyFeedback = {
  messageId: string;
  status: 'copied' | 'failed';
};

type EnglishPickerState = {
  message: Message;
  status: 'loading' | 'ready' | 'saving' | 'error';
  conversion: EnglishConversion | null;
  selections: number[];
  error: string | null;
};

function getTransferLabel(message: Message) {
  if (message.transferType === 'moved') return 'Moved';
  if (message.transferType === 'forwarded' || message.isForwarded) return 'Forwarded';
  return null;
}

function getCopyFeedbackLabel(feedback: CopyFeedback) {
  return feedback.status === 'copied' ? 'Copied' : 'Copy failed';
}

export function ConversationPane({
  activeConversation,
  activeMessages,
  draft,
  editingMessage,
  onBack,
  onDraftChange,
  onSubmitMessage,
  onCancelEdit,
  onEditMessage,
  onForwardMessage,
  onMoveToConversation,
  onNavigateToSource,
  onDeleteMessage,
  onMoveMessage,
  onConvertToEnglish,
  onCreateEnglishBlock
}: ConversationPaneProps) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const [englishPicker, setEnglishPicker] = useState<EnglishPickerState | null>(null);

  useEffect(() => {
    if (!copyFeedback) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCopyFeedback((currentFeedback) =>
        currentFeedback?.messageId === copyFeedback.messageId ? null : currentFeedback
      );
    }, COPY_FEEDBACK_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [copyFeedback]);

  async function copyMessageText(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopyFeedback({ messageId: message.id, status: 'copied' });
    } catch (error) {
      console.error('Unable to copy message text.', error);
      setCopyFeedback({ messageId: message.id, status: 'failed' });
    }
  }

  async function openEnglishPicker(message: Message) {
    setEnglishPicker({
      message,
      status: 'loading',
      conversion: null,
      selections: [],
      error: null
    });

    try {
      const conversion = await onConvertToEnglish(message);
      setEnglishPicker({
        message,
        status: 'ready',
        conversion,
        selections: conversion.segments.map(() => 0),
        error: null
      });
    } catch (error) {
      setEnglishPicker({
        message,
        status: 'error',
        conversion: null,
        selections: [],
        error: error instanceof Error ? error.message : 'Unable to convert this text to English.'
      });
    }
  }

  function updateEnglishSelection(segmentIndex: number, optionIndex: number) {
    setEnglishPicker((current) => {
      if (!current) return current;
      const selections = [...current.selections];
      selections[segmentIndex] = optionIndex;
      return { ...current, selections };
    });
  }

  function getAssembledEnglishText(state: EnglishPickerState) {
    if (!state.conversion) return '';
    return state.conversion.segments
      .map((segment, segmentIndex) => segment.options[state.selections[segmentIndex] ?? 0])
      .join(' ')
      .trim();
  }

  async function createEnglishBlock() {
    if (!englishPicker || !englishPicker.conversion) return;
    const englishText = getAssembledEnglishText(englishPicker);
    if (!englishText) return;

    setEnglishPicker({ ...englishPicker, status: 'saving', error: null });
    try {
      await onCreateEnglishBlock(englishPicker.message, englishText);
      setEnglishPicker(null);
    } catch (error) {
      setEnglishPicker({
        ...englishPicker,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to create the English block.'
      });
    }
  }

  return (
    <section className={`conversation-pane ${activeConversation ? 'open' : ''}`}>
      {activeConversation ? (
        <>
          <header className="conversation-header">
            <button className="icon-button back-button" title="Back" onClick={onBack}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2>{activeConversation.title}</h2>
              <p>{activeMessages.length} messages</p>
            </div>
          </header>

          <div className="messages">
            {activeMessages.map((message, messageIndex) => (
              <article className="message-bubble" key={message.id}>
                <div className="message-meta">
                  {getTransferLabel(message) && <span>{getTransferLabel(message)}</span>}
                  {message.forwardedFromConversationId && (
                    <button
                      className="source-link"
                      title="Open source conversation"
                      onClick={() => onNavigateToSource(message.forwardedFromConversationId as string)}
                    >
                      <Reply size={13} />
                      Source
                    </button>
                  )}
                  {message.updatedAt && <span>edited</span>}
                  <time>{formatDate(message.createdAt)}</time>
                </div>
                <p>{message.text}</p>
                <div className="message-actions">
                  <div className="reorder-actions" aria-label="Reorder message">
                    <button
                      className="icon-button bare"
                      title="Move up"
                      disabled={messageIndex === 0}
                      onClick={() => onMoveMessage(messageIndex, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="icon-button bare"
                      title="Move down"
                      disabled={messageIndex === activeMessages.length - 1}
                      onClick={() => onMoveMessage(messageIndex, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button className="icon-button bare" title="Edit" onClick={() => onEditMessage(message)}>
                    <Edit3 size={16} />
                  </button>
                  <button className="icon-button bare" title="Copy text" onClick={() => void copyMessageText(message)}>
                    <Copy size={16} />
                  </button>
                  <button className="icon-button bare" title="Convert to English" onClick={() => void openEnglishPicker(message)}>
                    <Languages size={16} />
                  </button>
                  {copyFeedback?.messageId === message.id && (
                    <span className="copy-status" aria-live="polite">
                      {getCopyFeedbackLabel(copyFeedback)}
                    </span>
                  )}
                  <button className="icon-button bare" title="Forward" onClick={() => onForwardMessage(message)}>
                    <Forward size={16} />
                  </button>
                  <button className="icon-button bare" title="Move to conversation" onClick={() => onMoveToConversation(message)}>
                    <MoveRight size={16} />
                  </button>
                  <button className="icon-button bare" title="Delete" onClick={() => onDeleteMessage(message)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {activeMessages.length === 0 && <p className="empty-state">Write the first message here.</p>}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitMessage();
            }}
          >
            {editingMessage && (
              <div className="editing-strip">
                Editing message
                <button className="icon-button bare" type="button" title="Cancel edit" onClick={onCancelEdit}>
                  <X size={16} />
                </button>
              </div>
            )}
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  onSubmitMessage();
                }
              }}
              placeholder="Write a message"
              rows={2}
            />
            <button className="primary-button send-button" disabled={!draft.trim()}>
              {editingMessage ? 'Save' : 'Send'}
            </button>
          </form>

          {englishPicker && (
            <div className="modal-backdrop" role="presentation">
              <section className="english-picker" role="dialog" aria-modal="true" aria-labelledby="english-picker-title">
                <header className="english-picker-header">
                  <div>
                    <p className="eyebrow">English conversion</p>
                    <h3 id="english-picker-title">Choose English versions</h3>
                  </div>
                  <button className="icon-button bare" type="button" title="Close" onClick={() => setEnglishPicker(null)}>
                    <X size={18} />
                  </button>
                </header>

                {englishPicker.status === 'loading' && <p className="picker-status">Preparing English options...</p>}

                {englishPicker.error && (
                  <p className="notice error" role="alert">
                    {englishPicker.error}
                  </p>
                )}

                {englishPicker.conversion && (
                  <>
                    <div className="english-segments">
                      {englishPicker.conversion.segments.map((segment, segmentIndex) => (
                        <fieldset className="english-segment" key={`${segment.original}-${segmentIndex}`}>
                          <legend>{segment.original}</legend>
                          {segment.options.map((option, optionIndex) => (
                            <label className="english-option" key={option}>
                              <input
                                type="radio"
                                name={`english-segment-${segmentIndex}`}
                                checked={(englishPicker.selections[segmentIndex] ?? 0) === optionIndex}
                                onChange={() => updateEnglishSelection(segmentIndex, optionIndex)}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </fieldset>
                      ))}
                    </div>

                    <div className="english-preview">
                      <p className="eyebrow">New block preview</p>
                      <p>{getAssembledEnglishText(englishPicker)}</p>
                    </div>
                  </>
                )}

                <footer className="english-picker-actions">
                  <button className="text-button" type="button" onClick={() => setEnglishPicker(null)}>
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!englishPicker.conversion || englishPicker.status === 'saving'}
                    onClick={() => void createEnglishBlock()}
                  >
                    {englishPicker.status === 'saving' ? 'Creating...' : 'Create block'}
                  </button>
                </footer>
              </section>
            </div>
          )}
        </>
      ) : (
        <div className="no-selection">
          <MoreVertical size={26} />
          <p>Select or create a conversation.</p>
        </div>
      )}
    </section>
  );
}
