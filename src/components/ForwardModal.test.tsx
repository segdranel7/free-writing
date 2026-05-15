import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForwardModal } from './ForwardModal';
import type { Conversation, Message } from '../types';

const timestamp = { toMillis: () => 1 } as Conversation['createdAt'];

const conversations: Conversation[] = [
  {
    id: 'source',
    userId: 'user-1',
    title: 'Source',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: ''
  },
  {
    id: 'target',
    userId: 'user-1',
    title: 'Target',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: ''
  }
];

const sourceMessage: Message = {
  id: 'message-1',
  userId: 'user-1',
  conversationId: 'source',
  text: 'Send this elsewhere',
  searchText: 'send this elsewhere',
  references: [],
  createdAt: timestamp,
  updatedAt: null,
  sortOrder: 1000,
  isForwarded: false,
  transferType: null,
  forwardedFromConversationId: null,
  forwardedFromMessageId: null
};

describe('ForwardModal', () => {
  it('filters out the source conversation and selects a valid target', () => {
    const onForward = vi.fn();

    render(
      <ForwardModal
        conversations={conversations}
        mode="forward"
        sourceMessage={sourceMessage}
        onClose={vi.fn()}
        onForward={onForward}
      />
    );

    expect(screen.queryByRole('button', { name: 'Source' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Target' }));

    expect(onForward).toHaveBeenCalledWith('target');
  });

  it('uses move labeling and closes from the icon button', () => {
    const onClose = vi.fn();

    render(
      <ForwardModal
        conversations={conversations}
        mode="move"
        sourceMessage={sourceMessage}
        onClose={onClose}
        onForward={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Move to' })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
