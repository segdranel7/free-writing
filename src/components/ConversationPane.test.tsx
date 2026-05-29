import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationPane } from './ConversationPane';
import type { Conversation, EnglishConversionRequest, Message } from '../types';

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

function getPaneProps(overrides: Partial<ComponentProps<typeof ConversationPane>> = {}) {
  return {
    activeConversation: conversation,
    conversations: [conversation],
    activeMessages: [message('first', 'First'), message('second', 'Second')],
    availableTags: [],
    tagSuggestions: [],
    selectedTags: [],
    messagesByConversation: {
      [conversation.id]: [message('first', 'First'), message('second', 'Second')]
    },
    navigationTarget: null,
    isInformationMode: false,
    moveNotice: null,
    draft: 'Ready to send',
    editingMessage: null,
    isExportingConversation: false,
    conversationExportError: null,
    onToggleInformationMode: vi.fn(),
    onExportConversation: vi.fn(),
    onOpenMoveNotice: vi.fn(),
    onDismissMoveNotice: vi.fn(),
    onBack: vi.fn(),
    onDraftChange: vi.fn(),
    onToggleTag: vi.fn(),
    onClearTags: vi.fn(),
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
    onSynthesizeIndex: vi.fn(async () => undefined),
    onConvertToEnglish: vi.fn(async (_request: string | EnglishConversionRequest) => ({
      segments: [
        {
          original: 'First',
          options: ['First option one', 'First option two', 'First option three'] as [string, string, string]
        }
      ]
    })),
    onFormatEnglishText: vi.fn(async (text: string) => text),
    onCreateEnglishBlock: vi.fn(async () => undefined),
    onReplaceWithEnglish: vi.fn(async () => undefined),
    onUpdateMessageTags: vi.fn(async () => undefined),
    onUpdateMessageReferences: vi.fn(async () => undefined),
    onSetVisualizationView: vi.fn(async () => undefined),
    onAddKanbanColumn: vi.fn(async () => null),
    onRenameKanbanColumn: vi.fn(async () => undefined),
    onReorderKanbanColumn: vi.fn(async () => undefined),
    onDeleteKanbanColumn: vi.fn(async () => undefined),
    onAssignKanbanColumn: vi.fn(async () => undefined),
    onMoveKanbanMessage: vi.fn(async () => undefined),
    ...overrides
  };
}

function renderPane(overrides: Partial<ComponentProps<typeof ConversationPane>> = {}) {
  const props: ComponentProps<typeof ConversationPane> = getPaneProps(overrides);

  render(<ConversationPane {...props} />);
  return props;
}

function renderStatefulPane(overrides: Partial<ComponentProps<typeof ConversationPane>> = {}) {
  const onDraftChange = overrides.onDraftChange ?? vi.fn();
  const initialDraft = overrides.draft ?? '';
  const props = getPaneProps({ ...overrides, draft: initialDraft, onDraftChange });

  function StatefulPane() {
    const [draft, setDraft] = useState(initialDraft);

    return (
      <ConversationPane
        {...props}
        draft={draft}
        onDraftChange={(value) => {
          setDraft(value);
          onDraftChange(value);
        }}
      />
    );
  }

  render(<StatefulPane />);
  return props;
}

function openBlockMore(index = 0) {
  const buttons = screen.getAllByRole('button', { name: 'More block actions' });
  fireEvent.click(buttons[index]);
  return buttons[index];
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

function mockScrollIntoView() {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const scrollIntoView = vi.fn();

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView
  });

  return {
    scrollIntoView,
    restore: () => {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView
      });
    }
  };
}

