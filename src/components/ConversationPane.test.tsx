import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    references: [],
    createdAt: timestamp,
    updatedAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromMessageId: null
  };
}

function imageMessage(id: string, text = ''): Message {
  return {
    ...message(id, text),
    attachments: [
      {
        id: `${id}-image`,
        type: 'image',
        url: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        name: 'note.png',
        contentType: 'image/png',
        size: 11
      }
    ]
  };
}

function renderPane(overrides: Partial<ComponentProps<typeof ConversationPane>> = {}) {
  const props: ComponentProps<typeof ConversationPane> = {
    activeConversation: conversation,
    conversations: [conversation],
    activeMessages: [message('first', 'First'), message('second', 'Second')],
    messagesByConversation: {
      [conversation.id]: [message('first', 'First'), message('second', 'Second')]
    },
    navigationTarget: null,
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
    onForwardMessages: vi.fn(),
    onMoveMessages: vi.fn(),
    onNavigateToReference: vi.fn(),
    onNavigationHandled: vi.fn(),
    onDeleteMessage: vi.fn(),
    onDeleteMessages: vi.fn(async () => undefined),
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
      expect(onSubmitMessage).toHaveBeenCalledWith(undefined, [image], []);
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
      expect(composer.onSubmitMessage).toHaveBeenCalledWith(undefined, [image], []);
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
      ], []);
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

  it('copies text and attached images as rich clipboard content', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const originalClipboardItem = globalThis.ClipboardItem;
    const clipboardItems: Array<Record<string, Blob>> = [];
    class MockClipboardItem {
      constructor(items: Record<string, Blob>) {
        clipboardItems.push(items);
      }
    }
    Object.assign(globalThis, { ClipboardItem: MockClipboardItem });
    Object.assign(navigator, {
      clipboard: { write, writeText: vi.fn() }
    });

    renderPane({
      activeMessages: [imageMessage('first', 'First\nline two')],
      messagesByConversation: {
        [conversation.id]: [imageMessage('first', 'First\nline two')]
      }
    });

    fireEvent.click(screen.getByTitle('Copy block'));

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith([expect.any(MockClipboardItem)]);
    });
    expect(clipboardItems[0]['text/plain']).toEqual(expect.any(Blob));
    expect(clipboardItems[0]['text/html']).toEqual(expect.any(Blob));
    expect(clipboardItems[0]['image/png']).toEqual(expect.any(Blob));
    await expect(clipboardItems[0]['text/plain'].text()).resolves.toBe('First\nline two');
    await expect(clipboardItems[0]['text/html'].text()).resolves.toContain('<img src="data:image/png;base64,aW1hZ2UtYnl0ZXM="');
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    Object.assign(globalThis, { ClipboardItem: originalClipboardItem });
  });

  it('copies image-only blocks as rich clipboard content', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const originalClipboardItem = globalThis.ClipboardItem;
    const clipboardItems: Array<Record<string, Blob>> = [];
    class MockClipboardItem {
      constructor(items: Record<string, Blob>) {
        clipboardItems.push(items);
      }
    }
    Object.assign(globalThis, { ClipboardItem: MockClipboardItem });
    Object.assign(navigator, {
      clipboard: { write, writeText: vi.fn() }
    });

    renderPane({
      activeMessages: [imageMessage('image-only')],
      messagesByConversation: {
        [conversation.id]: [imageMessage('image-only')]
      }
    });

    const copyButton = screen.getByTitle('Copy block');
    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith([expect.any(MockClipboardItem)]);
    });
    expect(clipboardItems[0]['text/plain']).toEqual(expect.any(Blob));
    expect(clipboardItems[0]['text/html']).toEqual(expect.any(Blob));
    expect(clipboardItems[0]['image/png']).toEqual(expect.any(Blob));
    await expect(clipboardItems[0]['text/plain'].text()).resolves.toBe('');
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    Object.assign(globalThis, { ClipboardItem: originalClipboardItem });
  });

  it('falls back to plain text when rich clipboard writes fail', async () => {
    const write = vi.fn().mockRejectedValue(new Error('Rich clipboard unavailable'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboardItem = globalThis.ClipboardItem;
    class MockClipboardItem {
      constructor(_items: Record<string, Blob>) {}
    }
    Object.assign(globalThis, { ClipboardItem: MockClipboardItem });
    Object.assign(navigator, {
      clipboard: { write, writeText }
    });

    renderPane({
      activeMessages: [imageMessage('first', 'First')],
      messagesByConversation: {
        [conversation.id]: [imageMessage('first', 'First')]
      }
    });

    fireEvent.click(screen.getByTitle('Copy block'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('First');
    });
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    Object.assign(globalThis, { ClipboardItem: originalClipboardItem });
  });

  it('shows copy feedback when rich clipboard writes fail for image-only blocks', async () => {
    const write = vi.fn().mockRejectedValue(new Error('Rich clipboard unavailable'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const originalClipboardItem = globalThis.ClipboardItem;
    class MockClipboardItem {
      constructor(_items: Record<string, Blob>) {}
    }
    Object.assign(globalThis, { ClipboardItem: MockClipboardItem });
    Object.assign(navigator, {
      clipboard: { write, writeText }
    });

    renderPane({
      activeMessages: [imageMessage('image-only')],
      messagesByConversation: {
        [conversation.id]: [imageMessage('image-only')]
      }
    });

    fireEvent.click(screen.getByTitle('Copy block'));

    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Unable to copy message text.', expect.any(Error));

    consoleError.mockRestore();
    Object.assign(globalThis, { ClipboardItem: originalClipboardItem });
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

    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'Edited first block', [], []);
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
      expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'First', [image], []);
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
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;

    fireEvent.dragStart(firstBlockHandle, {
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

    expect(props.onReorderMessage).toHaveBeenCalledWith('first', 'second', 'after');
  });

  it('keeps desktop drag active if the browser cancels the pointer during native drag', () => {
    renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;

    fireEvent.dragStart(firstBlockHandle, {
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

    expect(secondBlock).not.toHaveClass('drag-over');
    expect(document.querySelector('.message-drop-indicator')).toBeInTheDocument();
  });

  it('shows the insertion space where the dragged block will land', () => {
    renderPane();
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    Object.defineProperty(secondBlock, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 100,
        bottom: 200,
        left: 0,
        right: 320,
        width: 320,
        height: 100,
        x: 0,
        y: 100,
        toJSON: () => undefined
      })
    });

    fireEvent.dragStart(firstBlockHandle, {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        getData: vi.fn(() => 'first')
      }
    });
    fireEvent.dragOver(secondBlock, {
      clientY: 175,
      dataTransfer: {
        dropEffect: ''
      }
    });

    const indicator = document.querySelector('.message-drop-indicator');
    expect(indicator).toBeInTheDocument();
    expect(secondBlock.nextElementSibling).toBe(indicator);
    expect(secondBlock).not.toHaveClass('drag-over');
  });

  it('treats message-list gaps as valid pointer drop zones', () => {
    const props = renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    const messages = firstBlock.parentElement as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = vi.fn(() => messages);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });
    Object.defineProperty(firstBlock, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 100,
        bottom: 180,
        left: 0,
        right: 320,
        width: 320,
        height: 80,
        x: 0,
        y: 100,
        toJSON: () => undefined
      })
    });
    Object.defineProperty(secondBlock, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 240,
        bottom: 320,
        left: 0,
        right: 320,
        width: 320,
        height: 80,
        x: 0,
        y: 240,
        toJSON: () => undefined
      })
    });

    fireEvent.pointerDown(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 120
    });
    fireEvent.pointerMove(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 220
    });

    const indicator = document.querySelector('.message-drop-indicator');
    expect(indicator).toBeInTheDocument();
    expect(secondBlock.previousElementSibling).toBe(indicator);

    fireEvent.pointerUp(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 220
    });

    expect(elementFromPoint).toHaveBeenCalledWith(12, 220);
    expect(props.onReorderMessage).toHaveBeenCalledWith('first', 'second', 'before');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });

  it('autoscrolls the message list when desktop dragging near the lower edge', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    let hasAnimationFrame = false;
    let animationFrame: FrameRequestCallback = () => {
      throw new Error('Expected drag autoscroll to request an animation frame.');
    };
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      hasAnimationFrame = true;
      animationFrame = callback;
      return 123;
    });
    const cancelAnimationFrame = vi.fn();
    Object.assign(window, { requestAnimationFrame, cancelAnimationFrame });

    renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    const messages = firstBlock.parentElement as HTMLElement;
    const scrollBy = vi.fn();
    Object.defineProperty(messages, 'scrollBy', {
      configurable: true,
      value: scrollBy
    });
    Object.defineProperty(messages, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 0,
        bottom: 200,
        left: 0,
        right: 320,
        width: 320,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => undefined
      })
    });

    fireEvent.dragStart(firstBlockHandle, {
      clientY: 12,
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        getData: vi.fn(() => 'first')
      }
    });
    const dragOver = createEvent.dragOver(secondBlock);
    Object.defineProperties(dragOver, {
      clientY: { value: 195 },
      dataTransfer: {
        value: {
          dropEffect: ''
        }
      }
    });
    fireEvent(secondBlock, dragOver);
    expect(hasAnimationFrame).toBe(true);
    animationFrame(0);

    expect(requestAnimationFrame).toHaveBeenCalled();
    expect(scrollBy).toHaveBeenCalledWith({ top: 17 });

    fireEvent.dragEnd(firstBlockHandle);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(123);

    Object.assign(window, {
      requestAnimationFrame: originalRequestAnimationFrame,
      cancelAnimationFrame: originalCancelAnimationFrame
    });
  });

  it('reorders blocks with touch pointer dragging', () => {
    const props = renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = vi.fn(() => secondBlock);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });

    fireEvent.pointerDown(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 12,
      clientY: 12
    });
    fireEvent.pointerMove(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 14,
      clientY: 38
    });
    fireEvent.pointerUp(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 14,
      clientY: 38
    });

    expect(elementFromPoint).toHaveBeenCalledWith(14, 38);
    expect(props.onReorderMessage).toHaveBeenCalledWith('first', 'second', 'after');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });

  it('starts touch pointer dragging as soon as the drag handle is pressed', () => {
    const props = renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = vi.fn(() => secondBlock);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });

    fireEvent.pointerDown(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 12,
      clientY: 12
    });

    expect(firstBlock).toHaveClass('dragging');
    expect(screen.getByText('First', { selector: '.message-drag-preview p' })).toBeInTheDocument();

    fireEvent.pointerUp(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 14,
      clientY: 38
    });

    expect(elementFromPoint).toHaveBeenCalledWith(14, 38);
    expect(props.onReorderMessage).toHaveBeenCalledWith('first', 'second', 'after');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });

  it('starts mouse pointer dragging as soon as the drag handle is pressed', () => {
    const props = renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = vi.fn(() => secondBlock);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });

    fireEvent.pointerDown(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 12
    });

    expect(firstBlock).toHaveClass('dragging');
    expect(screen.getByText('First', { selector: '.message-drag-preview p' })).toBeInTheDocument();

    fireEvent.pointerMove(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 14,
      clientY: 38
    });
    fireEvent.pointerUp(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 14,
      clientY: 38
    });

    expect(elementFromPoint).toHaveBeenCalledWith(14, 38);
    expect(props.onReorderMessage).toHaveBeenCalledWith('first', 'second', 'after');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });

  it('keeps touch scrolling on the block body from starting reorder drag', () => {
    const props = renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => secondBlock)
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
      clientX: 12,
      clientY: 82
    });
    fireEvent.pointerUp(firstBlock, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 12,
      clientY: 82
    });

    expect(props.onReorderMessage).not.toHaveBeenCalled();
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('autoscrolls the message list when touch dragging near the upper edge', () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    let hasAnimationFrame = false;
    let animationFrame: FrameRequestCallback = () => {
      throw new Error('Expected drag autoscroll to request an animation frame.');
    };
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      hasAnimationFrame = true;
      animationFrame = callback;
      return 456;
    });
    Object.assign(window, {
      requestAnimationFrame,
      cancelAnimationFrame: vi.fn()
    });

    renderPane();
    const firstBlock = screen.getByText('First').closest('article') as HTMLElement;
    const firstBlockHandle = screen.getAllByTitle('Drag to reorder')[0];
    const secondBlock = screen.getByText('Second').closest('article') as HTMLElement;
    const messages = firstBlock.parentElement as HTMLElement;
    const scrollBy = vi.fn();
    Object.defineProperty(messages, 'scrollBy', {
      configurable: true,
      value: scrollBy
    });
    Object.defineProperty(messages, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 20,
        bottom: 220,
        left: 0,
        right: 320,
        width: 320,
        height: 200,
        x: 0,
        y: 20,
        toJSON: () => undefined
      })
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => secondBlock)
    });

    fireEvent.pointerDown(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 12,
      clientY: 120
    });
    fireEvent.pointerMove(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 12,
      clientY: 16
    });
    expect(hasAnimationFrame).toBe(true);
    animationFrame(0);

    expect(requestAnimationFrame).toHaveBeenCalled();
    expect(scrollBy).toHaveBeenCalledWith({ top: -18 });

    fireEvent.pointerUp(firstBlockHandle, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 12,
      clientY: 16
    });

    Object.assign(window, {
      requestAnimationFrame: originalRequestAnimationFrame,
      cancelAnimationFrame: originalCancelAnimationFrame
    });
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('selects multiple blocks and merges them in visible order', async () => {
    const onMergeMessages = vi.fn(async () => undefined);
    renderPane({ onMergeMessages });

    expect(screen.queryByRole('button', { name: 'Merge selected text blocks' })).not.toBeInTheDocument();

    const firstBlock = screen.getByText('First').closest('article');
    const secondBlock = screen.getByText('Second').closest('article');
    expect(firstBlock).not.toBeNull();
    expect(secondBlock).not.toBeNull();

    fireEvent.dblClick(firstBlock!);

    fireEvent.click(secondBlock!);
    fireEvent.click(screen.getByRole('button', { name: 'Merge selected text blocks' }));

    expect(onMergeMessages).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'first' }),
      expect.objectContaining({ id: 'second' })
    ]);
  });

  it('starts block selection with a double-click and then selects other blocks with clicks', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: 'Merge selected text blocks' })).not.toBeInTheDocument();

    const firstBlock = screen.getByText('First').closest('article');
    const secondBlock = screen.getByText('Second').closest('article');
    expect(firstBlock).not.toBeNull();
    expect(secondBlock).not.toBeNull();

    fireEvent.click(firstBlock!);
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();

    fireEvent.dblClick(firstBlock!);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge selected text blocks' })).toBeDisabled();
    expect(screen.queryByText('Merge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy selected blocks to conversation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move selected blocks to conversation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy selected text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete selected blocks' })).toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Add images')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write a message')).not.toBeInTheDocument();

    fireEvent.click(secondBlock!);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge selected text blocks' })).not.toBeDisabled();
  });

  it('starts block selection with a mobile double tap', () => {
    renderPane();

    const firstBlock = screen.getByText('First').closest('article');
    const secondBlock = screen.getByText('Second').closest('article');
    expect(firstBlock).not.toBeNull();
    expect(secondBlock).not.toBeNull();

    fireEvent.pointerDown(firstBlock!, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 12, clientY: 12 });
    fireEvent.pointerUp(firstBlock!, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 12, clientY: 12 });

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();

    fireEvent.pointerDown(firstBlock!, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 13, clientY: 12 });
    fireEvent.pointerUp(firstBlock!, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 13, clientY: 12 });
    fireEvent.click(firstBlock!);

    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(secondBlock!);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('exits block selection when the last selected block is deselected', () => {
    renderPane();

    const firstBlock = screen.getByText('First').closest('article');
    expect(firstBlock).not.toBeNull();

    fireEvent.dblClick(firstBlock!);

    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(firstBlock!);

    expect(screen.queryByText('0 selected')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Merge selected text blocks' })).not.toBeInTheDocument();

    fireEvent.click(firstBlock!);

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Merge selected text blocks' })).not.toBeInTheDocument();
  });

  it('does not start block selection with a long press', () => {
    renderPane();

    vi.useFakeTimers();
    const firstBlock = screen.getByText('First').closest('article');
    expect(firstBlock).not.toBeNull();

    fireEvent.pointerDown(firstBlock!, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 12, clientY: 12 });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    fireEvent.pointerUp(firstBlock!, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 12, clientY: 12 });
    vi.useRealTimers();

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Merge selected text blocks' })).not.toBeInTheDocument();
  });

  it('uses the normal single-block transfer flow for one selected block', () => {
    const onForwardMessage = vi.fn();
    const onMoveToConversation = vi.fn();
    const onForwardMessages = vi.fn();
    const onMoveMessages = vi.fn();
    renderPane({ onForwardMessage, onMoveToConversation, onForwardMessages, onMoveMessages });

    const firstBlock = screen.getByText('First').closest('article');
    expect(firstBlock).not.toBeNull();

    fireEvent.dblClick(firstBlock!);

    fireEvent.click(screen.getByRole('button', { name: 'Copy selected blocks to conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move selected blocks to conversation' }));

    expect(onForwardMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }));
    expect(onMoveToConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }));
    expect(onForwardMessages).not.toHaveBeenCalled();
    expect(onMoveMessages).not.toHaveBeenCalled();
  });

  it('adds a pending conversation link from the composer picker and sends it', async () => {
    const onSubmitMessage = vi.fn(async () => undefined);
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };

    renderPane({
      draft: '',
      conversations: [conversation, sourceConversation],
      onSubmitMessage
    });

    fireEvent.click(screen.getByTitle('Add conversation link'));
    fireEvent.click(screen.getByRole('button', { name: 'Source chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }));

    expect(screen.getByLabelText('Pending references')).toHaveTextContent('Source chat');

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith(undefined, [], [
        expect.objectContaining({
          type: 'conversation',
          sourceConversationId: 'source-conversation',
          sourceConversationTitle: 'Source chat'
        })
      ]);
    });
  });

  it('adds a selected quote citation from another conversation', async () => {
    const onSubmitMessage = vi.fn(async () => undefined);
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    const sourceMessage = {
      ...message('source-message', 'Quoted source text'),
      conversationId: sourceConversation.id
    };

    renderPane({
      draft: '',
      conversations: [conversation, sourceConversation],
      messagesByConversation: {
        [conversation.id]: [message('first', 'First'), message('second', 'Second')],
        [sourceConversation.id]: [sourceMessage]
      },
      onSubmitMessage
    });

    fireEvent.click(screen.getByTitle('Cite text'));
    fireEvent.click(screen.getByRole('button', { name: 'Source chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quoted source text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quoted' }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert citation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith(undefined, [], [
        expect.objectContaining({
          type: 'quote',
          sourceConversationId: 'source-conversation',
          sourceMessageId: 'source-message',
          quoteText: 'Quoted',
          startOffset: 0,
          endOffset: 6
        })
      ]);
    });
  });

  it('renders reference cards and navigates to their targets', () => {
    const props = renderPane({
      activeMessages: [
        {
          ...message('first', 'Reference holder'),
          references: [
            {
              id: 'reference-1',
              type: 'quote',
              sourceConversationId: conversation.id,
              sourceConversationTitle: 'Inbox',
              sourceMessageId: 'second',
              quoteText: 'Second',
              startOffset: 0,
              endOffset: 6
            }
          ]
        }
      ]
    });

    fireEvent.click(screen.getByRole('button', { name: /Inbox: "Second"/ }));

    expect(props.onNavigateToReference).toHaveBeenCalledWith({
      conversationId: conversation.id,
      messageId: 'second',
      range: { startOffset: 0, endOffset: 6 }
    });
  });

  it('allows removing references while editing a block', () => {
    const editingMessage = {
      ...message('first', 'First'),
      references: [
        {
          id: 'reference-1',
          type: 'conversation' as const,
          sourceConversationId: conversation.id,
          sourceConversationTitle: 'Inbox'
        }
      ]
    };
    const onSaveEdit = vi.fn(async () => undefined);
    renderPane({
      editingMessage,
      activeMessages: [editingMessage],
      messagesByConversation: { [conversation.id]: [editingMessage] },
      onSaveEdit
    });

    fireEvent.click(screen.getByTitle('Remove reference'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'First', [], []);
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
    expect(screen.queryByText('English preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Hello world All good')).not.toBeInTheDocument();
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
    expect(onSubmitMessage).toHaveBeenCalledWith('Ready to submit', [], []);
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('sends pasted composer images with selected draft English text', async () => {
    const objectUrls = mockObjectUrls();
    const image = new File(['image-bytes'], 'copied.png', { type: 'image/png' });
    const onSubmitMessage = vi.fn(async () => undefined);
    const onConvertToEnglish = vi.fn(async () => ({
      segments: [
        {
          original: 'Pronto para enviar',
          options: ['Ready to send', 'Ready to submit', 'Prepared to send'] as [string, string, string]
        }
      ]
    }));
    renderPane({ draft: 'Pronto para enviar', onSubmitMessage, onConvertToEnglish });

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

    fireEvent.keyDown(screen.getByPlaceholderText('Write a message'), { key: 'Enter', ctrlKey: true });
    fireEvent.click(await screen.findByLabelText('Ready to submit'));
    fireEvent.click(screen.getByRole('button', { name: 'Send English' }));

    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith('Ready to submit', [image], []);
    });
    await waitFor(() => {
      expect(screen.queryByAltText('copied.png')).not.toBeInTheDocument();
    });
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith('blob:image-preview');

    objectUrls.restore();
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
