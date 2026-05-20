import { useMemo, useState } from 'react';
import { ConversationPane } from './components/ConversationPane';
import { ForwardModal } from './components/ForwardModal';
import { Sidebar } from './components/Sidebar';
import { SignInScreen } from './components/SignInScreen';
import { useMessagingData } from './hooks/useMessagingData';
import {
  createConversation,
  deleteConversation,
  reorderConversations,
  renameConversation
} from './services/conversations';
import {
  createMessage,
  createMessageAfter,
  deleteMessage,
  editMessage,
  forwardMessage,
  mergeMessages,
  moveMessage,
  moveMessageTextSelection,
  reorderMessages
} from './services/messages';
import { searchLoadedMessages } from './services/search';
import { uploadMessageImages } from './services/storage';
import { requestEnglishVersions } from './services/translation';
import type { Conversation, Message, MessageReference } from './types';
import type { DropPosition } from './utils/dropTargets';
import { moveItemToDropPosition, moveMessageByDirection, moveMessageToDropPosition } from './utils/messageOrder';
import type { MessageReferenceNavigationTarget } from './utils/messageReferences';
import { getSelectedTextFromRanges, type TextSelectionRange } from './utils/textSelection';

type TransferAction = {
  mode: 'forward' | 'move';
  message?: Message;
  messages?: Message[];
};