describe('ConversationPane', () => {
  it('exports the active conversation from the conversation header', () => {
    const props = renderPane();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByTitle('Export conversation'));

    expect(props.onExportConversation).toHaveBeenCalledTimes(1);
  });

  it('disables conversation export while pending and shows errors', () => {
    const props = renderPane({
      isExportingConversation: true,
      conversationExportError: 'Unable to export this conversation.'
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByTitle('Export conversation')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to export this conversation.');
    expect(props.onExportConversation).not.toHaveBeenCalled();
  });

  it('opens a conversation with the last block aligned to the bottom', () => {
    const scrollMock = mockScrollIntoView();

    try {
      renderPane();

      const lastBlock = document.querySelector('[data-message-id="second"]');
      expect(scrollMock.scrollIntoView).toHaveBeenCalledWith({ block: 'end' });
      expect(scrollMock.scrollIntoView.mock.contexts.at(-1)).toBe(lastBlock);
    } finally {
      scrollMock.restore();
    }
  });

  it('scrolls a newly appended block to the bottom', () => {
    const scrollMock = mockScrollIntoView();

    try {
      const firstMessage = message('first', 'First');
      const secondMessage = message('second', 'Second');
      const initialProps = getPaneProps({
        activeMessages: [firstMessage],
        messagesByConversation: { [conversation.id]: [firstMessage] }
      });
      const { rerender } = render(<ConversationPane {...initialProps} />);

      scrollMock.scrollIntoView.mockClear();

      const nextProps = {
        ...initialProps,
        activeMessages: [firstMessage, secondMessage],
        messagesByConversation: { [conversation.id]: [firstMessage, secondMessage] }
      };
      rerender(<ConversationPane {...nextProps} />);

      const appendedBlock = document.querySelector('[data-message-id="second"]');
      expect(scrollMock.scrollIntoView).toHaveBeenCalledWith({ block: 'end' });
      expect(scrollMock.scrollIntoView.mock.contexts.at(-1)).toBe(appendedBlock);
    } finally {
      scrollMock.restore();
    }
  });

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
      expect(onSubmitMessage).toHaveBeenCalledWith(undefined, [image], [], null);
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
      expect(composer.onSubmitMessage).toHaveBeenCalledWith(undefined, [image], [], null);
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
      expect(composer.onSubmitMessage).toHaveBeenCalledWith(
        undefined,
        [expect.objectContaining({ name: 'pasted-image.png', type: 'image/png' })],
        [],
        null
      );
    });

    Object.assign(navigator, {
      clipboard: originalClipboard
    });
    objectUrls.restore();
  });

  it('adds a required date and time to a composer block', async () => {
    const onSubmitMessage = vi.fn(async () => undefined);
    renderPane({ draft: 'Scheduled block', onSubmitMessage });

    const dateButton = screen.getByRole('button', { name: 'Date' });
    expect(dateButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(dateButton);
    expect(dateButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByLabelText('Block date and time'), {
      target: { value: '2026-05-21T09:30' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith(
        undefined,
        [],
        [],
        new Date(2026, 4, 21, 9, 30)
      );
    });
  });

  it('keeps primary and secondary composer tools accessible', () => {
    renderPane({ draft: '' });

    expect(screen.getByRole('button', { name: 'Date' })).toBeVisible();
    expect(screen.getByTitle('Add images')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Insert [[' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByTitle('Paste image')).toBeVisible();
    expect(screen.getByTitle('Add conversation link')).toBeVisible();
    expect(screen.getByTitle('Cite text')).toBeVisible();
    expect(screen.getByTitle('Convert draft to English')).toBeDisabled();
  });

  it('submits the composer only once while a send is pending', () => {
    const onSubmitMessage = vi.fn(() => new Promise<void>(() => undefined));
    renderPane({ draft: 'One pending block', onSubmitMessage });

    const sendButton = screen.getByRole('button', { name: 'Send' });
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    expect(onSubmitMessage).toHaveBeenCalledTimes(1);
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

  it('collapses text blocks longer than three lines until expanded', () => {
    const longText = [
      'Line one',
      'Line two',
      'Line three',
      'Hidden fourth line'
    ].join('\n');
    const longMessage = message('large', longText);

    renderPane({
      activeMessages: [longMessage],
      messagesByConversation: {
        [conversation.id]: [longMessage]
      }
    });

    expect(screen.getByText(/Line three/)).toBeInTheDocument();
    expect(screen.queryByText(/Hidden fourth line/)).not.toBeInTheDocument();

    const expandButton = screen.getByRole('button', { name: 'Expand text block' });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(expandButton);

    expect(screen.getByText(/Hidden fourth line/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse text block' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles information-only mode from the conversation header', () => {
    const onToggleInformationMode = vi.fn();
    renderPane({ isInformationMode: true, onToggleInformationMode });

    const toggle = screen.getByRole('button', { name: 'Information-only mode' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggle);

    expect(onToggleInformationMode).toHaveBeenCalledTimes(1);
  });

  it('shows block information but hides editing controls in information-only mode', () => {
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    const informationMessage: Message = {
      ...imageMessage('info', 'Read [[Source chat]] closely'),
      tags: ['Focus'],
      references: [
        {
          id: 'reference-1',
          type: 'block',
          sourceConversationId: sourceConversation.id,
          sourceConversationTitle: sourceConversation.title,
          sourceMessageId: 'source-block',
          sourceMessagePreview: 'Reference preview'
        }
      ],
      scheduledAt: timestamp
    };
    const onNavigateToReference = vi.fn();

    renderPane({
      isInformationMode: true,
      activeMessages: [informationMessage],
      conversations: [conversation, sourceConversation],
      messagesByConversation: {
        [conversation.id]: [informationMessage],
        [sourceConversation.id]: [message('source-block', 'Reference preview')]
      },
      onNavigateToReference
    });

    expect(screen.getByText(/Read/)).toBeInTheDocument();
    expect(screen.getByAltText('note.png')).toBeInTheDocument();
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Source chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Source chat: "Reference preview"/ })).toBeInTheDocument();
    expect(screen.getByTitle('Show normal controls')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Connect block')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Copy block')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Copy text')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Download text as Markdown')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Convert to English')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Forward')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Move to conversation')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Move up')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Add tag')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove Focus')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Source chat' }));
    expect(onNavigateToReference).toHaveBeenCalledWith({ conversationId: sourceConversation.id });
  });

  it('shows normal controls for one information-mode block at a time without editing it', () => {
    const first = message('first', 'First');
    const second = message('second', 'Second');

    renderPane({
      isInformationMode: true,
      activeMessages: [first, second],
      messagesByConversation: {
        [conversation.id]: [first, second]
      }
    });

    fireEvent.click(screen.getAllByTitle('Show normal controls')[0]);

    expect(screen.queryByLabelText('Edit message text')).not.toBeInTheDocument();
    expect(screen.getByTitle('Return block to view mode')).toBeInTheDocument();
    expect(screen.getByTitle('Edit')).toBeInTheDocument();
    expect(screen.getByTitle('Connect block')).toBeInTheDocument();
    expect(screen.getByTitle('Copy text')).toBeInTheDocument();
    expect(screen.getByTitle('Forward')).toBeInTheDocument();
    expect(screen.getByTitle('Add tag')).toBeInTheDocument();
    expect(screen.getAllByTitle('Show normal controls')).toHaveLength(1);

    fireEvent.click(screen.getByTitle('Show normal controls'));

    expect(screen.queryByLabelText('Edit message text')).not.toBeInTheDocument();
    expect(screen.getByTitle('Return block to view mode')).toBeInTheDocument();
    expect(screen.getAllByTitle('Show normal controls')).toHaveLength(1);

    fireEvent.click(screen.getByTitle('Return block to view mode'));

    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
    expect(screen.getAllByTitle('Show normal controls')).toHaveLength(2);
  });

  it('clears block selection when information-only mode turns on', async () => {
    const props = getPaneProps();
    const { rerender } = render(<ConversationPane {...props} />);

    fireEvent.doubleClick(document.querySelector('[data-message-id="first"]') as HTMLElement);
    expect(screen.getByRole('button', { name: 'Copy selected blocks to conversation' })).toBeInTheDocument();

    rerender(<ConversationPane {...props} isInformationMode />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Copy selected blocks to conversation' })).not.toBeInTheDocument();
    });

    rerender(<ConversationPane {...props} />);
    expect(screen.queryByRole('button', { name: 'Copy selected blocks to conversation' })).not.toBeInTheDocument();
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

  it('adds and removes tags inline on a block', async () => {
    const taggedMessage = message('first', 'First');
    taggedMessage.tags = ['Urgent'];
    const onUpdateMessageTags = vi.fn(async () => undefined);

    renderPane({
      activeMessages: [taggedMessage],
      messagesByConversation: {
        [conversation.id]: [taggedMessage]
      },
      onUpdateMessageTags
    });

    expect(screen.getByText('Urgent')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Add tag'));
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: ' Idea ' } });
    fireEvent.click(screen.getByTitle('Save tag'));

    await waitFor(() => {
      expect(onUpdateMessageTags).toHaveBeenCalledWith(taggedMessage, ['Urgent', 'Idea']);
    });

    fireEvent.click(screen.getByTitle('Remove Urgent'));

    await waitFor(() => {
      expect(onUpdateMessageTags).toHaveBeenCalledWith(taggedMessage, []);
    });
  });

  it('suggests previously created tags while editing block tags', async () => {
    const taggedMessage = message('first', 'First');
    taggedMessage.tags = ['Urgent'];
    const onUpdateMessageTags = vi.fn(async () => undefined);

    renderPane({
      activeMessages: [taggedMessage],
      messagesByConversation: {
        [conversation.id]: [taggedMessage]
      },
      tagSuggestions: [
        { name: 'Later', count: 3 },
        { name: 'Project Idea', count: 2 },
        { name: 'Urgent', count: 1 }
      ],
      onUpdateMessageTags
    });

    fireEvent.click(screen.getByTitle('Add tag'));

    expect(screen.getByText('Later')).toBeInTheDocument();
    expect(screen.getByText('Project Idea')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Urgent/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'proj' } });

    expect(screen.queryByText('Later')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Project Idea'));

    await waitFor(() => {
      expect(onUpdateMessageTags).toHaveBeenCalledWith(taggedMessage, ['Urgent', 'Project Idea']);
    });
  });

  it('selects the highlighted tag suggestion with Enter', async () => {
    const taggedMessage = message('first', 'First');
    const onUpdateMessageTags = vi.fn(async () => undefined);

    renderPane({
      activeMessages: [taggedMessage],
      messagesByConversation: {
        [conversation.id]: [taggedMessage]
      },
      tagSuggestions: [
        { name: 'Later', count: 3 },
        { name: 'Project Idea', count: 2 }
      ],
      onUpdateMessageTags
    });

    fireEvent.click(screen.getByTitle('Add tag'));
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'pro' } });
    fireEvent.keyDown(screen.getByLabelText('New tag'), { key: 'Enter' });

    await waitFor(() => {
      expect(onUpdateMessageTags).toHaveBeenCalledWith(taggedMessage, ['Project Idea']);
    });
  });

  it('creates a typed tag with Enter when there is no matching suggestion', async () => {
    const taggedMessage = message('first', 'First');
    const onUpdateMessageTags = vi.fn(async () => undefined);

    renderPane({
      activeMessages: [taggedMessage],
      messagesByConversation: {
        [conversation.id]: [taggedMessage]
      },
      tagSuggestions: [{ name: 'Later', count: 3 }],
      onUpdateMessageTags
    });

    fireEvent.click(screen.getByTitle('Add tag'));
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'Idea' } });
    fireEvent.keyDown(screen.getByLabelText('New tag'), { key: 'Enter' });

    await waitFor(() => {
      expect(onUpdateMessageTags).toHaveBeenCalledWith(taggedMessage, ['Idea']);
    });
  });

  it('filters the active conversation by selected tags and disables reorder controls', () => {
    const first = message('first', 'First');
    first.tags = ['Urgent'];
    const second = message('second', 'Second');
    second.tags = ['Later'];

    renderPane({
      activeMessages: [first, second],
      availableTags: [
        { name: 'Urgent', count: 1 },
        { name: 'Later', count: 1 }
      ],
      selectedTags: ['Urgent'],
      messagesByConversation: {
        [conversation.id]: [first, second]
      }
    });

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    openBlockMore();
    expect(screen.getByTitle('Drag to reorder')).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /urgent/i })[0]).toHaveClass('active');
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

  it('sends the draft directly with Ctrl+Shift+Enter and skips English conversion', async () => {
    const onSubmitMessage = vi.fn(async () => undefined);
    const onConvertToEnglish = vi.fn(async () => ({
      segments: [
        {
          original: 'Ready to send',
          options: ['Ready to send', 'Ready to submit', 'Prepared to send'] as [string, string, string]
        }
      ]
    }));
    renderPane({ onSubmitMessage, onConvertToEnglish });

    fireEvent.keyDown(screen.getByPlaceholderText('Write a message'), {
      key: 'Enter',
      ctrlKey: true,
      shiftKey: true
    });

    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith(undefined, [], [], null);
    });
    expect(onConvertToEnglish).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Choose English versions' })).not.toBeInTheDocument();
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

    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'Edited first block', [], [], null);
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
      expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'First', [image], [], null);
    });

    objectUrls.restore();
  });

  it('edits and displays a block date and time', async () => {
    const scheduledMessage = {
      ...message('first', 'First'),
      scheduledAt: timestamp
    };
    const onSaveEdit = vi.fn(async () => undefined);

    renderPane({
      activeMessages: [scheduledMessage],
      messagesByConversation: { [conversation.id]: [scheduledMessage] }
    });

    expect(screen.getByText(/Tue, May 12/i)).toBeInTheDocument();

    cleanup();
    renderPane({
      editingMessage: scheduledMessage,
      activeMessages: [scheduledMessage],
      messagesByConversation: { [conversation.id]: [scheduledMessage] },
      onSaveEdit
    });

    fireEvent.change(screen.getByLabelText('Edit block date and time'), {
      target: { value: '2026-05-21T14:45' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSaveEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'first' }),
      'First',
      [],
      [],
      new Date(2026, 4, 21, 14, 45)
    );
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

    openBlockMore(0);
    expect(screen.getByTitle('Move up')).toBeDisabled();
    const firstMoveDown = screen.getByTitle('Move down');
    fireEvent.click(firstMoveDown);

    openBlockMore(1);
    expect(screen.getByTitle('Move down')).toBeDisabled();
    const secondMoveUp = screen.getByTitle('Move up');
    fireEvent.click(secondMoveUp);

    expect(props.onMoveMessage).toHaveBeenCalledWith(0, 1);
    expect(props.onMoveMessage).toHaveBeenCalledWith(1, -1);
  });

  it('keeps reorder and delete actions in block More', () => {
    renderPane();

    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();

    openBlockMore();

    expect(screen.getByTitle('Move up')).toBeInTheDocument();
    expect(screen.getByTitle('Move down')).toBeInTheDocument();
    expect(screen.getByTitle('Drag to reorder')).toBeInTheDocument();
    expect(screen.getByTitle('Delete')).toHaveClass('danger');
  });

  it('reorders blocks by dragging one block onto another', () => {
    const props = renderPane();
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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
    openBlockMore();
    const firstBlockHandle = screen.getByTitle('Drag to reorder');
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

  it('ignores the delayed click after a mobile double tap when layout changes retarget it', () => {
    renderPane();

    const firstBlock = screen.getByText('First').closest('article');
    const secondBlock = screen.getByText('Second').closest('article');
    expect(firstBlock).not.toBeNull();
    expect(secondBlock).not.toBeNull();

    fireEvent.pointerDown(firstBlock!, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 12, clientY: 12 });
    fireEvent.pointerUp(firstBlock!, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 12, clientY: 12 });
    fireEvent.pointerDown(firstBlock!, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 13, clientY: 12 });
    fireEvent.pointerUp(firstBlock!, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 13, clientY: 12 });

    fireEvent.click(secondBlock!);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();

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
      expect(onSubmitMessage).toHaveBeenCalledWith(
        undefined,
        [],
        [
          expect.objectContaining({
            type: 'conversation',
            sourceConversationId: 'source-conversation',
            sourceConversationTitle: 'Source chat'
          })
        ],
        null
      );
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
      expect(onSubmitMessage).toHaveBeenCalledWith(
        undefined,
        [],
        [
          expect.objectContaining({
            type: 'quote',
            sourceConversationId: 'source-conversation',
            sourceMessageId: 'source-message',
            quoteText: 'Quoted',
            startOffset: 0,
            endOffset: 6
          })
        ],
        null
      );
    });
  });

  it('suggests conversation wiki links while typing in the composer and completes the selected title', async () => {
    const onDraftChange = vi.fn();
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    const personalConversation = { ...conversation, id: 'personal-conversation', title: 'Personal notes' };

    renderStatefulPane({
      draft: '',
      conversations: [conversation, sourceConversation, personalConversation],
      onDraftChange
    });

    const composer = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: '[[' } });
    composer.setSelectionRange(2, 2);
    fireEvent.keyUp(composer);

    expect(await screen.findByRole('option', { name: 'Source chat' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Personal notes' })).toBeInTheDocument();

    fireEvent.change(composer, { target: { value: '[[sou' } });
    composer.setSelectionRange(5, 5);
    fireEvent.keyUp(composer);

    expect(await screen.findByRole('option', { name: 'Source chat' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Personal notes' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Source chat' }));

    await waitFor(() => {
      expect(composer).toHaveValue('[[Source chat]]');
    });
    expect(onDraftChange).toHaveBeenLastCalledWith('[[Source chat]]');
  });

  it('navigates conversation wiki link suggestions with arrow keys and completes the highlighted option', async () => {
    const onDraftChange = vi.fn();
    const firstConversation = { ...conversation, id: 'alpha-conversation', title: 'Alpha notes' };
    const secondConversation = { ...conversation, id: 'beta-conversation', title: 'Beta notes' };

    renderStatefulPane({
      draft: '',
      conversations: [firstConversation, secondConversation],
      onDraftChange
    });

    const composer = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: '[[' } });
    composer.setSelectionRange(2, 2);
    fireEvent.keyUp(composer);

    expect(await screen.findByRole('option', { name: 'Alpha notes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Beta notes' })).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(composer, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Alpha notes' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: 'Beta notes' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(composer, { key: 'Enter' });

    await waitFor(() => {
      expect(composer).toHaveValue('[[Beta notes]]');
    });
    expect(onDraftChange).toHaveBeenLastCalledWith('[[Beta notes]]');
  });

  it('inserts a conversation wiki link marker from the composer shortcut button', async () => {
    const onDraftChange = vi.fn();
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };

    renderStatefulPane({
      draft: '',
      conversations: [conversation, sourceConversation],
      onDraftChange
    });

    fireEvent.click(screen.getByRole('button', { name: 'Insert [[' }));

    const composer = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(composer).toHaveValue('[[');
    });
    expect(await screen.findByRole('option', { name: 'Source chat' })).toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith('[[');
  });

  it('suggests conversation wiki links while editing a block and completes the selected title', async () => {
    const onSaveEdit = vi.fn(async () => undefined);
    const editingMessage = message('first', 'See ');
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    renderPane({
      editingMessage,
      activeMessages: [editingMessage],
      conversations: [conversation, sourceConversation],
      messagesByConversation: { [conversation.id]: [editingMessage] },
      onSaveEdit
    });

    const editor = screen.getByLabelText('Edit message text') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'See [[' } });
    editor.setSelectionRange(6, 6);
    fireEvent.keyUp(editor);

    fireEvent.click(await screen.findByRole('option', { name: 'Source chat' }));

    await waitFor(() => {
      expect(editor).toHaveValue('See [[Source chat]]');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'See [[Source chat]]', [], [], null);
  });

  it('inserts a conversation wiki link marker from the edit shortcut button', async () => {
    const editingMessage = message('first', 'First');
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    renderPane({
      editingMessage,
      activeMessages: [editingMessage],
      conversations: [conversation, sourceConversation],
      messagesByConversation: { [conversation.id]: [editingMessage] }
    });

    const editor = screen.getByLabelText('Edit message text') as HTMLTextAreaElement;
    editor.setSelectionRange(0, 0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Insert [[' })[0]);

    await waitFor(() => {
      expect(editor).toHaveValue('[[First');
    });
    expect(await screen.findByRole('option', { name: 'Source chat' })).toBeInTheDocument();
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

  it('creates a whole-block connection from one saved block to another', async () => {
    const onUpdateMessageReferences = vi.fn(async () => undefined);
    renderPane({ onUpdateMessageReferences });

    fireEvent.click(screen.getAllByTitle('Connect block')[0]);
    const dialog = screen.getByRole('dialog', { name: 'Connect block' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Second' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Connect block' }));

    await waitFor(() => {
      expect(onUpdateMessageReferences).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'first' }),
        [
          expect.objectContaining({
            type: 'block',
            sourceConversationId: conversation.id,
            sourceMessageId: 'second',
            sourceMessagePreview: 'Second'
          })
        ]
      );
    });
  });

  it('creates a quote connection to a same-conversation block', async () => {
    const onUpdateMessageReferences = vi.fn(async () => undefined);
    renderPane({ onUpdateMessageReferences });

    fireEvent.click(screen.getAllByTitle('Connect block')[0]);
    const dialog = screen.getByRole('dialog', { name: 'Connect block' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quote' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Second' }));
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Second' }).at(-1)!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Connect quote' }));

    await waitFor(() => {
      expect(onUpdateMessageReferences).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'first' }),
        [
          expect.objectContaining({
            type: 'quote',
            sourceConversationId: conversation.id,
            sourceMessageId: 'second',
            quoteText: 'Second',
            startOffset: 0,
            endOffset: 6
          })
        ]
      );
    });
  });

  it('creates quote connections from separate clicked text fragments', async () => {
    const onUpdateMessageReferences = vi.fn(async () => undefined);
    const source = message('source', 'Source block');
    const target = message('target', 'Alpha beta Gamma');
    renderPane({
      activeMessages: [source, target],
      messagesByConversation: { [conversation.id]: [source, target] },
      onUpdateMessageReferences
    });

    fireEvent.click(screen.getAllByTitle('Connect block')[0]);
    const dialog = screen.getByRole('dialog', { name: 'Connect block' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quote' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alpha beta Gamma' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alpha' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gamma' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Connect quote' }));

    await waitFor(() => {
      expect(onUpdateMessageReferences).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'source' }),
        [
          expect.objectContaining({
            type: 'quote',
            sourceMessageId: 'target',
            quoteText: 'Alpha',
            startOffset: 0,
            endOffset: 5
          }),
          expect.objectContaining({
            type: 'quote',
            sourceMessageId: 'target',
            quoteText: 'Gamma',
            startOffset: 11,
            endOffset: 16
          })
        ]
      );
    });
  });

  it('creates quote connections by dragging across text fragments', async () => {
    const onUpdateMessageReferences = vi.fn(async () => undefined);
    const source = message('source', 'Source block');
    const target = message('target', 'Alpha beta Gamma');
    const originalElementFromPoint = document.elementFromPoint;
    renderPane({
      activeMessages: [source, target],
      messagesByConversation: { [conversation.id]: [source, target] },
      onUpdateMessageReferences
    });

    fireEvent.click(screen.getAllByTitle('Connect block')[0]);
    const dialog = screen.getByRole('dialog', { name: 'Connect block' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quote' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alpha beta Gamma' }));

    const alphaWord = within(dialog).getByRole('button', { name: 'Alpha' });
    const gammaWord = within(dialog).getByRole('button', { name: 'Gamma' });
    const sourceText = within(dialog).getByLabelText('Source message text');
    document.elementFromPoint = vi.fn(() => gammaWord);

    try {
      fireEvent.pointerDown(alphaWord, { pointerId: 1, clientX: 4, clientY: 4 });
      fireEvent.pointerMove(sourceText, { pointerId: 1, clientX: 60, clientY: 4 });
      fireEvent.pointerUp(sourceText, { pointerId: 1 });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Connect quote' }));

      await waitFor(() => {
        expect(onUpdateMessageReferences).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'source' }),
          [
            expect.objectContaining({ type: 'quote', quoteText: 'Alpha', startOffset: 0, endOffset: 5 }),
            expect.objectContaining({ type: 'quote', quoteText: 'Gamma', startOffset: 11, endOffset: 16 })
          ]
        );
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('allows connecting a saved block to itself', async () => {
    const onUpdateMessageReferences = vi.fn(async () => undefined);
    renderPane({ onUpdateMessageReferences });

    fireEvent.click(screen.getAllByTitle('Connect block')[0]);
    const dialog = screen.getByRole('dialog', { name: 'Connect block' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'First' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Connect block' }));

    await waitFor(() => {
      expect(onUpdateMessageReferences).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'first' }),
        [
          expect.objectContaining({
            type: 'block',
            sourceConversationId: conversation.id,
            sourceMessageId: 'first'
          })
        ]
      );
    });
  });

  it('renders collapsed backlinks and expands connected source cards', () => {
    const props = renderPane({
      activeMessages: [
        {
          ...message('source', 'Source block'),
          references: [
            {
              id: 'reference-1',
              type: 'block',
              sourceConversationId: conversation.id,
              sourceConversationTitle: 'Inbox',
              sourceMessageId: 'target',
              sourceMessagePreview: 'Target block'
            }
          ]
        },
        message('target', 'Target block')
      ],
      messagesByConversation: {
        [conversation.id]: [
          {
            ...message('source', 'Source block'),
            references: [
              {
                id: 'reference-1',
                type: 'block',
                sourceConversationId: conversation.id,
                sourceConversationTitle: 'Inbox',
                sourceMessageId: 'target',
                sourceMessagePreview: 'Target block'
              }
            ]
          },
          message('target', 'Target block')
        ]
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Connected from 1 block' }));
    fireEvent.click(screen.getByRole('button', { name: /Inbox: "Source block"/ }));

    expect(props.onNavigateToReference).toHaveBeenCalledWith({
      conversationId: conversation.id,
      messageId: 'source'
    });
  });

  it('navigates outbound whole-block reference cards to the target block', () => {
    const holder = {
      ...message('holder', 'Holder'),
      references: [
        {
          id: 'reference-1',
          type: 'block' as const,
          sourceConversationId: conversation.id,
          sourceConversationTitle: 'Inbox',
          sourceMessageId: 'target',
          sourceMessagePreview: 'Target block'
        }
      ]
    };
    const props = renderPane({
      activeMessages: [holder, message('target', 'Target block')],
      messagesByConversation: { [conversation.id]: [holder, message('target', 'Target block')] }
    });

    fireEvent.click(screen.getByRole('button', { name: /Inbox: "Target block"/ }));

    expect(props.onNavigateToReference).toHaveBeenCalledWith({
      conversationId: conversation.id,
      messageId: 'target'
    });
  });

  it('renders inline conversation wiki links and navigates to the target conversation', () => {
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    const linkedMessage = message('first', 'See [[Source chat]] today.');
    const props = renderPane({
      conversations: [conversation, sourceConversation],
      activeMessages: [linkedMessage],
      messagesByConversation: {
        [conversation.id]: [linkedMessage],
        [sourceConversation.id]: []
      }
    });

    expect(screen.queryByText('[[Source chat]]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Source chat' }));

    expect(props.onNavigateToReference).toHaveBeenCalledWith({
      conversationId: sourceConversation.id
    });
  });

  it('keeps missing and duplicate inline conversation wiki links as plain text', () => {
    const firstSource = { ...conversation, id: 'first-source', title: 'Source chat' };
    const secondSource = { ...conversation, id: 'second-source', title: 'Source chat' };
    const linkedMessage = message('first', 'See [[Missing]] and [[Source chat]].');

    renderPane({
      conversations: [conversation, firstSource, secondSource],
      activeMessages: [linkedMessage],
      messagesByConversation: {
        [conversation.id]: [linkedMessage],
        [firstSource.id]: [],
        [secondSource.id]: []
      }
    });

    expect(screen.queryByRole('button', { name: '[[Missing]]' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Source chat' })).not.toBeInTheDocument();
    expect(screen.getByText('See [[Missing]] and [[Source chat]].')).toBeInTheDocument();
  });

  it('renders inline conversation wiki links from edited message text', () => {
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    const editedMessage = {
      ...message('first', 'Updated link to [[Source chat]]'),
      updatedAt: timestamp
    };
    const props = renderPane({
      conversations: [conversation, sourceConversation],
      activeMessages: [editedMessage],
      messagesByConversation: {
        [conversation.id]: [editedMessage],
        [sourceConversation.id]: []
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Source chat' }));

    expect(props.onNavigateToReference).toHaveBeenCalledWith({
      conversationId: sourceConversation.id
    });
  });

  it('renders copied block origin metadata and navigates to the source conversation', () => {
    const sourceConversation = { ...conversation, id: 'source-conversation', title: 'Source chat' };
    const copiedMessage = {
      ...message('copied', 'Copied text'),
      transferType: 'forwarded' as const,
      isForwarded: true,
      forwardedFromConversationId: sourceConversation.id,
      forwardedFromConversationTitle: 'Source chat',
      forwardedFromMessageId: 'source-message'
    };
    const props = renderPane({
      conversations: [conversation, sourceConversation],
      activeMessages: [copiedMessage],
      messagesByConversation: {
        [conversation.id]: [copiedMessage],
        [sourceConversation.id]: [message('source-message', 'Original text')]
      }
    });

    expect(screen.getByText(/Copied from/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Copied block source')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Source chat' }));

    expect(props.onNavigateToReference).toHaveBeenCalledWith({
      conversationId: sourceConversation.id
    });
  });

  it('omits copied origin UI for moved blocks', () => {
    const movedMessage = {
      ...message('moved', 'Moved text'),
      transferType: 'moved' as const,
      isForwarded: true,
      forwardedFromConversationId: 'source-conversation',
      forwardedFromConversationTitle: 'Source chat',
      forwardedFromMessageId: 'source-message'
    };

    renderPane({ activeMessages: [movedMessage] });

    expect(screen.getByText('Moved')).toBeInTheDocument();
    expect(screen.queryByText('Copied from Source chat')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Source chat' })).not.toBeInTheDocument();
  });

  it('shows a post-move notice with an open action', () => {
    const onOpenMoveNotice = vi.fn();
    const onDismissMoveNotice = vi.fn();

    renderPane({
      moveNotice: { targetConversationId: 'target-conversation', targetConversationTitle: 'Target chat' },
      onOpenMoveNotice,
      onDismissMoveNotice
    });

    expect(screen.getByText('Moved to Target chat')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByTitle('Dismiss move notice'));

    expect(onOpenMoveNotice).toHaveBeenCalled();
    expect(onDismissMoveNotice).toHaveBeenCalled();
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

    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'First', [], [], null);
  });

  it('opens the English picker and defaults to the first option for each segment', async () => {
    const props = renderPane({
      onConvertToEnglish: vi.fn(async () => ({
        segments: [
          {
            original: 'Olá mundo',
            options: ['Hello world', 'Hi world', 'Hello, everyone'] as [string, string, string],
            separatorAfter: 'line' as const
          },
          {
            original: 'Tudo bem',
            options: ['All good', 'Everything is fine', 'Is everything okay'] as [string, string, string]
          }
        ]
      }))
    });

    fireEvent.click(screen.getAllByTitle('Convert to English')[0]);
    expect(await screen.findByLabelText('Choose text to convert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Convert block' }));

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
    const onFormatEnglishText = vi.fn(async () => '# Structured English\n\n- First selected\n- Second selected');
    renderPane({
      onCreateEnglishBlock,
      onFormatEnglishText,
      onConvertToEnglish: vi.fn(async () => ({
        segments: [
          {
            original: 'Primeiro',
            options: ['First default', 'First selected', 'First formal'] as [string, string, string],
            separatorAfter: 'line' as const
          },
          {
            original: 'Segundo',
            options: ['Second default', 'Second selected', 'Second formal'] as [string, string, string]
          }
        ]
      }))
    });

    fireEvent.click(screen.getAllByTitle('Convert to English')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Convert block' }));
    fireEvent.click(await screen.findByLabelText('First selected'));
    fireEvent.click(screen.getByLabelText('Second selected'));
    fireEvent.click(screen.getByRole('button', { name: 'Create block' }));

    await waitFor(() => {
      expect(onFormatEnglishText).toHaveBeenCalledWith('First selected\nSecond selected', ['First selected', 'Second selected']);
    });
    expect(onCreateEnglishBlock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'first' }),
      '# Structured English\n\n- First selected\n- Second selected'
    );
  });

  it('can replace the source block with the selected English text', async () => {
    const onReplaceWithEnglish = vi.fn(async () => undefined);
    const onFormatEnglishText = vi.fn(async () => '## Replacement\n\nFirst replacement');
    renderPane({
      onReplaceWithEnglish,
      onFormatEnglishText,
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
    fireEvent.click(await screen.findByRole('button', { name: 'Convert block' }));
    fireEvent.click(await screen.findByLabelText('First replacement'));
    fireEvent.click(screen.getByRole('button', { name: 'Replace block' }));

    await waitFor(() => {
      expect(onReplaceWithEnglish).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'first' }),
        '## Replacement\n\nFirst replacement'
      );
    });
  });

  it('converts selected saved text with surrounding context', async () => {
    const source = message('first', 'Olá mundo bonito');
    const onConvertToEnglish = vi.fn(async () => ({
      segments: [
        {
          original: 'mundo',
          options: ['world', 'earth', 'the world'] as [string, string, string]
        }
      ]
    }));
    renderPane({
      activeMessages: [source],
      messagesByConversation: { [conversation.id]: [source] },
      onConvertToEnglish
    });

    fireEvent.click(screen.getByTitle('Convert to English'));
    fireEvent.click(await screen.findByRole('button', { name: 'mundo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Convert selection' }));

    await waitFor(() => {
      expect(onConvertToEnglish).toHaveBeenCalledWith({
        text: 'mundo',
        contextBefore: 'Olá',
        contextAfter: 'bonito'
      });
    });
    expect(await screen.findByLabelText('world')).toBeChecked();
  });

  it('replaces only the selected source text with English', async () => {
    const source = message('first', 'Olá mundo bonito');
    const onReplaceWithEnglish = vi.fn(async () => undefined);
    const onFormatEnglishText = vi.fn(async () => 'world');
    renderPane({
      activeMessages: [source],
      messagesByConversation: { [conversation.id]: [source] },
      onReplaceWithEnglish,
      onFormatEnglishText,
      onConvertToEnglish: vi.fn(async () => ({
        segments: [
          {
            original: 'mundo',
            options: ['world', 'earth', 'the world'] as [string, string, string]
          }
        ]
      }))
    });

    fireEvent.click(screen.getByTitle('Convert to English'));
    fireEvent.click(await screen.findByRole('button', { name: 'mundo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Convert selection' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Replace block' }));

    await waitFor(() => {
      expect(onReplaceWithEnglish).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'first' }),
        'Olá world bonito'
      );
    });
  });

  it('converts draft text to English and sends the selected text directly', async () => {
    const onDraftChange = vi.fn();
    const onSubmitMessage = vi.fn(async () => undefined);
    const onFormatEnglishText = vi.fn(async () => '- Ready to submit');
    const onConvertToEnglish = vi.fn(async () => ({
      segments: [
        {
          original: 'Pronto para enviar',
          options: ['Ready to send', 'Ready to submit', 'Prepared to send'] as [string, string, string]
        }
      ]
    }));
    renderPane({ draft: 'Pronto para enviar', onDraftChange, onSubmitMessage, onConvertToEnglish, onFormatEnglishText });

    fireEvent.click(screen.getByTitle('Convert draft to English'));
    fireEvent.click(await screen.findByLabelText('Ready to submit'));
    fireEvent.click(screen.getByRole('button', { name: 'Send English' }));

    expect(onConvertToEnglish).toHaveBeenCalledWith('Pronto para enviar');
    expect(onFormatEnglishText).toHaveBeenCalledWith('Ready to submit', ['Ready to submit']);
    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith('- Ready to submit', [], [], null);
    });
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
      expect(onSubmitMessage).toHaveBeenCalledWith('Ready to submit', [image], [], null);
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
    fireEvent.click(await screen.findByRole('button', { name: 'Convert block' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Translation service unavailable');
    expect(screen.getByRole('button', { name: 'Create block' })).toBeDisabled();
  });

  it('synthesizes the active conversation into one index request', async () => {
    const onSynthesizeIndex = vi.fn(async () => undefined);
    const props = renderPane({ onSynthesizeIndex });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByTitle('Synthesize conversation index'));

    await waitFor(() => {
      expect(onSynthesizeIndex).toHaveBeenCalledTimes(1);
    });
    expect(onSynthesizeIndex).toHaveBeenCalledWith(props.activeMessages, 'Inbox');
  });

  it('switches conversation visualization views from the header', () => {
    const onSetVisualizationView = vi.fn();
    renderPane({ onSetVisualizationView });

    fireEvent.click(screen.getByRole('button', { name: 'Kanban view' }));
    expect(onSetVisualizationView).toHaveBeenCalledWith('kanban');

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(onSetVisualizationView).toHaveBeenCalledWith('list');
  });

  it('shows assigned blocks in Kanban while leaving unassigned blocks in list view', () => {
    const assigned = { ...message('assigned', 'Assigned card'), kanbanColumnId: 'doing', kanbanSortOrder: 1000 };
    const unassigned = message('unassigned', 'Unassigned block');

    renderPane({
      activeConversation: {
        ...conversation,
        visualizationView: 'kanban',
        kanbanColumns: [
          { id: 'doing', title: 'Doing', sortOrder: 1000 },
          { id: 'done', title: 'Done', sortOrder: 2000 }
        ]
      },
      activeMessages: [assigned, unassigned],
      messagesByConversation: { [conversation.id]: [assigned, unassigned] }
    });

    expect(screen.getAllByText('Assigned card').length).toBeGreaterThan(0);
    expect(screen.queryByText('Unassigned block')).not.toBeInTheDocument();
  });

  it('assigns list blocks to Kanban columns from a touch-friendly selector', async () => {
    const onAssignKanbanColumn = vi.fn(async () => undefined);
    const block = message('first', 'First');

    renderPane({
      activeConversation: {
        ...conversation,
        kanbanColumns: [{ id: 'doing', title: 'Doing', sortOrder: 1000 }]
      },
      activeMessages: [block],
      messagesByConversation: { [conversation.id]: [block] },
      onAssignKanbanColumn
    });

    fireEvent.change(screen.getByLabelText('Assign to Kanban column'), { target: { value: 'doing' } });

    await waitFor(() => {
      expect(onAssignKanbanColumn).toHaveBeenCalledWith(expect.objectContaining({ id: 'first' }), 'doing');
    });
  });

  it('creates and manages custom Kanban columns', async () => {
    const prompt = vi.spyOn(window, 'prompt');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onAddKanbanColumn = vi.fn(async () => ({ id: 'new-column', title: 'Drafting', sortOrder: 1000 }));
    const onRenameKanbanColumn = vi.fn(async () => undefined);
    const onReorderKanbanColumn = vi.fn(async () => undefined);
    const onDeleteKanbanColumn = vi.fn(async () => undefined);

    prompt.mockReturnValueOnce('Drafting');
    renderPane({
      activeConversation: {
        ...conversation,
        visualizationView: 'kanban',
        kanbanColumns: [
          { id: 'doing', title: 'Doing', sortOrder: 1000 },
          { id: 'done', title: 'Done', sortOrder: 2000 }
        ]
      },
      onAddKanbanColumn,
      onRenameKanbanColumn,
      onReorderKanbanColumn,
      onDeleteKanbanColumn
    });

    fireEvent.click(screen.getByTitle('Add Kanban column'));
    await waitFor(() => expect(onAddKanbanColumn).toHaveBeenCalledWith('Drafting'));

    prompt.mockReturnValueOnce('Renamed');
    fireEvent.click(screen.getAllByTitle('Rename column')[0]);
    expect(onRenameKanbanColumn).toHaveBeenCalledWith('doing', 'Renamed');

    const moveRightButton = screen.getAllByTitle('Move column right').find((button) => !button.hasAttribute('disabled'));
    expect(moveRightButton).toBeDefined();
    fireEvent.click(moveRightButton as HTMLElement);
    expect(onReorderKanbanColumn).toHaveBeenCalledWith('doing', 1);

    fireEvent.click(screen.getAllByTitle('Delete column')[0]);
    expect(confirm).toHaveBeenCalled();
    expect(onDeleteKanbanColumn).toHaveBeenCalledWith('doing');

    prompt.mockRestore();
    confirm.mockRestore();
  });

  it('sends composer blocks into the active Kanban column', async () => {
    const onSubmitMessage = vi.fn(async () => undefined);
    renderPane({
      activeConversation: {
        ...conversation,
        visualizationView: 'kanban',
        kanbanColumns: [
          { id: 'doing', title: 'Doing', sortOrder: 1000 },
          { id: 'done', title: 'Done', sortOrder: 2000 }
        ]
      },
      draft: 'Kanban draft',
      onSubmitMessage
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSubmitMessage).toHaveBeenCalledWith(undefined, [], [], null, 'doing');
    });
  });

  it('shows a compact loading state while synthesizing an index', async () => {
    let resolveSynthesis: () => void = () => undefined;
    const onSynthesizeIndex = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSynthesis = resolve;
        })
    );

    renderPane({ onSynthesizeIndex });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const synthesizeButton = screen.getByTitle('Synthesize conversation index');
    fireEvent.click(synthesizeButton);

    expect(await screen.findByText('Synthesizing conversation index...')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByTitle('Synthesize conversation index')).toBeDisabled();

    await act(async () => {
      resolveSynthesis();
    });

    await waitFor(() => {
      expect(screen.queryByText('Synthesizing conversation index...')).not.toBeInTheDocument();
    });
  });

  it('shows synthesis errors without creating per-block requests', async () => {
    const onSynthesizeIndex = vi.fn(async () => {
      throw new Error('Synthesis unavailable');
    });

    renderPane({ onSynthesizeIndex });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByTitle('Synthesize conversation index'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Synthesis unavailable');
    expect(onSynthesizeIndex).toHaveBeenCalledTimes(1);
  });

  it('renders clickable conversation index lines that navigate to their source blocks', () => {
    const first = message('first', 'First');
    const indexBlock: Message = {
      ...message('index', '1. First idea\nThe opening block.\n\n2. Missing\nDeleted block.'),
      blockKind: 'conversation-index',
      indexEntries: [
        {
          id: 'entry-1',
          sourceMessageId: 'first',
          title: 'First idea',
          summary: 'The opening block.'
        },
        {
          id: 'entry-2',
          sourceMessageId: 'missing',
          title: 'Missing',
          summary: 'Deleted block.'
        }
      ]
    };
    const onNavigateToReference = vi.fn();

    renderPane({
      isInformationMode: true,
      activeMessages: [first, indexBlock],
      messagesByConversation: {
        [conversation.id]: [first, indexBlock]
      },
      onNavigateToReference
    });

    fireEvent.click(screen.getByRole('button', { name: /First idea/ }));

    expect(onNavigateToReference).toHaveBeenCalledWith({
      conversationId: conversation.id,
      messageId: 'first'
    });
    expect(screen.getByRole('button', { name: /Missing/ })).toBeDisabled();
  });
});
