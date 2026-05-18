import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import type { Conversation } from '../types';

vi.mock('../services/auth', () => ({
  signOutUser: vi.fn(async () => undefined)
}));

const timestamp = (millis: number) =>
  ({
    toDate: () => new Date(millis),
    toMillis: () => millis
  }) as Conversation['createdAt'];

function conversation(id: string, title: string): Conversation {
  return {
    id,
    userId: 'user-1',
    title,
    createdAt: timestamp(1),
    updatedAt: timestamp(1),
    lastMessagePreview: '',
    sortOrder: 1000
  };
}

function renderSidebar(overrides: Partial<ComponentProps<typeof Sidebar>> = {}) {
  const conversations = [conversation('first', 'First'), conversation('second', 'Second')];
  const props: ComponentProps<typeof Sidebar> = {
    activeConversation: conversations[0],
    activeConversationId: 'first',
    conversations,
    searchTerm: '',
    searchResults: [],
    renamingId: null,
    renameDraft: '',
    onSearchTermChange: vi.fn(),
    onCreateConversation: vi.fn(),
    onSelectConversation: vi.fn(),
    onStartRename: vi.fn(),
    onRenameDraftChange: vi.fn(),
    onRenameConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onReorderConversation: vi.fn(),
    ...overrides
  };

  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('starts conversation dragging as soon as the drag handle is pressed', () => {
    const props = renderSidebar();
    const firstConversation = screen.getByText('First').closest('article') as HTMLElement;
    const firstConversationHandle = screen.getAllByTitle('Drag conversation')[0];
    const secondConversation = screen.getByText('Second').closest('article') as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = vi.fn(() => secondConversation);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });

    fireEvent.pointerDown(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 12
    });

    expect(firstConversation).toHaveClass('dragging');
    expect(screen.getByText('First', { selector: '.conversation-drag-preview strong' })).toBeInTheDocument();

    fireEvent.pointerMove(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 14,
      clientY: 38
    });
    fireEvent.pointerUp(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 14,
      clientY: 38
    });

    expect(elementFromPoint).toHaveBeenCalledWith(14, 38);
    expect(props.onReorderConversation).toHaveBeenCalledWith('first', 'second');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });
});
