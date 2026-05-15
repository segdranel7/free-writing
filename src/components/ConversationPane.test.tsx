import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    onSaveEdit: vi.fn(),
    onForwardMessage: vi.fn(),
    onMoveToConversation: vi.fn(),
    onNavigateToSource: vi.fn(),
    onDeleteMessage: vi.fn(),
    onMoveMessage: vi.fn(),
    onReorderMessage: vi.fn(),
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

function mockObjectUrls() {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const createObjectURL = vi.fn(() => 'blob:image-preview');
  const revokeObjectURL = vi.fn();
  Object.assign(URL, {
    createObjectURL,
    revokeObjectURL
  });

  return {
    createObjectURL,
    revokeObjectURL,
    restore: () => {
      Object.assign(URL, {
        createObjectURL: originalCreateObjectURL,
        revokeObjectURL: originalRevokeObjectURL
      });
    }
  };
}

describe('ConversationPane', () => {
  it('adds image files to a message from the composer', async () => {
    const objectUrls = mockObjectUrls();
    const image = new File(['image-bytes'], 'draft.png', { type: 'image/png' });
    const onSubmitMessage = vi.fn(async () => undefined);

    renderPane({ draft: '', onSubmitMessage });

    fireEvent.change(screen.getByLabelText('Add images'), {
      target: { files: [image] }
    });

    expect(await screen.findByAltText('draft.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith(undefined, [image]);
    });
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith('blob:image-preview');

    objectUrls.restore();
  });

  it('adds copied images when pasted into the composer', async () => {
    const objectUrls = mockObjectUrls();
    const image = new File(['image-bytes'], 'copied.png', { type: 'image/png' });
    const composer = renderPane({ draft: '' });

    fireEvent.paste(screen.getByPlaceholderText('Write a message'), {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => image
          }
        ],
        files: []
      }
    });

    expect(await screen.findByAltText('copied.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(composer.onSubmitMessage).toHaveBeenCalledWith(undefined, [image]);
    });

    objectUrls.restore();
  });

  it('pastes copied images from the clipboard button for touch devices', async () => {
    const objectUrls = mockObjectUrls();
    const originalClipboard = navigator.clipboard;
    const read = vi.fn(async () => [
      {
        types: ['image/png'],
        getType: vi.fn(async () => new Blob(['image-bytes'], { type: 'image/png' }))
      }
    ]);
    Object.assign(navigator, {
      clipboard: { read }
    });
    const composer = renderPane({ draft: '' });

    fireEvent.click(screen.getByTitle('Paste image'));

    expect(await screen.findByAltText('pasted-image.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(composer.onSubmitMessage).toHaveBeenCalledWith(undefined, [
        expect.objectContaining({ name: 'pasted-image.png', type: 'image/png' })
      ]);
    });

    Object.assign(navigator, {
      clipboard: originalClipboard
    });
    objectUrls.restore();
  });

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

  it('opens draft English conversion with Ctrl+Enter and Cmd+Enter but leaves plain Enter as a newline shortcut', async () => {
    const onConvertToEnglish = vi.fn(async () => ({
      segments: [
        {
          original: 'Ready to send',
          options: ['Ready to send', 'Ready to submit', 'Prepared to send'] as [string, string, string]
        }
      ]
    }));
    const props = renderPane({ onConvertToEnglish });
    const composer = screen.getByPlaceholderText('Write a message');

    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(props.onSubmitMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: 'Enter', ctrlKey: true });

    expect(onConvertToEnglish).toHaveBeenCalledWith('Ready to send');
    expect(await screen.findByRole('dialog', { name: 'Choose English versions' })).toBeInTheDocument();
    expect(props.onSubmitMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Close'));
    fireEvent.keyDown(composer, { key: 'Enter', metaKey: true });

    expect(onConvertToEnglish).toHaveBeenCalledTimes(2);
  });

  it('keeps the composer for new messages while editing a block inline', () => {
    const editingMessage = message('first', 'First');
    const onSaveEdit = vi.fn();
    const props = renderPane({ editingMessage, draft: 'New message draft', onSaveEdit });
    const composer = screen.getByPlaceholderText('Write a message');
    const editor = screen.getByLabelText('Edit message text');

    expect(composer).toHaveValue('New message draft');
    expect(editor).toHaveValue('First');

    fireEvent.change(editor, { target: { value: 'Edited first block' } });
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });

    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'Edited first block', []);
    expect(props.onSubmitMessage).not.toHaveBeenCalled();
  });

  it('adds pasted images while editing a block inline', async () => {
    const objectUrls = mockObjectUrls();
    const editingMessage = message('first', 'First');
    const image = new File(['image-bytes'], 'edited.png', { type: 'image/png' });
    const onSaveEdit = vi.fn(async () => undefined);
    renderPane({ editingMessage, onSaveEdit });
    const editor = screen.getByLabelText('Edit message text');

    fireEvent.paste(editor, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => image
          }
        ],
        files: []
      }
    });

    expect(await screen.findByAltText('edited.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'First', [image]);
    });

    objectUrls.restore();
  });

  it('shows edit mode and allows canceling an edit', () => {
    const editingMessage = message('first', 'First');
    const props = renderPane({ editingMessage });

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

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

  it('reorders blocks by dragging one block onto another', () => {
    const props = renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;

    fireEvent.dragStart(firstBlock, {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        getData: vi.fn(() => 'first')
      }
    });
    fireEvent.dragOver(secondBlock, {
      dataTransfer: {
        dropEffect: ''
      }
    });
    fireEvent.drop(secondBlock, {
      dataTransfer: {
        getData: vi.fn(() => 'first')
      }
    });

    expect(props.onReorderMessage).toHaveBeenCalledWith('first', 'second');
  });

  it('keeps desktop drag active if the browser cancels the pointer during native drag', () => {
    renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;

    fireEvent.dragStart(firstBlock, {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        getData: vi.fn(() => 'first')
      }
    });
    fireEvent.pointerCancel(firstBlock, {
      pointerId: 1,
      pointerType: 'mouse'
    });
    fireEvent.dragOver(secondBlock, {
      dataTransfer: {
        dropEffect: ''
      }
    });

    expect(secondBlock).toHaveClass('drag-over');
  });

  it('reorders blocks with touch pointer dragging', () => {
    const props = renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = vi.fn(() => secondBlock);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });

    fireEvent.pointerDown(firstBlock, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 12,
      clientY: 12
    });
    fireEvent.pointerMove(firstBlock, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 14,
      clientY: 38
    });
    fireEvent.pointerUp(firstBlock, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 14,
      clientY: 38
    });

    expect(elementFromPoint).toHaveBeenCalledWith(14, 38);
    expect(props.onReorderMessage).toHaveBeenCalledWith('first', 'second');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
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

  it('does not show a source marker when the block text has no source marker', () => {
    renderPane({
      activeMessages: [
        {
          ...message('first', 'Forwarded text without a marker'),
          forwardedFromConversationId: 'source-conversation',
          forwardedFromMessageId: 'source-message'
        }
      ]
    });

    expect(screen.queryByRole('button', { name: 'Source' })).not.toBeInTheDocument();
  });

  it('shows the source marker when source metadata and the text marker are present', () => {
    const props = renderPane({
      activeMessages: [
        {
          ...message('first', 'Forwarded text <-source'),
          forwardedFromConversationId: 'source-conversation',
          forwardedFromMessageId: 'source-message'
        }
      ]
    });

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));

    expect(props.onNavigateToSource).toHaveBeenCalledWith('source-conversation');
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

  it('converts draft text to English and sends the selected text directly', async () => {
    const onDraftChange = vi.fn();
    const onSubmitMessage = vi.fn(async () => undefined);
    const onConvertToEnglish = vi.fn(async () => ({
      segments: [
        {
          original: 'Pronto para enviar',
          options: ['Ready to send', 'Ready to submit', 'Prepared to send'] as [string, string, string]
        }
      ]
    }));
    renderPane({ draft: 'Pronto para enviar', onDraftChange, onSubmitMessage, onConvertToEnglish });

    fireEvent.click(screen.getByTitle('Convert draft to English'));
    fireEvent.click(await screen.findByLabelText('Ready to submit'));
    fireEvent.click(screen.getByRole('button', { name: 'Send English' }));

    expect(onConvertToEnglish).toHaveBeenCalledWith('Pronto para enviar');
    expect(onSubmitMessage).toHaveBeenCalledWith('Ready to submit');
    expect(onDraftChange).not.toHaveBeenCalled();
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