export default function App() {
  const {
    user,
    authLoading,
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    messagesByConversation,
    setMessagesByConversation
  } = useMessagingData();
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [transferAction, setTransferAction] = useState<TransferAction | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<MessageReferenceNavigationTarget | null>(null);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];
  const searchResults = useMemo(
    () => searchLoadedMessages(searchTerm, conversations, messagesByConversation),
    [searchTerm, conversations, messagesByConversation]
  );

  async function handleCreateConversation() {
    if (!user) return;
    const title = window.prompt('Conversation name');
    if (!title?.trim()) return;
    const conversation = await createConversation(user.uid, title);
    setActiveConversationId(conversation.id);
  }

  async function handleRenameConversation(conversation: Conversation) {
    if (!user || !renameDraft.trim()) return;
    await renameConversation(user.uid, conversation.id, renameDraft);
    setRenamingId(null);
    setRenameDraft('');
  }

  async function handleDeleteConversation(conversation: Conversation) {
    if (!user) return;
    if (!window.confirm(`Delete "${conversation.title}"? Messages in this conversation will be removed from the list.`)) {
      return;
    }
    await deleteConversation(user.uid, conversation.id);
    setActiveConversationId((current) => (current === conversation.id ? conversations[0]?.id ?? null : current));
  }

  async function handleSubmitMessage(textOverride?: string, imageFiles: File[] = [], references: MessageReference[] = []) {
    const messageText = textOverride ?? draft;
    if (!user || !activeConversationId || (!messageText.trim() && imageFiles.length === 0 && references.length === 0)) return;
    const attachments =
      imageFiles.length > 0 ? await uploadMessageImages(user.uid, activeConversationId, imageFiles) : [];
    await createMessage(user.uid, activeConversationId, messageText, attachments, references);
    setDraft('');
  }

  async function handleSaveEdit(
    message: Message,
    text: string,
    imageFiles: File[] = [],
    references: MessageReference[] = message.references ?? []
  ) {
    if (
      !user ||
      (!text.trim() && (message.attachments?.length ?? 0) === 0 && imageFiles.length === 0 && references.length === 0)
    ) {
      return;
    }
    const newAttachments =
      imageFiles.length > 0 ? await uploadMessageImages(user.uid, message.conversationId, imageFiles) : [];
    await editMessage(
      user.uid,
      message.conversationId,
      message.id,
      text,
      [...(message.attachments ?? []), ...newAttachments],
      references
    );
    setEditingMessage(null);
  }

  async function handleDeleteMessage(message: Message) {
    if (!user || !window.confirm('Delete this message?')) return;
    await deleteMessage(user.uid, message.conversationId, message.id);
  }

  async function handleDeleteMessages(messages: Message[]) {
    if (!user || messages.length === 0) return;
    if (!window.confirm(`Delete ${messages.length} selected block${messages.length === 1 ? '' : 's'}?`)) return;
    await Promise.all(messages.map((message) => deleteMessage(user.uid, message.conversationId, message.id)));
  }

  async function handleForwardMessage(
    targetConversationId: string,
    ranges?: TextSelectionRange[],
    messageSelections?: Array<{ messageId: string; ranges: TextSelectionRange[] }>
  ) {
    if (!user || !transferAction) return;
    if (transferAction.messages && transferAction.messages.length > 0) {
      const selectedMessages = transferAction.messages;
      if (messageSelections && messageSelections.length > 0) {
        for (const selection of messageSelections) {
          const message = selectedMessages.find((selectedMessage) => selectedMessage.id === selection.messageId);
          if (!message) continue;
          const selectedText = getSelectedTextFromRanges(message.text, selection.ranges);
          if (!selectedText) continue;
          if (transferAction.mode === 'move') {
            await moveMessageTextSelection(user.uid, message, targetConversationId, selection.ranges);
          } else {
            await forwardMessage(user.uid, { ...message, text: selectedText }, targetConversationId);
          }
        }
      } else if (transferAction.mode === 'move') {
        for (const message of selectedMessages) {
          await moveMessage(user.uid, message, targetConversationId);
        }
      } else {
        for (const message of selectedMessages) {
          await forwardMessage(user.uid, message, targetConversationId);
        }
      }
      setTransferAction(null);
      setActiveConversationId(targetConversationId);
      return;
    }

    if (!transferAction.message) return;
    const selectedText = ranges ? getSelectedTextFromRanges(transferAction.message.text, ranges) : '';

    if (transferAction.mode === 'move' && ranges && selectedText) {
      await moveMessageTextSelection(
        user.uid,
        transferAction.message,
        targetConversationId,
        ranges
      );
    } else if (transferAction.mode === 'move') {
      await moveMessage(user.uid, transferAction.message, targetConversationId);
    } else if (ranges && selectedText) {
      await forwardMessage(user.uid, { ...transferAction.message, text: selectedText }, targetConversationId);
    } else {
      await forwardMessage(user.uid, transferAction.message, targetConversationId);
    }
    setTransferAction(null);
    setActiveConversationId(targetConversationId);
  }

  async function handleMoveMessage(messageIndex: number, direction: -1 | 1) {
    if (!user || !activeConversationId) return;
    const nextMessages = moveMessageByDirection(activeMessages, messageIndex, direction);
    if (!nextMessages) return;
    setMessagesByConversation((current) => ({
      ...current,
      [activeConversationId]: nextMessages
    }));
    await reorderMessages(user.uid, activeConversationId, nextMessages);
  }

  async function handleReorderMessage(draggedMessageId: string, targetMessageId: string, position: DropPosition) {
    if (!user || !activeConversationId) return;
    const nextMessages = moveMessageToDropPosition(activeMessages, draggedMessageId, targetMessageId, position);
    if (!nextMessages) return;
    setMessagesByConversation((current) => ({
      ...current,
      [activeConversationId]: nextMessages
    }));
    await reorderMessages(user.uid, activeConversationId, nextMessages);
  }

  async function handleReorderConversation(
    draggedConversationId: string,
    targetConversationId: string,
    position: DropPosition
  ) {
    if (!user) return;
    const nextConversations = moveItemToDropPosition(conversations, draggedConversationId, targetConversationId, position);
    if (!nextConversations) return;
    setConversations(nextConversations);
    await reorderConversations(user.uid, nextConversations);
  }

  async function handleCreateEnglishBlock(source: Message, text: string) {
    if (!user) return;
    const sourceConversationMessages = messagesByConversation[source.conversationId] ?? [];
    await createMessageAfter(user.uid, source.conversationId, source, sourceConversationMessages, text);
  }

  async function handleReplaceWithEnglish(source: Message, text: string) {
    if (!user) return;
    await editMessage(user.uid, source.conversationId, source.id, text);
  }

  async function handleMergeMessages(messages: Message[]) {
    if (!user || !activeConversationId || messages.length < 2) return;
    await mergeMessages(user.uid, activeConversationId, messages);
  }

  function handleStartRename(conversation: Conversation) {
    setRenamingId(conversation.id);
    setRenameDraft(conversation.title);
  }

  function handleEditMessage(message: Message) {
    setEditingMessage(message);
  }

  function handleCancelEdit() {
    setEditingMessage(null);
  }

  function handleNavigateToReference(target: MessageReferenceNavigationTarget) {
    setTransferAction(null);
    setSearchTerm('');
    setNavigationTarget(target);
    setActiveConversationId(target.conversationId);
  }

  if (authLoading) {
    return <div className="loading">Loading Free Writing...</div>;
  }

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <main className="app-shell">
      <Sidebar
        activeConversation={activeConversation}
        activeConversationId={activeConversationId}
        conversations={conversations}
        searchTerm={searchTerm}
        searchResults={searchResults}
        renamingId={renamingId}
        renameDraft={renameDraft}
        onSearchTermChange={setSearchTerm}
        onCreateConversation={() => void handleCreateConversation()}
        onSelectConversation={setActiveConversationId}
        onStartRename={handleStartRename}
        onRenameDraftChange={setRenameDraft}
        onRenameConversation={(conversation) => void handleRenameConversation(conversation)}
        onDeleteConversation={(conversation) => void handleDeleteConversation(conversation)}
        onReorderConversation={(draggedConversationId, targetConversationId, position) =>
          void handleReorderConversation(draggedConversationId, targetConversationId, position)
        }
      />

      <ConversationPane
        activeConversation={activeConversation}
        conversations={conversations}
        activeMessages={activeMessages}
        messagesByConversation={messagesByConversation}
        navigationTarget={navigationTarget}
        draft={draft}
        editingMessage={editingMessage}
        onBack={() => setActiveConversationId(null)}
        onDraftChange={setDraft}
        onSubmitMessage={handleSubmitMessage}
        onCancelEdit={handleCancelEdit}
        onEditMessage={handleEditMessage}
        onSaveEdit={handleSaveEdit}
        onForwardMessage={(message) => setTransferAction({ mode: 'forward', message })}
        onMoveToConversation={(message) => setTransferAction({ mode: 'move', message })}
        onForwardMessages={(messages) => setTransferAction({ mode: 'forward', messages })}
        onMoveMessages={(messages) => setTransferAction({ mode: 'move', messages })}
        onNavigateToReference={handleNavigateToReference}
        onNavigationHandled={() => setNavigationTarget(null)}
        onDeleteMessage={(message) => void handleDeleteMessage(message)}
        onDeleteMessages={handleDeleteMessages}
        onMoveMessage={(messageIndex, direction) => void handleMoveMessage(messageIndex, direction)}
        onReorderMessage={(draggedMessageId, targetMessageId, position) =>
          void handleReorderMessage(draggedMessageId, targetMessageId, position)
        }
        onMergeMessages={handleMergeMessages}
        onConvertToEnglish={requestEnglishVersions}
        onCreateEnglishBlock={handleCreateEnglishBlock}
        onReplaceWithEnglish={handleReplaceWithEnglish}
      />

      {transferAction && (
        <ForwardModal
          conversations={conversations}
          mode={transferAction.mode}
          sourceMessage={transferAction.message}
          sourceMessages={transferAction.messages}
          onClose={() => setTransferAction(null)}
          onForward={(conversationId, ranges) => void handleForwardMessage(conversationId, ranges)}
        />
      )}
    </main>
  );
}
