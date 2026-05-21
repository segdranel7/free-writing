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
  createConversationIndexMessage,
  createMessageAfter,
  deleteMessage,
  editMessage,
  forwardMessage,
  mergeMessages,
  moveMessage,
  moveMessageTextSelection,
  reorderMessages,
  updateMessageTags
} from './services/messages';
import { searchLoadedMessages } from './services/search';
import { uploadMessageImages } from './services/storage';
import { requestEnglishVersions } from './services/translation';
import { requestConversationIndex } from './services/synthesis';
import type { Conversation, ConversationIndexEntry, Message, MessageReference } from './types';
import type { DropPosition } from './utils/dropTargets';
import { moveItemToDropPosition, moveMessageByDirection, moveMessageToDropPosition } from './utils/messageOrder';
import type { MessageReferenceNavigationTarget } from './utils/messageReferences';
import { getTagKey, getTagSummaries, messageMatchesAnyTag, normalizeTags } from './utils/tags';
import { executeTransferAction, type TransferAction, type MessageSelection } from './utils/transferActions';
import type { TextSelectionRange } from './utils/textSelection';

type MoveNotice = {
  targetConversationId: string;
  targetConversationTitle: string;
};

function formatConversationIndexText(entries: ConversationIndexEntry[]) {
  return entries
    .map((entry, index) => `${index + 1}. ${entry.title}\n${entry.summary}`)
    .join('\n\n');
}

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
  const [moveNotice, setMoveNotice] = useState<MoveNotice | null>(null);
  const [selectedGlobalTags, setSelectedGlobalTags] = useState<string[]>([]);
  const [selectedConversationTags, setSelectedConversationTags] = useState<string[]>([]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];
  const searchResults = useMemo(
    () => searchLoadedMessages(searchTerm, conversations, messagesByConversation),
    [searchTerm, conversations, messagesByConversation]
  );
  const allMessages = useMemo(
    () => conversations.flatMap((conversation) => messagesByConversation[conversation.id] ?? []),
    [conversations, messagesByConversation]
  );
  const globalTagSummaries = useMemo(() => getTagSummaries(allMessages), [allMessages]);
  const conversationTagSummaries = useMemo(() => getTagSummaries(activeMessages), [activeMessages]);
  const globalTagResults = useMemo(
    () =>
      selectedGlobalTags.length === 0
        ? []
        : conversations.flatMap((conversation) =>
            (messagesByConversation[conversation.id] ?? [])
              .filter((message) => messageMatchesAnyTag(message, selectedGlobalTags))
              .map((message) => ({ conversation, message }))
          ),
    [conversations, messagesByConversation, selectedGlobalTags]
  );

  function getConversationTitle(conversationId: string) {
    return conversations.find((conversation) => conversation.id === conversationId)?.title ?? null;
  }

  function toggleSelectedTag(tags: string[], tag: string) {
    const key = getTagKey(tag);
    return tags.some((currentTag) => getTagKey(currentTag) === key)
      ? tags.filter((currentTag) => getTagKey(currentTag) !== key)
      : normalizeTags([...tags, tag]);
  }

  function selectConversation(conversationId: string | null) {
    setMoveNotice(null);
    if (conversationId !== activeConversationId) {
      setSelectedConversationTags([]);
    }
    setActiveConversationId(conversationId);
  }

  function startTransferAction(action: TransferAction) {
    setMoveNotice(null);
    setTransferAction(action);
  }

  async function handleCreateConversation() {
    if (!user) return;
    const title = window.prompt('Conversation name');
    if (!title?.trim()) return;
    const conversation = await createConversation(user.uid, title);
    selectConversation(conversation.id);
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
    if (activeConversationId === conversation.id) {
      selectConversation(conversations.find((item) => item.id !== conversation.id)?.id ?? null);
    }
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
    messageSelections?: MessageSelection[]
  ) {
    if (!user || !transferAction) return;

    const result = await executeTransferAction(
      user.uid,
      transferAction,
      targetConversationId,
      ranges,
      messageSelections,
      {
        forwardMessage,
        moveMessage,
        moveMessageTextSelection,
        getConversationTitle
      }
    );

    setTransferAction(null);

    if (result.moveNoticeTarget) {
      setMoveNotice(result.moveNoticeTarget);
    } else if (result.navigateToTarget) {
      selectConversation(targetConversationId);
    }
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

  async function handleSynthesizeConversationIndex(messages: Message[], conversationTitle: string) {
    if (!user || !activeConversationId || messages.length === 0) return;
    const index = await requestConversationIndex(messages, conversationTitle);
    await createConversationIndexMessage(
      user.uid,
      activeConversationId,
      formatConversationIndexText(index.entries),
      index.entries
    );
  }

  async function handleUpdateMessageTags(message: Message, tags: string[]) {
    if (!user) return;
    await updateMessageTags(user.uid, message.conversationId, message.id, tags);
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
    setSelectedConversationTags([]);
    setNavigationTarget(target);
    selectConversation(target.conversationId);
  }

  function handleOpenTagResult(conversationId: string, messageId: string) {
    setTransferAction(null);
    setSelectedConversationTags([]);
    setNavigationTarget({ conversationId, messageId });
    selectConversation(conversationId);
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
        tagSummaries={globalTagSummaries}
        selectedTags={selectedGlobalTags}
        tagResults={globalTagResults}
        renamingId={renamingId}
        renameDraft={renameDraft}
        onSearchTermChange={setSearchTerm}
        onToggleTag={(tag) => setSelectedGlobalTags((current) => toggleSelectedTag(current, tag))}
        onClearTags={() => setSelectedGlobalTags([])}
        onOpenTagResult={handleOpenTagResult}
        onCreateConversation={() => void handleCreateConversation()}
        onSelectConversation={selectConversation}
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
        availableTags={conversationTagSummaries}
        tagSuggestions={globalTagSummaries}
        selectedTags={selectedConversationTags}
        messagesByConversation={messagesByConversation}
        navigationTarget={navigationTarget}
        draft={draft}
        editingMessage={editingMessage}
        moveNotice={moveNotice}
        onOpenMoveNotice={() => {
          if (!moveNotice) return;
          selectConversation(moveNotice.targetConversationId);
        }}
        onDismissMoveNotice={() => setMoveNotice(null)}
        onBack={() => selectConversation(null)}
        onDraftChange={setDraft}
        onToggleTag={(tag) => setSelectedConversationTags((current) => toggleSelectedTag(current, tag))}
        onClearTags={() => setSelectedConversationTags([])}
        onSubmitMessage={handleSubmitMessage}
        onCancelEdit={handleCancelEdit}
        onEditMessage={handleEditMessage}
        onSaveEdit={handleSaveEdit}
        onForwardMessage={(message) => startTransferAction({ mode: 'forward', message })}
        onMoveToConversation={(message) => startTransferAction({ mode: 'move', message })}
        onForwardMessages={(messages) => startTransferAction({ mode: 'forward', messages })}
        onMoveMessages={(messages) => startTransferAction({ mode: 'move', messages })}
        onNavigateToReference={handleNavigateToReference}
        onNavigationHandled={() => setNavigationTarget(null)}
        onDeleteMessage={(message) => void handleDeleteMessage(message)}
        onDeleteMessages={handleDeleteMessages}
        onMoveMessage={(messageIndex, direction) => void handleMoveMessage(messageIndex, direction)}
        onReorderMessage={(draggedMessageId, targetMessageId, position) =>
          void handleReorderMessage(draggedMessageId, targetMessageId, position)
        }
        onMergeMessages={handleMergeMessages}
        onSynthesizeIndex={handleSynthesizeConversationIndex}
        onConvertToEnglish={requestEnglishVersions}
        onCreateEnglishBlock={handleCreateEnglishBlock}
        onReplaceWithEnglish={handleReplaceWithEnglish}
        onUpdateMessageTags={(message, tags) => void handleUpdateMessageTags(message, tags)}
      />

      {transferAction && (
        <ForwardModal
          conversations={conversations}
          mode={transferAction.mode}
          sourceMessage={transferAction.message}
          sourceMessages={transferAction.messages}
          onClose={() => setTransferAction(null)}
          onForward={(conversationId, ranges, messageSelections) =>
            void handleForwardMessage(conversationId, ranges, messageSelections)
          }
        />
      )}
    </main>
  );
}
