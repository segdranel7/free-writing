import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Conversation, Message } from './types';

const serviceMocks = vi.hoisted(() => ({
  createMessageWithId: vi.fn(async () => undefined),
  forwardMessage: vi.fn(async () => undefined),
  moveMessage: vi.fn(async () => undefined),
  reserveMessageId: vi.fn(() => 'reserved-message')
}));

const messagingMocks = vi.hoisted(() => ({
  initialMessagesByConversation: {} as Record<string, Message[]>,
  setMessagesByConversation: null as null | Dispatch<SetStateAction<Record<string, Message[]>>>
}));

const timestamp = {
  toDate: () => new Date('2026-05-12T12:00:00Z'),
  toMillis: () => 1
} as Conversation['createdAt'];

const conversations: Conversation[] = [
  {
    id: 'source',
    userId: 'user-1',
    title: 'Source chat',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: ''
  },
  {
    id: 'target',
    userId: 'user-1',
    title: 'Target chat',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: ''
  }
];

const sourceMessage: Message = {
  id: 'source-message',
  userId: 'user-1',
  conversationId: 'source',
  text: 'Transfer this',
  searchText: 'transfer this',
  tags: [],
  references: [],
  createdAt: timestamp,
  updatedAt: null,
  scheduledAt: timestamp,
  sortOrder: 1000,
  isForwarded: false,
  transferType: null,
  forwardedFromConversationId: null,
  forwardedFromConversationTitle: null,
  forwardedFromMessageId: null
};

vi.mock('./hooks/useMessagingData', async () => {
  const React = await import('react');
  return {
    useMessagingData: () => {
      const [activeConversationId, setActiveConversationId] = React.useState<string | null>('source');
      const [messagesByConversation, setMessagesByConversation] = React.useState(messagingMocks.initialMessagesByConversation);
      messagingMocks.setMessagesByConversation = setMessagesByConversation;
      return {
        user: { uid: 'user-1', email: 'writer@example.com', displayName: 'Writer' },
        authLoading: false,
        conversations,
        setConversations: vi.fn(),
        activeConversationId,
        setActiveConversationId,
        messagesByConversation,
        setMessagesByConversation
      };
    }
  };
});

vi.mock('./components/Sidebar', () => ({
  Sidebar: (props: { onOpenCalendar: () => void }) => (
    <button type="button" onClick={props.onOpenCalendar}>
      Calendar
    </button>
  )
}));

vi.mock('./components/ConversationPane', () => ({
  ConversationPane: (props: {
    activeConversation: Conversation | null;
    activeMessages: Message[];
    draft: string;
    moveNotice: { targetConversationTitle: string } | null;
    onOpenMoveNotice: () => void;
    onDraftChange: (value: string) => void;
    onSubmitMessage: (textOverride?: string) => Promise<void>;
    onForwardMessage: (message: Message) => void;
    onMoveToConversation: (message: Message) => void;
  }) => (
    <section>
      <h1>{props.activeConversation?.title ?? 'No conversation'}</h1>
      <p data-testid="draft">{props.draft}</p>
      <input aria-label="Draft" value={props.draft} onChange={(event) => props.onDraftChange(event.target.value)} />
      <ul aria-label="Blocks">
        {props.activeMessages.map((message) => (
          <li key={message.id}>{message.text}</li>
        ))}
      </ul>
      <button type="button" onClick={() => void props.onSubmitMessage().catch(() => undefined)}>
        Send draft
      </button>
      <button type="button" onClick={() => props.onForwardMessage(sourceMessage)}>
        Copy block
      </button>
      <button type="button" onClick={() => props.onMoveToConversation(sourceMessage)}>
        Move block
      </button>
      {props.moveNotice && (
        <div>
          <span>Moved to {props.moveNotice.targetConversationTitle}</span>
          <button type="button" onClick={props.onOpenMoveNotice}>
            Open
          </button>
        </div>
      )}
    </section>
  )
}));

vi.mock('./components/ForwardModal', () => ({
  ForwardModal: (props: { onForward: (conversationId: string) => void }) => (
    <button type="button" onClick={() => props.onForward('target')}>
      Choose target
    </button>
  )
}));

vi.mock('./components/SignInScreen', () => ({
  SignInScreen: () => <div>Sign in</div>
}));

vi.mock('./services/conversations', () => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  reorderConversations: vi.fn(),
  renameConversation: vi.fn()
}));

