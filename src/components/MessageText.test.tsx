import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageText } from './MessageText';
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

function message(text: string): Message {
  return {
    id: 'message-1',
    userId: 'user-1',
    conversationId: conversation.id,
    text,
    searchText: text.toLowerCase(),
    tags: [],
    references: [],
    createdAt: timestamp,
    updatedAt: null,
    scheduledAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null
  };
}

function renderMessageText(text: string, overrides: Partial<Parameters<typeof MessageText>[0]> = {}) {
  return render(
    <MessageText
      message={message(text)}
      activeReferenceTarget={null}
      conversations={[conversation]}
      onNavigateToConversation={vi.fn()}
      {...overrides}
    />
  );
}

describe('MessageText', () => {
  it('renders common Markdown structure without raw HTML parsing', () => {
    renderMessageText('# Plan\n\n- First item\n- Second item\n\n> Important note\n\n<script>alert("x")</script>');
    fireEvent.click(screen.getByRole('button', { name: 'Expand text block' }));

    expect(screen.getByRole('heading', { name: 'Plan', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByText('Second item')).toBeInTheDocument();
    expect(screen.getByText('Important note')).toBeInTheDocument();
    expect(screen.getByText('<script>alert("x")</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  it('preserves inline conversation links inside rendered Markdown', () => {
    const onNavigateToConversation = vi.fn();
    renderMessageText('- Open [[Inbox]]', { onNavigateToConversation });

    const list = screen.getByRole('list');
    fireEvent.click(within(list).getByRole('button', { name: 'Inbox' }));

    expect(onNavigateToConversation).toHaveBeenCalledWith('conversation-1');
  });

  it('uses the plain text path for highlighted reference ranges', () => {
    renderMessageText('# Plan', {
      activeReferenceTarget: {
        conversationId: conversation.id,
        messageId: 'message-1',
        range: { startOffset: 0, endOffset: 6 }
      }
    });

    expect(screen.queryByRole('heading', { name: 'Plan' })).not.toBeInTheDocument();
    expect(screen.getByText('# Plan')).toBeInTheDocument();
  });

  it('renders long text fully without expand controls in information-only mode', () => {
    renderMessageText('Line one\nLine two\nLine three\nHidden fourth line', {
      isInformationMode: true
    });

    expect(screen.getByText(/Hidden fourth line/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse text block' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand text block' })).not.toBeInTheDocument();
  });
});
