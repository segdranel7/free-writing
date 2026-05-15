import { useMemo, useState } from 'react';
import { ConversationPane } from './components/ConversationPane';
import { ForwardModal } from './components/ForwardModal';
import { Sidebar } from './components/Sidebar';
import { SignInScreen } from './components/SignInScreen';
import { useMessagingData } from './hooks/useMessagingData';
import {
  createConversation,
  deleteConversation,
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
  reorderMessages
} from './services/messages';
import { searchLoadedMessages } from './services/search';
import { uploadMessageImages } from './services/storage';
import { requestEnglishVersions } from './services/translation';
import type { Conversation, Message, MessageReference } from './types';
import { moveMessageByDirection, moveMessageToDropTarget } from './utils/messageOrder';
import type { MessageReferenceNavigationTarget } from './utils/messageReferences';

type TransferAction = {
  mode: 'forward' | 'move';
  message: Message;
};

export default function App() {
  const {
    user,
    authLoading,
    conversations,
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

  async function handleForwardMessage(targetConversationId: string) {
    if (!user || !transferAction) return;
    if (transferAction.mode === 'move') {
      await moveMessage(user.uid, transferAction.message, targetConversationId);
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

  async function handleReorderMessage(draggedMessageId: string, targetMessageId: string) {
    if (!user || !activeConversationId) return;
    const nextMessages = moveMessageToDropTarget(activeMessages, draggedMessageId, targetMessageId);
    if (!nextMessages) return;
    setMessagesByConversation((current) => ({
      ...current,
      [activeConversationId]: nextMessages
    }));
    await reorderMessages(user.uid, activeConversationId, nextMessages);
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
        onNavigateToReference={handleNavigateToReference}
        onNavigationHandled={() => setNavigationTarget(null)}
        onDeleteMessage={(message) => void handleDeleteMessage(message)}
        onMoveMessage={(messageIndex, direction) => void handleMoveMessage(messageIndex, direction)}
        onReorderMessage={(draggedMessageId, targetMessageId) =>
          void handleReorderMessage(draggedMessageId, targetMessageId)
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
          onClose={() => setTransferAction(null)}
          onForward={(conversationId) => void handleForwardMessage(conversationId)}
        />
      )}
    </main>
  );
}
