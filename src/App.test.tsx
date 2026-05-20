import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Conversation, Message } from './types';

const serviceMocks = vi.hoisted(() => ({
  forwardMessage: vi.fn(async () => undefined),
  moveMessage: vi.fn(async () => undefined)
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
  references: [],
  createdAt: timestamp,
  updatedAt: null,
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
      return {
        user: { uid: 'user-1', email: 'writer@example.com', displayName: 'Writer' },
        authLoading: false,
        conversations,
        setConversations: vi.fn(),
        activeConversationId,
        setActiveConversationId,
        messagesByConversation: {
          source: [sourceMessage],
          target: []
        },
        setMessagesByConversation: vi.fn()
      };
    }
  };
});

vi.mock('./components/Sidebar', () => ({
  Sidebar: () => null
}));

vi.mock('./components/ConversationPane', () => ({
  ConversationPane: (props: {
    activeConversation: Conversation | null;
    moveNotice: { targetConversationTitle: string } | null;
    onOpenMoveNotice: () => void;
    onForwardMessage: (message: Message) => void;
    onMoveToConversation: (message: Message) => void;
  }) => (
    <section>
      <h1>{props.activeConversation?.title ?? 'No conversation'}</h1>
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
  createMessageAfter: vi.fn(),
  deleteMessage: vi.fn(),
  editMessage: vi.fn(),
  forwardMessage: serviceMocks.forwardMessage,
  mergeMessages: vi.fn(),
  moveMessage: serviceMocks.moveMessage,
  moveMessageTextSelection: vi.fn(),
  reorderMessages: vi.fn()
}));

vi.mock('./services/search', () => ({
  searchLoadedMessages: () => []
}));

vi.mock('./services/storage', () => ({
  uploadMessageImages: vi.fn()
}));

vi.mock('./services/translation', () => ({
  requestEnglishVersions: vi.fn()
}));

describe('App transfer navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
