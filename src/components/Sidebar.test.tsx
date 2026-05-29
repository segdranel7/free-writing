import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import type { Conversation, Message } from '../types';

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

function message(id: string, conversationId: string, text: string, tags: string[]): Message {
  return {
    id,
    userId: 'user-1',
    conversationId,
    text,
    searchText: text.toLowerCase(),
    tags,
    references: [],
    createdAt: timestamp(1),
    updatedAt: null,
    scheduledAt: null,
    sortOrder: 1000,
    isForwarded: false,
    transferType: null,
    forwardedFromConversationId: null,
    forwardedFromConversationTitle: null,
    forwardedFromMessageId: null
  };
}

function renderSidebar(overrides: Partial<ComponentProps<typeof Sidebar>> = {}) {
  const conversations = [conversation('first', 'First'), conversation('second', 'Second')];
  const props: ComponentProps<typeof Sidebar> = {
    activeConversation: conversations[0],
    activeConversationId: 'first',
    isCalendarOpen: false,
    conversations,
    searchTerm: '',
    searchResults: [],
    tagSummaries: [],
    selectedTags: [],
    tagResults: [],
    renamingId: null,
    renameDraft: '',
    isExportingAllConversations: false,
    allConversationsExportError: null,
    onSearchTermChange: vi.fn(),
    onToggleTag: vi.fn(),
    onClearTags: vi.fn(),
    onOpenTagResult: vi.fn(),
    onOpenCalendar: vi.fn(),
    onExportAllConversations: vi.fn(),
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
  it('exports all conversations from the app header', () => {
    const props = renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByTitle('Export all conversations'));

    expect(props.onExportAllConversations).toHaveBeenCalledTimes(1);
  });

  it('disables all-conversation export while pending and shows errors', () => {
    const props = renderSidebar({
      isExportingAllConversations: true,
      allConversationsExportError: 'Unable to export conversations.'
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByTitle('Export all conversations')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to export conversations.');
    expect(props.onExportAllConversations).not.toHaveBeenCalled();
  });

  it('shows global tag results and opens the selected block', () => {
    const conversations = [conversation('first', 'First'), conversation('second', 'Second')];
    const props = renderSidebar({
      conversations,
      tagSummaries: [
        { name: 'Urgent', count: 1 },
        { name: 'Later', count: 1 }
      ],
      selectedTags: ['Urgent'],
      tagResults: [{ conversation: conversations[1], message: message('message-2', 'second', 'Tagged note', ['Urgent']) }]
    });

    expect(screen.getByRole('button', { name: /urgent/i })).toHaveClass('active');
    fireEvent.click(screen.getByText('Tagged note'));

    expect(props.onOpenTagResult).toHaveBeenCalledWith('second', 'message-2');
  });

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
    expect(props.onReorderConversation).toHaveBeenCalledWith('first', 'second', 'after');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });

  it('shows the insertion space where the dragged conversation will land', () => {
    renderSidebar();
    const firstConversationHandle = screen.getAllByTitle('Drag conversation')[0];
    const secondConversation = screen.getByText('Second').closest('article') as HTMLElement;
    Object.defineProperty(secondConversation, 'getBoundingClientRect', {
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

    fireEvent.dragStart(firstConversationHandle, {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
        getData: vi.fn(() => 'first')
      }
    });
    const dragOver = createEvent.dragOver(secondConversation);
    Object.defineProperties(dragOver, {
      clientY: { value: 125 },
      dataTransfer: {
        value: {
          dropEffect: ''
        }
      }
    });
    fireEvent(secondConversation, dragOver);

    const indicator = document.querySelector('.conversation-drop-indicator');
    expect(indicator).toBeInTheDocument();
    expect(secondConversation.previousElementSibling).toBe(indicator);
    expect(secondConversation).not.toHaveClass('drag-over');
  });

  it('reorders conversations with native drag-and-drop', () => {
    const props = renderSidebar();
    const firstConversationHandle = screen.getAllByTitle('Drag conversation')[0];
    const secondConversation = screen.getByText('Second').closest('article') as HTMLElement;
    Object.defineProperty(secondConversation, 'getBoundingClientRect', {
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

    fireEvent.dragStart(firstConversationHandle, {
      clientY: 12,
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
        getData: vi.fn(() => 'first')
      }
    });
    const drop = createEvent.drop(secondConversation);
    Object.defineProperties(drop, {
      clientY: { value: 125 },
      dataTransfer: {
        value: {
          getData: vi.fn(() => 'first')
        }
      }
    });
    fireEvent(secondConversation, drop);

    expect(props.onReorderConversation).toHaveBeenCalledWith('first', 'second', 'before');
  });

  it('treats conversation-list gaps as valid pointer drop zones', () => {
    const props = renderSidebar();
    const firstConversation = screen.getByText('First').closest('article') as HTMLElement;
    const firstConversationHandle = screen.getAllByTitle('Drag conversation')[0];
    const secondConversation = screen.getByText('Second').closest('article') as HTMLElement;
    const conversationList = firstConversation.parentElement as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = vi.fn(() => conversationList);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });
    Object.defineProperty(firstConversation, 'getBoundingClientRect', {
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
    Object.defineProperty(secondConversation, 'getBoundingClientRect', {
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

    fireEvent.pointerDown(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 120
    });
    fireEvent.pointerMove(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 220
    });

    const indicator = document.querySelector('.conversation-drop-indicator');
    expect(indicator).toBeInTheDocument();
    expect(secondConversation.previousElementSibling).toBe(indicator);

    fireEvent.pointerUp(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 220
    });

    expect(elementFromPoint).toHaveBeenCalledWith(12, 220);
    expect(props.onReorderConversation).toHaveBeenCalledWith('first', 'second', 'before');

    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint
      });
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });

  it('autoscrolls the conversation list when dragging near the lower edge', () => {
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

    renderSidebar();
    const firstConversation = screen.getByText('First').closest('article') as HTMLElement;
    const firstConversationHandle = screen.getAllByTitle('Drag conversation')[0];
    const secondConversation = screen.getByText('Second').closest('article') as HTMLElement;
    const conversationList = firstConversation.parentElement as HTMLElement;
    const scrollBy = vi.fn();
    Object.defineProperty(conversationList, 'scrollBy', {
      configurable: true,
      value: scrollBy
    });
    Object.defineProperty(conversationList, 'getBoundingClientRect', {
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

    fireEvent.dragStart(firstConversationHandle, {
      clientY: 12,
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
        setDragImage: vi.fn(),
        getData: vi.fn(() => 'first')
      }
    });
    const dragOver = createEvent.dragOver(secondConversation);
    Object.defineProperties(dragOver, {
      clientY: { value: 195 },
      dataTransfer: {
        value: {
          dropEffect: ''
        }
      }
    });
    fireEvent(secondConversation, dragOver);
    expect(hasAnimationFrame).toBe(true);
    animationFrame(0);

    expect(requestAnimationFrame).toHaveBeenCalled();
    expect(scrollBy).toHaveBeenCalledWith({ top: 17 });

    fireEvent.dragEnd(firstConversationHandle);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(123);

    Object.assign(window, {
      requestAnimationFrame: originalRequestAnimationFrame,
      cancelAnimationFrame: originalCancelAnimationFrame
    });
  });

  it('does not select a conversation after completing a reorder drag', () => {
    const props = renderSidebar();
    const firstConversationHandle = screen.getAllByTitle('Drag conversation')[0];
    const firstConversationMain = screen.getByText('First').closest('button') as HTMLButtonElement;
    const secondConversation = screen.getByText('Second').closest('article') as HTMLElement;
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => secondConversation)
    });

    fireEvent.pointerDown(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 12,
      clientY: 12
    });
    fireEvent.pointerUp(firstConversationHandle, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 14,
      clientY: 38
    });
    fireEvent.click(firstConversationMain);

    expect(props.onReorderConversation).toHaveBeenCalledWith('first', 'second', 'after');
    expect(props.onSelectConversation).not.toHaveBeenCalled();

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
