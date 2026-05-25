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

    expect(onForward).toHaveBeenCalledWith('target', undefined);
  });

  it('ignores duplicate target clicks while a transfer is pending', () => {
    const onForward = vi.fn(() => new Promise<void>(() => undefined));

    render(
      <ForwardModal
        conversations={conversations}
        mode="move"
        sourceMessage={sourceMessage}
        onClose={vi.fn()}
        onForward={onForward}
      />
    );

    const targetButton = screen.getByRole('button', { name: 'Target' });
    fireEvent.click(targetButton);
    fireEvent.click(targetButton);

    expect(onForward).toHaveBeenCalledTimes(1);
    expect(targetButton).toBeDisabled();
  });

  it('selects words in the transfer dialog and forwards only that range', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'this' }));
    fireEvent.click(screen.getByRole('button', { name: 'Target' }));

    expect(onForward).toHaveBeenCalledWith('target', [
      {
        startOffset: 5,
        endOffset: 9
      }
    ]);
  });

  it('selects separate words in the transfer dialog', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    fireEvent.click(screen.getByRole('button', { name: 'Target' }));

    expect(onForward).toHaveBeenCalledWith('target', [
      {
        startOffset: 0,
        endOffset: 4
      },
      {
        startOffset: 10,
        endOffset: 19
      }
    ]);
  });

  it('deselects a selected word when clicked again', () => {
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

    const sendWord = screen.getByRole('button', { name: 'Send' });
    const thisWord = screen.getByRole('button', { name: 'this' });

    fireEvent.click(sendWord);
    fireEvent.click(thisWord);
    fireEvent.click(sendWord);
    fireEvent.click(screen.getByRole('button', { name: 'Target' }));

    expect(onForward).toHaveBeenCalledWith('target', [
      {
        startOffset: 5,
        endOffset: 9
      }
    ]);
  });

  it('selects words by dragging across them', () => {
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

    const sendWord = screen.getByRole('button', { name: 'Send' });
    const elsewhereWord = screen.getByRole('button', { name: 'elsewhere' });
    const sourceText = screen.getByLabelText('Choose text to transfer');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => elsewhereWord);

    fireEvent.pointerDown(sendWord, { pointerId: 1, clientX: 4, clientY: 4 });
    fireEvent.pointerMove(sourceText, { pointerId: 1, clientX: 40, clientY: 4 });
    fireEvent.pointerUp(sourceText, { pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Target' }));

    expect(onForward).toHaveBeenCalledWith('target', [
      {
        startOffset: 0,
        endOffset: 4
      },
      {
        startOffset: 10,
        endOffset: 19
      }
    ]);

    document.elementFromPoint = originalElementFromPoint;
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

  it('selects words from selected blocks and transfers only those parts', () => {
    const onForward = vi.fn();

    render(
      <ForwardModal
        conversations={conversations}
        mode="forward"
        sourceMessages={[
          sourceMessage,
          { ...sourceMessage, id: 'message-2', text: 'Second selected block', searchText: 'second selected block' }
        ]}
        onClose={vi.fn()}
        onForward={onForward}
      />
    );

    expect(screen.getByText('2 blocks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'this' }));
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));

    expect(screen.getByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Target' }));

    expect(onForward).toHaveBeenCalledWith('target', undefined, [
      { messageId: 'message-1', ranges: [{ startOffset: 5, endOffset: 9 }] },
      { messageId: 'message-2', ranges: [{ startOffset: 0, endOffset: 6 }] }
    ]);
  });
});
