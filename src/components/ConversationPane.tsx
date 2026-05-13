import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Edit3, Forward, MoreVertical, MoveRight, Reply, Trash2, X } from 'lucide-react';
import type { Conversation, Message } from '../types';
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
};

const COPY_FEEDBACK_TIMEOUT_MS = 1600;

type CopyFeedback = {
  messageId: string;
  status: 'copied' | 'failed';
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
  onMoveMessage
}: ConversationPaneProps) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);

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
