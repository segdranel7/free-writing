import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types';
import {
  completeInlineConversationLinkDraft,
  getActiveInlineConversationLinkDraft,
  getInlineConversationLinkSuggestions,
  parseInlineConversationLinks,
  rewriteInlineConversationLinkTitles
} from './inlineConversationLinks';

const timestamp = {
  toMillis: () => 1
} as Conversation['createdAt'];

function conversation(id: string, title: string): Conversation {
  return {
    id,
    userId: 'user-1',
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastMessagePreview: ''
  };
}

describe('inline conversation links', () => {
  it('resolves a unique conversation title inside wiki link markers', () => {
    expect(parseInlineConversationLinks('See [[Source chat]] today', [conversation('source', 'Source chat')])).toEqual([
      { type: 'text', text: 'See ' },
      {
        type: 'conversation-link',
        text: '[[Source chat]]',
        title: 'Source chat',
        conversationId: 'source'
      },
      { type: 'text', text: ' today' }
    ]);
  });

  it('supports multiple links and surrounding punctuation', () => {
    const segments = parseInlineConversationLinks('([[A]]), then [[B]].', [
      conversation('a', 'A'),
      conversation('b', 'B')
    ]);

    expect(segments).toEqual([
      { type: 'text', text: '(' },
      { type: 'conversation-link', text: '[[A]]', title: 'A', conversationId: 'a' },
      { type: 'text', text: '), then ' },
      { type: 'conversation-link', text: '[[B]]', title: 'B', conversationId: 'b' },
      { type: 'text', text: '.' }
    ]);
  });

  it('keeps unmatched, empty, and duplicate-title markers as plain text', () => {
    const conversations = [
      conversation('first-source', 'Source chat'),
      conversation('second-source', 'Source chat')
    ];

    expect(parseInlineConversationLinks('[[Missing]] [[ ]] [[Source chat]]', conversations)).toEqual([
      { type: 'text', text: '[[Missing]] [[ ]] [[Source chat]]' }
    ]);
  });

  it('keeps nested markers as plain text', () => {
    expect(parseInlineConversationLinks('[[Outer [[Inner]]]]', [conversation('inner', 'Inner')])).toEqual([
      { type: 'text', text: '[[Outer [[Inner]]]]' }
    ]);
  });

  it('rewrites matching title markers for conversation renames', () => {
    expect(rewriteInlineConversationLinkTitles('See [[Old title]] and [[ Old title ]]', 'Old title', 'New title')).toBe(
      'See [[New title]] and [[New title]]'
    );
  });

  it('does not rewrite different titles or incomplete markers', () => {
    expect(rewriteInlineConversationLinkTitles('[[Old titles]] [[Missing]', 'Old title', 'New title')).toBe(
      '[[Old titles]] [[Missing]'
    );
  });

  it('detects the active unfinished wiki link at the cursor', () => {
    expect(getActiveInlineConversationLinkDraft('Draft [[Sou', 11)).toEqual({
      startOffset: 6,
      endOffset: 11,
      query: 'Sou'
    });
    expect(getActiveInlineConversationLinkDraft('Draft [[Source]]', 16)).toBeNull();
    expect(getActiveInlineConversationLinkDraft('Draft [[Source\n', 15)).toBeNull();
  });

  it('filters unique conversation title suggestions by typed query', () => {
    const suggestions = getInlineConversationLinkSuggestions(
      [
        conversation('source', 'Source chat'),
        conversation('personal', 'Personal notes'),
        conversation('archive', 'Archived Source'),
        conversation('duplicate-a', 'Duplicate'),
        conversation('duplicate-b', 'Duplicate')
      ],
      'sou'
    );

    expect(suggestions).toEqual([
      { conversationId: 'source', title: 'Source chat' },
      { conversationId: 'archive', title: 'Archived Source' }
    ]);
  });

  it('completes an active wiki link draft with the selected title', () => {
    const draft = getActiveInlineConversationLinkDraft('Ask [[sou tomorrow', 9);
    expect(draft).not.toBeNull();

    expect(completeInlineConversationLinkDraft('Ask [[sou tomorrow', draft!, 'Source chat')).toEqual({
      text: 'Ask [[Source chat]] tomorrow',
      cursorOffset: 19
    });
  });
});
