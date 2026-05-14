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
import { requestEnglishVersions } from './services/translation';
import type { Conversation, Message } from './types';

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

  async function handleSubmitMessage() {
    if (!user || !activeConversationId || !draft.trim()) return;
    if (editingMessage) {
      await editMessage(user.uid, activeConversationId, editingMessage.id, draft);
      setEditingMessage(null);
    } else {
      await createMessage(user.uid, activeConversationId, draft);
    }
    setDraft('');
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
    const targetIndex = messageIndex + direction;
    if (targetIndex < 0 || targetIndex >= activeMessages.length) return;
    const nextMessages = [...activeMessages];
    [nextMessages[messageIndex], nextMessages[targetIndex]] = [nextMessages[targetIndex], nextMessages[messageIndex]];
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
    setDraft(message.text);
  }

  function handleCancelEdit() {
    setEditingMessage(null);
    setDraft('');
  }

  function handleNavigateToSource(conversationId: string) {
    setTransferAction(null);
    setSearchTerm('');
    setActiveConversationId(conversationId);
  }

  if (authLoading) {
    return <div className="loading">Loading My Messages...</div>;
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
        activeMessages={activeMessages}
        draft={draft}
        editingMessage={editingMessage}
        onBack={() => setActiveConversationId(null)}
        onDraftChange={setDraft}
        onSubmitMessage={() => void handleSubmitMessage()}
        onCancelEdit={handleCancelEdit}
        onEditMessage={handleEditMessage}
        onForwardMessage={(message) => setTransferAction({ mode: 'forward', message })}
        onMoveToConversation={(message) => setTransferAction({ mode: 'move', message })}
        onNavigateToSource={handleNavigateToSource}
        onDeleteMessage={(message) => void handleDeleteMessage(message)}
        onMoveMessage={(messageIndex, direction) => void handleMoveMessage(messageIndex, direction)}
        onMergeMessages={handleMergeMessages}
        onConvertToEnglish={(message) => requestEnglishVersions(message.text)}
        onCreateEnglishBlock={handleCreateEnglishBlock}
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
