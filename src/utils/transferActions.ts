import type { Message } from '../types';
import { getSelectedTextFromRanges } from './textSelection';
import type { TextSelectionRange } from './textSelection';

type TransferMode = 'forward' | 'move';

export type TransferAction = {
  mode: TransferMode;
  message?: Message;
  messages?: Message[];
};

export type MessageSelection = {
  messageId: string;
  ranges: TextSelectionRange[];
};

export type TransferDependencies = {
  forwardMessage: (
    userId: string,
    source: Message,
    targetConversationId: string,
    sourceConversationTitle: string | null
  ) => Promise<unknown>;
  moveMessage: (userId: string, source: Message, targetConversationId: string) => Promise<unknown>;
  moveMessageTextSelection: (
    userId: string,
    source: Message,
    targetConversationId: string,
    ranges: TextSelectionRange[]
  ) => Promise<unknown>;
  getConversationTitle: (conversationId: string) => string | null;
};

export type TransferOutcome = {
  navigateToTarget: boolean;
  moveNoticeTarget?: {
    targetConversationId: string;
    targetConversationTitle: string;
  };
};

async function executeMessageSelectionTransfer(
  userId: string,
  action: TransferAction,
  targetConversationId: string,
  messageSelections: MessageSelection[] | undefined,
  deps: TransferDependencies
) {
  if (!action.messages) return;

  for (const selection of messageSelections ?? []) {
    const message = action.messages.find((item) => item.id === selection.messageId);
    if (!message) continue;

    if (action.mode === 'move') {
      await deps.moveMessageTextSelection(userId, message, targetConversationId, selection.ranges);
      continue;
    }

    const selectedText = getSelectedTextFromRanges(message.text, selection.ranges);
    if (!selectedText) continue;

    await deps.forwardMessage(
      userId,
      { ...message, text: selectedText },
      targetConversationId,
      deps.getConversationTitle(message.conversationId)
    );
  }
}

async function executeWholeMessagesTransfer(
  userId: string,
  action: TransferAction,
  targetConversationId: string,
  deps: TransferDependencies
) {
  if (!action.messages) return;

  for (const message of action.messages) {
    if (action.mode === 'move') {
      await deps.moveMessage(userId, message, targetConversationId);
    } else {
      await deps.forwardMessage(
        userId,
        message,
        targetConversationId,
        deps.getConversationTitle(message.conversationId)
      );
    }
  }
}

async function executeSingleMessageTransfer(
  userId: string,
  action: TransferAction,
  targetConversationId: string,
  ranges: TextSelectionRange[] | undefined,
  deps: TransferDependencies
) {
  if (!action.message) return;

  if (action.mode === 'move' && ranges && ranges.length > 0) {
    await deps.moveMessageTextSelection(userId, action.message, targetConversationId, ranges);
    return;
  }

  if (action.mode === 'move') {
    await deps.moveMessage(userId, action.message, targetConversationId);
    return;
  }

  if (ranges && ranges.length > 0) {
    const selectedText = getSelectedTextFromRanges(action.message.text, ranges);
    if (selectedText) {
      await deps.forwardMessage(
        userId,
        { ...action.message, text: selectedText },
        targetConversationId,
        deps.getConversationTitle(action.message.conversationId)
      );
      return;
    }
  }

  await deps.forwardMessage(
    userId,
    action.message,
    targetConversationId,
    deps.getConversationTitle(action.message.conversationId)
  );
}

export async function executeTransferAction(
  userId: string,
  action: TransferAction,
  targetConversationId: string,
  ranges: TextSelectionRange[] | undefined,
  messageSelections: MessageSelection[] | undefined,
  deps: TransferDependencies
): Promise<TransferOutcome> {
  if (!action.message && (!action.messages || action.messages.length === 0)) {
    return { navigateToTarget: false };
  }

  if (action.messages && action.messages.length > 0) {
    if (messageSelections && messageSelections.length > 0) {
      await executeMessageSelectionTransfer(userId, action, targetConversationId, messageSelections, deps);
    } else {
      await executeWholeMessagesTransfer(userId, action, targetConversationId, deps);
    }
  } else {
    await executeSingleMessageTransfer(userId, action, targetConversationId, ranges, deps);
  }

  if (action.mode === 'move') {
    return {
      navigateToTarget: false,
      moveNoticeTarget: {
        targetConversationId,
        targetConversationTitle: deps.getConversationTitle(targetConversationId) ?? 'target conversation'
      }
    };
  }

  return { navigateToTarget: true };
}
