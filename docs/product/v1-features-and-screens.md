# Version 1 Features and Screens

Last updated: 2026-05-13

Related docs: [product brief](v1-product-brief.md), [architecture](../architecture/firebase-pwa-architecture.md), [current implementation](../implementation/current-implementation.md).

## 7. Main features

### 7.1 Google/Gmail login

The user should be able to sign in using Google.

Requirements:

- Show a simple sign-in screen when logged out.
- Use a button like `Continue with Google`.
- After login, load only that user’s conversations and messages.
- Keep the user signed in between sessions where possible.
- Provide a simple sign-out option.

Recommended implementation:

- Firebase Authentication
- Google provider

---

### 7.2 Conversations

The user can create multiple conversations.

Examples:

- Personal Notes
- Work Ideas
- Journal
- Links
- Project A
- Reminders

Conversation features:

- Create a new conversation
- Rename a conversation
- Open a conversation
- See latest message preview
- See last updated time
- Delete a conversation, with confirmation

For Version 1, conversations are private to the signed-in user.

---

### 7.3 Messages

Inside each conversation, the user can create messages.

Each message should show:

- Text
- Created date/time
- Edited indicator, if edited

Required message actions:

- Create message
- Edit message
- Copy message text
- Delete message
- Forward message to another conversation
- Move message to another conversation
- Reorder message within the current conversation

Optional message actions:

- Duplicate message in same conversation

### 7.3.1 Message composer keyboard behavior

The composer should support fast keyboard entry for desktop and hardware-keyboard tablet users.

Requirements:

- `Enter` inserts a new line in the message text.
- `Ctrl+Enter` sends the current block on Windows/Linux.
- `Cmd+Enter` sends the current block on macOS and iPad hardware keyboards.
- Keyboard send should use the same validation as the Send button.
- Empty or whitespace-only messages should not be sent.
- While editing a message, `Ctrl+Enter` / `Cmd+Enter` should save the edit.
- The visible Send/Save button remains available for touch users.

---

### 7.4 Message editing

The user can edit a message after creating it.

Requirements:

- Edit action available from each message.
- Existing message text appears in an edit field.
- User can save or cancel.
- After saving, update the message text.
- Store `updatedAt` timestamp.
- Show a small `edited` label when a message has been changed.

---

### 7.5 Message deletion

The user can delete messages simply and clearly.

Recommended behavior:

- Each message has a delete option.
- Ask for confirmation before deleting.
- Delete should remove the message from the conversation.

For Version 1, use hard delete.

Future option:

- Soft delete using `deletedAt`, allowing undo or recovery.

---

### 7.6 Forward messages between conversations

The user can forward a message or text block from one conversation to another.

Version 1 behavior:

- User opens a message menu.
- User chooses `Forward`.
- App shows a list of conversations.
- User selects target conversation.
- App creates a new message in the target conversation using the same text.

The forwarded message should store optional metadata:

- Original message ID
- Original conversation ID
- Forwarded date/time

Simple display:

- Show the forwarded text as a normal message.
- Optional small label: `Forwarded`.

### 7.6.1 Move messages between conversations

The app supports moving a message from one conversation to another.

Intended behavior:

- User chooses `Move to conversation` from a message action.
- App shows the same conversation picker used for forwarding.
- App creates a replacement message in the target conversation.
- App deletes the original message from the source conversation in the same Firestore batch.
- The moved message stores source metadata so the source conversation can be opened from the moved message.
- The moved message displays a small `Moved` label.


---

### 7.7 Reorder text blocks

The user can manually reorder text blocks inside a conversation.

Recommended Version 1 behavior:

- Each message has simple move up/down reorder controls.
- On touch devices, use explicit move up/down controls rather than drag-only behavior.
- On desktop, drag-and-drop can be added, but keyboard/touch controls should still exist.
- Reordering changes the display order of messages in that conversation only.
- Reordering does not change `createdAt`; creation time remains historical metadata.
- Reordering syncs across signed-in devices.
- Offline reordering should be queued locally and synced when online again.

Recommended data approach:

