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
    onMergeMessages: vi.fn(async () => undefined),
    onConvertToEnglish: vi.fn(async (_text: string) => ({
      segments: [
        {
          original: 'First',
          options: ['First option one', 'First option two', 'First option three'] as [string, string, string]
        }
      ]
    })),
    onCreateEnglishBlock: vi.fn(async () => undefined),
    onReplaceWithEnglish: vi.fn(async () => undefined),
    ...overrides
  };

  render(<ConversationPane {...props} />);
  return props;
}

describe('ConversationPane', () => {
  it('copies message text with one click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    renderPane();

    fireEvent.click(screen.getAllByTitle('Copy text')[0]);

    expect(writeText).toHaveBeenCalledWith('First');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('shows copy feedback when clipboard writes fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    renderPane();

    fireEvent.click(screen.getAllByTitle('Copy text')[0]);

    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('Unable to copy message text.', expect.any(Error));

    consoleError.mockRestore();
  });

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

  it('selects multiple blocks and merges them in visible order', async () => {
    const onMergeMessages = vi.fn(async () => undefined);
    renderPane({ onMergeMessages });

    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Select block: First'));
    fireEvent.click(screen.getByLabelText('Select block: Second'));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(onMergeMessages).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'first' }),
      expect.objectContaining({ id: 'second' })
    ]);
  });

  it('opens the English picker and defaults to the first option for each segment', async () => {
    const props = renderPane({
      onConvertToEnglish: vi.fn(async () => ({
        segments: [
          {
            original: 'Olá mundo',
            options: ['Hello world', 'Hi world', 'Hello, everyone'] as [string, string, string]
          },
          {
            original: 'Tudo bem',
            options: ['All good', 'Everything is fine', 'Is everything okay'] as [string, string, string]
          }
        ]
      }))
    });

    fireEvent.click(screen.getAllByTitle('Convert to English')[0]);

    expect(props.onConvertToEnglish).toHaveBeenCalledWith('First');
    expect(await screen.findByRole('dialog', { name: 'Choose English versions' })).toBeInTheDocument();
    expect(screen.queryByText('Olá mundo')).not.toBeInTheDocument();
    expect(screen.queryByText('Tudo bem')).not.toBeInTheDocument();
    expect(screen.queryByText('Part 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Part 2')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hello world')).toBeChecked();
    expect(screen.getByLabelText('All good')).toBeChecked();
    expect(screen.getByText('Hello world All good')).toBeInTheDocument();
  });

  it('creates a new English block from the selected options', async () => {
    const onCreateEnglishBlock = vi.fn(async () => undefined);
    renderPane({
      onCreateEnglishBlock,
      onConvertToEnglish: vi.fn(async () => ({
        segments: [
          {
            original: 'Primeiro',
            options: ['First default', 'First selected', 'First formal'] as [string, string, string]
          },
          {
            original: 'Segundo',
            options: ['Second default', 'Second selected', 'Second formal'] as [string, string, string]
          }
        ]
      }))
    });

    fireEvent.click(screen.getAllByTitle('Convert to English')[0]);
    fireEvent.click(await screen.findByLabelText('First selected'));
    fireEvent.click(screen.getByLabelText('Second selected'));
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }));

    expect(onCreateEnglishBlock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'first' }),
      'First selected Second selected'
    );
  });

  it('can replace the source block with the selected English text', async () => {
    const onReplaceWithEnglish = vi.fn(async () => undefined);
    renderPane({
      onReplaceWithEnglish,
      onConvertToEnglish: vi.fn(async () => ({
        segments: [
          {
            original: 'Primeiro',
            options: ['First default', 'First replacement', 'First formal'] as [string, string, string]
          }
        ]
      }))
    });

    fireEvent.click(screen.getAllByTitle('Convert to English')[0]);
    fireEvent.click(await screen.findByLabelText('First replacement'));
    fireEvent.click(screen.getByRole('button', { name: 'Replace block' }));

    expect(onReplaceWithEnglish).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'first' }),
      'First replacement'
    );
  });

  it('converts draft text to English before sending', async () => {
    const onDraftChange = vi.fn();
    const onConvertToEnglish = vi.fn(async () => ({
      segments: [
        {
          original: 'Pronto para enviar',
          options: ['Ready to send', 'Ready to submit', 'Prepared to send'] as [string, string, string]
        }
      ]
    }));
    renderPane({ draft: 'Pronto para enviar', onDraftChange, onConvertToEnglish });

    fireEvent.click(screen.getByTitle('Convert draft to English'));
    fireEvent.click(await screen.findByLabelText('Ready to submit'));
    fireEvent.click(screen.getByRole('button', { name: 'Use in draft' }));

    expect(onConvertToEnglish).toHaveBeenCalledWith('Pronto para enviar');
    expect(onDraftChange).toHaveBeenCalledWith('Ready to submit');
  });

  it('shows a clear error when English conversion fails', async () => {
    renderPane({
      onConvertToEnglish: vi.fn(async () => {
        throw new Error('Translation service unavailable');
      })
    });

    fireEvent.click(screen.getAllByTitle('Convert to English')[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Translation service unavailable');
    expect(screen.getByRole('button', { name: 'Create block' })).toBeDisabled();
  });
});
