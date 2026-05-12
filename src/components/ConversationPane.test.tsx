import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationPane } from './ConversationPane';
import type { Conversation, Message } from '../types';

const timestamp = {
  toDate: () => new Date('2026-05-12T12:00:00Z'),
  toMillis: () => 1
} as Conversation['createdAt'];

const conversation: Conversation = {
  id: 'conversation-1',
  userId: 'user-1',
  title: 'Inbox',
  createdAt: timestamp,
  updatedAt: timestamp,
  lastMessagePreview: ''
};

function message(id: string, text: string): Message {
  return {
    id,
    userId: 'user-1',
    conversationId: conversation.id,
    text,
    searchText: text.toLowerCase(),
    createdAt: timestamp,
    updatedAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null
  };
}

function renderPane(overrides: Partial<ComponentProps<typeof ConversationPane>> = {}) {
  const props: ComponentProps<typeof ConversationPane> = {
    activeConversation: conversation,
    activeMessages: [message('first', 'First'), message('second', 'Second')],
    draft: 'Ready to send',
    editingMessage: null,
    onBack: vi.fn(),
    onDraftChange: vi.fn(),
    onSubmitMessage: vi.fn(),
    onCancelEdit: vi.fn(),
    onEditMessage: vi.fn(),
    onForwardMessage: vi.fn(),
    onMoveToConversation: vi.fn(),
    onNavigateToSource: vi.fn(),
    onDeleteMessage: vi.fn(),
    onMoveMessage: vi.fn(),
    ...overrides
  };

  render(<ConversationPane {...props} />);
  return props;
}

describe('ConversationPane', () => {
  it('submits with Ctrl+Enter and Cmd+Enter but leaves plain Enter as a newline shortcut', () => {
    const props = renderPane();
    const composer = screen.getByPlaceholderText('Write a message');

    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(props.onSubmitMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(composer, { key: 'Enter', metaKey: true });

    expect(props.onSubmitMessage).toHaveBeenCalledTimes(2);
  });

  it('shows edit mode and allows canceling an edit', () => {
    const editingMessage = message('first', 'First');
    const props = renderPane({ editingMessage, draft: editingMessage.text });

    expect(screen.getByText('Editing message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Cancel edit'));

    expect(props.onCancelEdit).toHaveBeenCalled();
  });

  it('uses reorder controls with disabled edge buttons', () => {
    const props = renderPane();
    const moveUpButtons = screen.getAllByTitle('Move up');
    const moveDownButtons = screen.getAllByTitle('Move down');

    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons[1]).toBeDisabled();

    fireEvent.click(moveDownButtons[0]);
    fireEvent.click(moveUpButtons[1]);

    expect(props.onMoveMessage).toHaveBeenCalledWith(0, 1);
    expect(props.onMoveMessage).toHaveBeenCalledWith(1, -1);
  });
});
