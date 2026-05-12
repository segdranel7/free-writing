import { X } from 'lucide-react';
import type { Conversation, Message } from '../types';

type ForwardModalProps = {
  conversations: Conversation[];
  mode: 'forward' | 'move';
  sourceMessage: Message;
  onClose: () => void;
  onForward: (targetConversationId: string) => void;
};

export function ForwardModal({ conversations, mode, sourceMessage, onClose, onForward }: ForwardModalProps) {
  const actionLabel = mode === 'move' ? 'Move' : 'Forward';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal">
        <header>
          <h2>{actionLabel} to</h2>
          <button className="icon-button bare" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {conversations
          .filter((conversation) => conversation.id !== sourceMessage.conversationId)
          .map((conversation) => (
            <button key={conversation.id} className="target-row" onClick={() => onForward(conversation.id)}>
              {conversation.title}
            </button>
          ))}
      </section>
    </div>
  );
}
