import { useEffect, useMemo, useState } from 'react';
import { CalendarPane } from './components/CalendarPane';
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
  createMessageWithId,
  createConversationIndexMessage,
  createMessageAfter,
  deleteMessage,
  editMessage,
  forwardMessage,
  mergeMessages,
  moveMessage,
  moveMessageTextSelection,
  reserveMessageId,
  reorderMessages,
  updateMessageReferences,
  updateMessageTags
} from './services/messages';
import { searchLoadedMessages } from './services/search';
import { uploadMessageImages } from './services/storage';
import { requestEnglishVersions, requestStructuredEnglishText } from './services/translation';
import { formatConversationIndexText, requestConversationIndex } from './services/synthesis';
import type { Conversation, Message, MessageReference } from './types';
import type { DropPosition } from './utils/dropTargets';
import { moveItemToDropPosition, moveMessageByDirection, moveMessageToDropPosition } from './utils/messageOrder';
import type { MessageReferenceNavigationTarget } from './utils/messageReferences';
import { getTaggedMessageResults, getTagSummaries, toggleTagSelection } from './utils/tags';
import { executeTransferAction, type TransferAction, type MessageSelection } from './utils/transferActions';
import type { TextSelectionRange } from './utils/textSelection';

type MoveNotice = {
  targetConversationId: string;
  targetConversationTitle: string;
};

const messageSortStep = 1000;

function timestampFromDate(date: Date) {
  return {
    toDate: () => date,
    toMillis: () => date.getTime()
  } as Message['createdAt'];
}

function getMessageMillis(message: Message) {
  return message.createdAt?.toMillis?.() ?? 0;
}

function getNextLocalSortOrder(messages: Message[]) {
  return Math.max(0, ...messages.map((message) => message.sortOrder ?? 0)) + messageSortStep;
}

function sortMessages(messages: Message[]) {
  return [...messages].sort(
    (first, second) =>
      first.sortOrder - second.sortOrder ||
      getMessageMillis(first) - getMessageMillis(second) ||
      first.id.localeCompare(second.id)
  );
}