- Store a numeric `sortOrder` field on each message.
- Display messages by `sortOrder` ascending, then `createdAt` ascending as a fallback.
- When creating a message, assign a `sortOrder` greater than the current last message.
- When forwarding a message into a conversation, append it to the end with a new `sortOrder`.
- For existing messages without `sortOrder`, preserve chronological display order until a reorder action persists explicit values.
- For the first version, move up/down updates the ordered message list with a Firestore batch.

Future option:

- Add drag-and-drop with stable fractional ordering if conversations become long.

---

### 7.8 Message search

The user can search messages.

Version 1 search should be simple.

Requirements:

- Search input at top of conversations or global search screen.
- Search across message text.
- Show matching messages.
- Each result should show:
  - Matching message text
  - Conversation name
  - Created date/time
- Clicking a result opens the conversation.

Simple implementation options:

1. Search locally in currently loaded messages.
2. Query Firestore for basic text fields.
3. Maintain a simple lowercase `searchText` field for each message.

Recommended for Version 1:

> Use a simple client-side search across the user’s cached/loaded messages first.

For a small personal app, this is much simpler than full-text search infrastructure.


---

## 8. Screens

### 8.1 Sign-in screen

Shown when the user is not signed in.

Content:

- App name
- Short description
- `Continue with Google` button

Example text:

```text
My Messages
Private conversations for your own notes and text blocks.

[Continue with Google]
```

---

### 8.2 Conversation list screen

Shows all conversations.

Content:

- Header with app name
- Search button or search input
- New conversation button
- List of conversations
- Sign-out option

Each conversation row should show:

- Conversation title
- Last message preview
- Last updated time

Phone layout:

- Full-screen conversation list
- Tap conversation to open it

Tablet/desktop layout:

- Optional two-column layout
- Conversation list on left
- Active conversation on right

---

### 8.3 Conversation screen

Shows messages in one conversation.

Content:

- Conversation title
- Back button on mobile
- Message list
- Message input at bottom
- Message actions: edit, delete, forward
- Message action: move to another conversation
- Reorder controls for moving text blocks

---

### 8.4 Search screen or search mode

Allows the user to search messages.

Content:

- Search input
- Matching messages
- Conversation name for each result
- Tap result to open message/conversation

---

## 14. Functional requirements

### Authentication

- User can sign in with Google/Gmail.
- User can sign out.
- User stays signed in when returning to the app, where supported.

### Conversations

- User can create a conversation.
- User can rename a conversation.
- User can open a conversation.
- User can delete a conversation.

### Messages

- User can create a message.
- User can send or save a message with `Ctrl+Enter` / `Cmd+Enter`.
- User can edit a message.
- User can delete a message.
- User can forward a message to another conversation.
- User can move a message to another conversation.
- User can reorder messages inside a conversation.
- User can search messages.

### Multi-device

- User can access the same account from iPhone, desktop, and tablet.
- Content syncs between devices when online.

### Offline

- App shell works offline after first load.
- Cached conversations and messages can be read offline.
- New offline changes sync later when online.

---

## 15. Non-functional requirements

### Simplicity

Keep the first version straightforward and avoid unnecessary advanced features.

### Performance

Must work well on iPhone 8.

Guidelines:

- Avoid heavy UI libraries.
- Paginate or limit messages if needed.
- Keep search simple.

### Reliability

The app should not lose messages when offline.

### Responsiveness

The app should adapt to phone, tablet, and desktop screens.

### Privacy

Data should be scoped to the signed-in user.

---

## 17. Acceptance criteria

Version 1 is complete when:

- I can open the app on iPhone 8, desktop, and tablet.
- I can sign in with Google/Gmail.
- I can create conversations.
- I can write messages inside conversations.
- I can refresh the page and still see my messages.
- I can open the same account on another device and see the same messages.
- I can edit a message.
- I can delete a message.
- I can send a new message with `Ctrl+Enter` / `Cmd+Enter`.
- I can search messages.
- I can forward a message from one conversation to another.
- I can move a message from one conversation to another.
- I can reorder text blocks and see the same order after refresh.
- I can open the app offline after it was previously loaded.
- I can read cached content offline.
- I can create or edit messages offline and have them sync when back online.
- I can reorder cached messages offline and have the order sync when back online.

---