vi.mock('./services/messages', () => ({
  createMessage: vi.fn(),
  createMessageWithId: serviceMocks.createMessageWithId,
  createConversationIndexMessage: vi.fn(),
  createMessageAfter: vi.fn(),
  deleteMessage: vi.fn(),
  editMessage: vi.fn(),
  forwardMessage: serviceMocks.forwardMessage,
  mergeMessages: vi.fn(),
  moveMessage: serviceMocks.moveMessage,
  moveMessageTextSelection: vi.fn(),
  reserveMessageId: serviceMocks.reserveMessageId,
  reorderMessages: vi.fn(),
  updateMessageReferences: vi.fn(),
  updateMessageTags: vi.fn()
}));

vi.mock('./services/search', () => ({
  searchLoadedMessages: () => []
}));

vi.mock('./services/storage', () => ({
  uploadMessageImages: vi.fn()
}));

vi.mock('./services/translation', () => ({
  requestEnglishVersions: vi.fn(),
  requestStructuredEnglishText: vi.fn()
}));

vi.mock('./services/synthesis', () => ({
  requestConversationIndex: vi.fn()
}));

describe('App transfer navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messagingMocks.initialMessagesByConversation = {
      source: [sourceMessage],
      target: []
    };
    messagingMocks.setMessagesByConversation = null;
    serviceMocks.reserveMessageId.mockReturnValue('reserved-message');
    serviceMocks.createMessageWithId.mockResolvedValue(undefined);
  });

  it('copies a block to the target conversation and navigates there', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose target' }));

    await waitFor(() => {
      expect(serviceMocks.forwardMessage).toHaveBeenCalledWith('user-1', sourceMessage, 'target', 'Source chat');
      expect(screen.getByRole('heading', { name: 'Target chat' })).toBeInTheDocument();
    });
  });

  it('moves a block without navigating until the post-move action is opened', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Move block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose target' }));

    await waitFor(() => {
      expect(serviceMocks.moveMessage).toHaveBeenCalledWith('user-1', sourceMessage, 'target');
      expect(screen.getByRole('heading', { name: 'Source chat' })).toBeInTheDocument();
      expect(screen.getByText('Moved to Target chat')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('heading', { name: 'Target chat' })).toBeInTheDocument();
  });

  it('opens the global calendar and navigates from a dated block', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'This month' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Transfer this/i })[0]);

    expect(screen.getByRole('heading', { name: 'Source chat' })).toBeInTheDocument();
  });

  it('shows a new text block immediately while the write is pending', async () => {
    let resolveWrite: () => void = () => undefined;
    serviceMocks.createMessageWithId.mockImplementation(
      () => new Promise<undefined>((resolve) => {
        resolveWrite = () => resolve(undefined);
      })
    );
    render(<App />);

    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Ready to send' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send draft' }));

    expect(within(screen.getByRole('list', { name: 'Blocks' })).getByText('Ready to send')).toBeInTheDocument();
    expect(screen.getByTestId('draft')).toHaveTextContent('');
    expect(serviceMocks.createMessageWithId).toHaveBeenCalledWith(
      'user-1',
      'source',
      'reserved-message',
      'Ready to send',
      2000,
      [],
      [],
      null
    );

    resolveWrite();
  });

  it('reconciles a confirmed optimistic block without rendering a duplicate', async () => {
    serviceMocks.createMessageWithId.mockImplementation(async () => {
      messagingMocks.setMessagesByConversation?.((current) => ({
        ...current,
        source: [
          ...(current.source ?? []),
          {
            ...sourceMessage,
            id: 'reserved-message',
            text: 'Ready to send',
            searchText: 'ready to send',
            sortOrder: 2000
          }
        ]
      }));
    });
    render(<App />);

    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Ready to send' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send draft' }));

    await waitFor(() => {
      expect(within(screen.getByRole('list', { name: 'Blocks' })).getAllByText('Ready to send')).toHaveLength(1);
    });
  });

  it('removes a failed optimistic block and restores the draft', async () => {
    serviceMocks.createMessageWithId.mockRejectedValue(new Error('Write failed'));
    render(<App />);

    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Ready to send' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send draft' }));

    expect(within(screen.getByRole('list', { name: 'Blocks' })).getByText('Ready to send')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByRole('list', { name: 'Blocks' })).queryByText('Ready to send')).not.toBeInTheDocument();
      expect(screen.getByTestId('draft')).toHaveTextContent('Ready to send');
    });
  });
});