function mergePendingMessages(
  messagesByConversation: Record<string, Message[]>,
  pendingMessagesByConversation: Record<string, Message[]>
) {
  const conversationIds = new Set([
    ...Object.keys(messagesByConversation),
    ...Object.keys(pendingMessagesByConversation)
  ]);
  const mergedMessagesByConversation: Record<string, Message[]> = {};

  conversationIds.forEach((conversationId) => {
    const persistedMessages = messagesByConversation[conversationId] ?? [];
    const persistedMessageIds = new Set(persistedMessages.map((message) => message.id));
    const pendingMessages = (pendingMessagesByConversation[conversationId] ?? []).filter(
      (message) => !persistedMessageIds.has(message.id)
    );
    mergedMessagesByConversation[conversationId] = sortMessages([...persistedMessages, ...pendingMessages]);
  });

  return mergedMessagesByConversation;
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pendingMessagesByConversation, setPendingMessagesByConversation] = useState<Record<string, Message[]>>({});

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const displayMessagesByConversation = useMemo(
    () => mergePendingMessages(messagesByConversation, pendingMessagesByConversation),
    [messagesByConversation, pendingMessagesByConversation]
  );
  const activeMessages = activeConversationId ? displayMessagesByConversation[activeConversationId] ?? [] : [];
  const searchResults = useMemo(
    () => searchLoadedMessages(searchTerm, conversations, displayMessagesByConversation),
    [searchTerm, conversations, displayMessagesByConversation]
  );
  const allMessages = useMemo(
    () => conversations.flatMap((conversation) => displayMessagesByConversation[conversation.id] ?? []),
    [conversations, displayMessagesByConversation]
  );
  const globalTagSummaries = useMemo(() => getTagSummaries(allMessages), [allMessages]);
  const conversationTagSummaries = useMemo(() => getTagSummaries(activeMessages), [activeMessages]);
  const globalTagResults = useMemo(
    () => getTaggedMessageResults(conversations, displayMessagesByConversation, selectedGlobalTags),
    [conversations, displayMessagesByConversation, selectedGlobalTags]
  );

  useEffect(() => {
    setPendingMessagesByConversation((current) => {
      let didChange = false;
      const next: Record<string, Message[]> = {};

      Object.entries(current).forEach(([conversationId, pendingMessages]) => {
        const persistedMessageIds = new Set((messagesByConversation[conversationId] ?? []).map((message) => message.id));
        const unconfirmedMessages = pendingMessages.filter((message) => !persistedMessageIds.has(message.id));
        if (unconfirmedMessages.length !== pendingMessages.length) didChange = true;
        if (unconfirmedMessages.length > 0) next[conversationId] = unconfirmedMessages;
      });

      return didChange ? next : current;
    });
  }, [messagesByConversation]);

  function getConversationTitle(conversationId: string) {
    return conversations.find((conversation) => conversation.id === conversationId)?.title ?? null;
  }

  function selectConversation(conversationId: string | null) {
    setMoveNotice(null);
    setIsCalendarOpen(false);
    if (conversationId !== activeConversationId) {
      setSelectedConversationTags([]);
    }
    setActiveConversationId(conversationId);
  }

  function openCalendar() {
    setTransferAction(null);
    setSearchTerm('');
    setSelectedGlobalTags([]);
    setIsCalendarOpen(true);
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
    await renameConversation(user.uid, conversation.id, renameDraft, conversation.title);
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

  async function handleSubmitMessage(
    textOverride?: string,
    imageFiles: File[] = [],
    references: MessageReference[] = [],
    scheduledAt: Date | null = null
  ) {
    const messageText = textOverride ?? draft;
    if (!user || !activeConversationId || (!messageText.trim() && imageFiles.length === 0 && references.length === 0)) return;
    if (imageFiles.length === 0) {
      const conversationId = activeConversationId;
      const cleanText = messageText.trim();
      const messageId = reserveMessageId(user.uid, conversationId);
      const sortOrder = getNextLocalSortOrder(displayMessagesByConversation[conversationId] ?? []);
      const pendingMessage: Message = {
        id: messageId,
        userId: user.uid,
        conversationId,
        text: cleanText,
        searchText: cleanText.toLowerCase(),
        tags: [],
        references,
        createdAt: timestampFromDate(new Date()),
        updatedAt: null,
        scheduledAt: scheduledAt as Message['scheduledAt'],
        sortOrder,
        isForwarded: false,
        transferType: null,
        forwardedFromConversationId: null,
        forwardedFromConversationTitle: null,
        forwardedFromMessageId: null,
        isPending: true
      };

      setDraft('');
      setPendingMessagesByConversation((current) => ({
        ...current,
        [conversationId]: [...(current[conversationId] ?? []), pendingMessage]
      }));

      try {
        await createMessageWithId(user.uid, conversationId, messageId, messageText, sortOrder, [], references, scheduledAt);
      } catch (error) {
        setPendingMessagesByConversation((current) => ({
          ...current,
          [conversationId]: (current[conversationId] ?? []).filter((message) => message.id !== messageId)
        }));
        setDraft((currentDraft) => (currentDraft.trim() ? `${cleanText}\n\n${currentDraft}` : cleanText));
        throw error;
      }
      return;
    }

    const attachments =
      imageFiles.length > 0 ? await uploadMessageImages(user.uid, activeConversationId, imageFiles) : [];
    await createMessage(user.uid, activeConversationId, messageText, attachments, references, scheduledAt);
    setDraft('');
  }

  async function handleSaveEdit(
    message: Message,
    text: string,
    imageFiles: File[] = [],
    references: MessageReference[] = message.references ?? [],
    scheduledAt?: Date | null
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
      references,
      scheduledAt
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
    const sourceConversationMessages = displayMessagesByConversation[source.conversationId] ?? [];
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

  async function handleUpdateMessageReferences(message: Message, references: MessageReference[]) {
    if (!user) return;
    await updateMessageReferences(user.uid, message.conversationId, message.id, references);
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

  function handleOpenCalendarMessage(conversationId: string, messageId: string) {
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
        isCalendarOpen={isCalendarOpen}
        conversations={conversations}
        searchTerm={searchTerm}
        searchResults={searchResults}
        tagSummaries={globalTagSummaries}
        selectedTags={selectedGlobalTags}
        tagResults={globalTagResults}
        renamingId={renamingId}
        renameDraft={renameDraft}
        onSearchTermChange={setSearchTerm}
        onToggleTag={(tag) => setSelectedGlobalTags((current) => toggleTagSelection(current, tag))}
        onClearTags={() => setSelectedGlobalTags([])}
        onOpenTagResult={handleOpenTagResult}
        onOpenCalendar={openCalendar}
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

      {isCalendarOpen ? (
        <CalendarPane
          isOpen={isCalendarOpen}
          conversations={conversations}
          messagesByConversation={displayMessagesByConversation}
          onBack={() => selectConversation(null)}
          onOpenMessage={handleOpenCalendarMessage}
        />
      ) : (
        <ConversationPane
          activeConversation={activeConversation}
          conversations={conversations}
          activeMessages={activeMessages}
          availableTags={conversationTagSummaries}
          tagSuggestions={globalTagSummaries}
          selectedTags={selectedConversationTags}
          messagesByConversation={displayMessagesByConversation}
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
          onToggleTag={(tag) => setSelectedConversationTags((current) => toggleTagSelection(current, tag))}
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
          onFormatEnglishText={requestStructuredEnglishText}
          onCreateEnglishBlock={handleCreateEnglishBlock}
          onReplaceWithEnglish={handleReplaceWithEnglish}
          onUpdateMessageTags={(message, tags) => void handleUpdateMessageTags(message, tags)}
          onUpdateMessageReferences={(message, references) => void handleUpdateMessageReferences(message, references)}
        />
      )}

      {transferAction && (
        <ForwardModal
          conversations={conversations}
          mode={transferAction.mode}
          sourceMessage={transferAction.message}
          sourceMessages={transferAction.messages}
          onClose={() => setTransferAction(null)}
          onForward={(conversationId, ranges, messageSelections) =>
            handleForwardMessage(conversationId, ranges, messageSelections)
          }
        />
      )}
    </main>
  );
}
