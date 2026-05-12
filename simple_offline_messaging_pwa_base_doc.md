# Simple Multi-Device Messaging PWA — Base Document

Last updated: 2026-05-12

## 1. App idea

Create a simple private messaging-style PWA inspired by WhatsApp, but designed for personal/exclusive use.

The app should let the user:

- Write messages
- Read saved messages
- Create separate conversations
- Search messages
- Edit messages
- Delete messages
- Send a text block with `Ctrl+Enter` / `Cmd+Enter`
- Forward text blocks between conversations
- Reorder text blocks inside a conversation
- Access the same content from iPhone, desktop, and tablet
- Use the app offline when possible
- Sign in easily using a Google/Gmail account

The app should feel like a minimal private chat app, but the first real version is still much simpler than WhatsApp.

Core idea:

> A private, multi-device, offline-capable message notebook with conversations.

---

## 2. Target devices

The app must work well on:

- iPhone 8
- Desktop computer
- Tablet

### Design implications

The app should be:

- Mobile-first
- Responsive
- Touch-friendly
- Lightweight
- Fast on older devices
- Comfortable on larger screens

### iPhone 8 considerations

The iPhone 8 has a smaller screen than modern phones, so the interface should avoid clutter.

Important UI rules:

- Keep one main action visible at a time.
- Use a simple single-column layout on phones.
- Keep buttons large enough for touch.
- Keep the message input fixed at the bottom.
- Avoid heavy animations.
- Avoid large libraries unless necessary.

---

## 3. Version 1 goal

Build the simplest useful multi-device version.

The user should be able to:

1. Open the app on any supported device.
2. Sign in with Google/Gmail.
3. Create conversations.
4. Write messages inside conversations.
5. Read saved messages.
6. Edit messages.
7. Delete messages.
8. Search messages.
9. Forward/copy text blocks from one conversation to another.
10. Send a block of text from the composer with `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards.
11. Reorder text blocks inside a conversation.
12. Access the same content from iPhone, desktop, and tablet.
13. Continue reading and writing offline when the app has already loaded and local data is cached.

### 3.1 Current implementation snapshot

The current app state is a working Firebase-backed React PWA named `My Messages`.

Implemented:

- Vite + React frontend.
- React code organized into small components, a subscription hook, Firebase services, and utility helpers.
- Firebase Authentication with Google provider.
- Firestore cloud storage under `users/{userId}/conversations/{conversationId}/messages/{messageId}`.
- Firestore security rules scoped to the signed-in user's UID.
- Conversation create, rename, open, and delete.
- Message create, edit, delete, forward, move to another conversation, search, and manual reorder.
- Message transfer support distinguishes forwarded messages from moved messages with `transferType`.
- Composer keyboard send/save with `Ctrl+Enter` / `Cmd+Enter`, while plain `Enter` inserts a newline.
- Responsive phone/desktop layout.
- PWA manifest and generated service worker.
- Firestore persistent local cache is enabled for cached data and offline writes.
- Message order is persisted with numeric `sortOrder` values and syncs across devices.

Known development follow-ups:

- Add focused tests for Firestore rules, offline behavior, keyboard sending, and reorder persistence.
- Add focused UI coverage or manual QA notes for the shared forward/move transfer modal.
- Verify offline create, edit, delete, forward, move, and reorder behavior in a real browser against Firebase/Firestore.
- Consider loading only the active conversation's messages if large conversation lists become slow.
- Consider code-splitting Firebase-heavy client code if the production bundle warning becomes a deployment concern.
- Keep `docs/ai-maintenance/` prompt files current when the recurring AI maintenance workflows change.

---

## 4. Key architecture decision

Because the content must be accessible from any device, the app cannot be only localStorage-based.

The app needs:

- Authentication
- Cloud storage
- Local offline cache
- Sync when online

Recommended simple stack:

```text
Frontend PWA
  + Google/Gmail login
  + Cloud database
  + Offline cache
```

Recommended implementation:

```text
Firebase Authentication + Google Sign-In
Firebase Firestore for cloud data
Firestore offline persistence for offline reads/writes
PWA service worker for offline app shell
Firebase Hosting for the deployed static app
```

Why this is recommended:

- Google login is relatively easy with Firebase Authentication.
- Firestore can sync data across devices.
- Firestore supports offline persistence on the web when enabled.
- A service worker can cache the app shell so the app itself opens offline.
- Firebase Hosting is the chosen hosting target because it fits the existing Firebase Auth and Firestore stack, provides HTTPS, and serves the Vite PWA build directly from `dist/`.

Important note:

> Offline support has two parts: the PWA app shell and the message data cache.

The service worker helps the app open offline. Firestore offline persistence helps cached data remain readable and allows local writes that sync later.

### 4.1 Current stack

The current codebase uses:

- React 19
- Vite 7
- TypeScript
- Firebase JS SDK 12
- `vite-plugin-pwa`
- `lucide-react` for icons

Firebase is configured through a local `.env` file using Vite environment variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

The `.env` file should stay local and must not be committed.

### 4.2 Current frontend code organization

The current React implementation is organized by responsibility so future changes can be made in smaller, safer areas:

```text
src/App.tsx
  Coordinates app state, derived data, and user action handlers.

src/components/SignInScreen.tsx
  Logged-out Firebase sign-in screen.

src/components/Sidebar.tsx
  Search, conversation list, create, rename, delete, and navigation UI.

src/components/ConversationPane.tsx
  Active conversation view, message list, reorder controls, edit state, and composer UI.

src/components/ForwardModal.tsx
  Conversation picker used when forwarding or moving a message.

src/hooks/useMessagingData.ts
  Authentication, conversation, and message subscription lifecycle.

src/services/
  Firebase auth, conversation, message, and search operations.

src/utils/
  Shared formatting and error helpers.
```

Development impact:

- `App.tsx` should stay focused on orchestration and cross-component workflows.
- UI changes should usually start in `src/components/`.
- Firebase read/write behavior should usually start in `src/services/`.
- Subscription and data-loading behavior should usually start in `src/hooks/useMessagingData.ts`.
- Small reusable helpers should live in `src/utils/`.
- Recurring AI maintenance prompts live in `docs/ai-maintenance/`; `docs/ai-maintenance-prompts.md` is only the index.

This structure makes the app easier for an AI coding tool or human developer to modify because each file has a narrower purpose and fewer unrelated concerns.

### 4.3 Hosting decision

The Version 1 app should be deployed with **Firebase Hosting**.

Current hosting configuration:

- `firebase.json` serves the production build from `dist/`.
- All routes rewrite to `/index.html` so the React app can handle navigation.
- Firestore rules are deployed from `firebase.rules`.

Primary deployment flow:

```bash
npm run build
firebase deploy --only hosting
```

Deploy hosting and Firestore rules together when security rules changed:

```bash
firebase deploy --only hosting,firestore:rules
```

After deployment, confirm the Firebase Hosting domain is listed under **Firebase Authentication > Settings > Authorized domains** so Google sign-in works on the hosted app.

Local hosting on an idle machine is not the primary Version 1 deployment target. It remains a possible later option for serving the static `dist/` files privately, but Firebase would still provide authentication, Firestore storage, and cross-device sync unless the backend architecture is changed.

---

## 5. What Version 1 should not include

Avoid these in the first multi-device version:

- Real-time messaging between different people
- Contacts
- Phone numbers
- Groups with multiple users
- Read receipts
- Online/offline presence
- Push notifications
- Media uploads
- Voice notes
- End-to-end encryption
- Complex permissions
- Admin dashboard
- Payment system

This version is still for one private user.

---

## 6. Core user story

As the only user of the app, I want to sign in with Gmail, create private conversations, write and organize text messages, search them, edit them, delete them, and access them from my iPhone, desktop, and tablet, even with limited offline support.

---

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
- Delete message
- Forward message to another conversation
- Move message to another conversation
- Reorder message within the current conversation

Optional message actions:

- Copy message text
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

The current app supports moving a message from one conversation to another.

Intended behavior:

- User chooses `Move to conversation` from a message action.
- App shows the same conversation picker used for forwarding.
- App creates a replacement message in the target conversation.
- App deletes the original message from the source conversation in the same Firestore batch.
- The moved message stores source metadata so the source conversation can be opened from the moved message.
- The moved message displays a small `Moved` label.

Current implementation notes:

- `src/services/messages.ts` has `moveMessage`, which writes the target message and deletes the source message in a Firestore batch.
- Moved messages currently use `isForwarded: true`, `transferType: 'moved'`, `forwardedFromConversationId`, and `forwardedFromMessageId`.
- `src/components/ConversationPane.tsx` includes a `Move to conversation` message action and displays `Moved` or `Forwarded` through `getTransferLabel`.
- `src/App.tsx` models the pending transfer as `{ mode: 'forward' | 'move', message }`.
- `src/components/ForwardModal.tsx` receives `mode` and `sourceMessage`, changes its heading between `Forward to` and `Move to`, and excludes the source conversation from target choices.

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

Future option:

- Add dedicated search service if the message database becomes large.

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

## 9. Data model

### 9.1 User

Authentication is handled by Google/Firebase.

Useful user fields:

```json
{
  "uid": "firebase-user-id",
  "email": "user@gmail.com",
  "displayName": "User Name"
}
```

---

### 9.2 Conversation

```json
{
  "id": "conversation-id",
  "userId": "firebase-user-id",
  "title": "Personal Notes",
  "createdAt": "2026-05-11T12:00:00.000Z",
  "updatedAt": "2026-05-11T12:05:00.000Z",
  "lastMessagePreview": "Short preview of latest message"
}
```

### Conversation fields

`id`
: Unique conversation ID.

`userId`
: Owner of the conversation.

`title`
: Conversation name.

`createdAt`
: When the conversation was created.

`updatedAt`
: When the conversation was last changed.

`lastMessagePreview`
: Short preview of the latest message.

---

### 9.3 Message

```json
{
  "id": "message-id",
  "userId": "firebase-user-id",
  "conversationId": "conversation-id",
  "text": "Message content",
  "searchText": "message content",
  "createdAt": "2026-05-11T12:00:00.000Z",
  "updatedAt": null,
  "sortOrder": 1000,
  "isForwarded": false,
  "transferType": null,
  "forwardedFromConversationId": null,
  "forwardedFromMessageId": null
}
```

### Message fields

`id`
: Unique message ID.

`userId`
: Owner of the message.

`conversationId`
: Conversation where the message belongs.

`text`
: Message content.

`searchText`
: Lowercase version of message content for simple search.

`createdAt`
: When message was created.

`updatedAt`
: When message was edited. Null if never edited.

`sortOrder`
: Numeric display order within a conversation. Messages should be displayed by `sortOrder` ascending, with `createdAt` as a fallback.

`isForwarded`
: Whether this message was forwarded from another conversation.

`transferType`
: Optional transfer label. Current known values are `forwarded`, `moved`, or `null`. This is newer than `isForwarded` and gives the UI a clearer way to distinguish copied forwards from moved messages.

`forwardedFromConversationId`
: Source conversation ID, if forwarded or moved.

`forwardedFromMessageId`
: Source message ID, if forwarded or moved.

---

## 10. Suggested database structure

Recommended Firestore structure:

```text
users/{userId}
  conversations/{conversationId}
    messages/{messageId}
```

Example:

```text
users/abc123/conversations/personal-notes/messages/msg001
```

Benefits:

- Keeps each user’s data separated.
- Makes security rules simpler.
- Makes conversation-level message queries straightforward.

---

## 11. Offline behavior

The app should support offline use as much as possible.

Current implementation:

- Firestore offline persistence is enabled in `src/firebase.ts`.
- The current code initializes Firestore with persistent local cache and a multiple-tab manager.
- The installed Firebase SDK exposes this setting as `localCache`, using `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.

### 11.1 App shell offline

Use a service worker to cache the app shell:

- HTML
- CSS
- JavaScript
- Manifest
- Icons

This lets the app open offline after it has been loaded before.

### 11.2 Data offline

Use Firestore offline persistence.

Expected behavior:

- Previously loaded conversations can be read offline.
- Previously loaded messages can be read offline.
- New messages created offline are saved locally first.
- Offline edits/deletes are saved locally first.
- Offline reorder actions are saved locally first.
- Changes sync to the cloud when the device is online again.

Important limitation:

> Offline access depends on what has already been loaded and cached on that device.

If a conversation was never opened on a device before going offline, it may not be available offline on that device.

---

## 12. Sync behavior

When online:

- New messages should sync to the cloud.
- Edited messages should sync to the cloud.
- Deleted messages should sync to the cloud.
- Forwarded messages should sync to the cloud.
- Moved messages should sync to the cloud.
- Other signed-in devices should receive the updates.

When offline:

- The app should keep working with cached data.
- The app should queue local changes.
- The app should sync when back online.

---

## 13. Security and privacy

Version 1 should protect data by user account.

Minimum security requirements:

- A user can only read their own conversations.
- A user can only write their own conversations.
- A user can only read their own messages.
- A user can only write their own messages.

Recommended Firebase security rule concept:

```text
Allow access only when request.auth.uid equals the userId in the path.
```

Important privacy note:

- Cloud sync means messages are stored in a cloud database.
- This is different from a local-only app.
- For very sensitive content, future encryption should be considered.

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
- Load only the active conversation’s messages at first.
- Keep search simple.

### Reliability

The app should not lose messages when offline.

### Responsiveness

The app should adapt to phone, tablet, and desktop screens.

### Privacy

Data should be scoped to the signed-in user.

---

## 16. Suggested technology options

### Recommended simple stack

```text
Frontend: React, Vue, Svelte, or plain JavaScript
Auth: Firebase Authentication with Google provider
Database: Firestore
Offline data: Firestore offline persistence
PWA: Manifest + service worker
Hosting: Firebase Hosting
```

### Simplest AI-builder-friendly stack

```text
React PWA
Firebase Auth
Firestore
Firebase Hosting
```

This is likely the easiest path if using an AI coding tool.

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

## 18. First build prompt for an AI coding tool

Use this prompt when asking an AI builder to create the first version:

```text
Build a simple multi-device offline-capable PWA called "My Messages".

The app is for one private user. It should feel like a minimal WhatsApp-style app, but it is for writing, organizing, searching, editing, deleting, and forwarding my own text messages between private conversations.

Target devices:
- iPhone 8
- Desktop computer
- Tablet

Core requirements:
- Mobile-first responsive design.
- Simple layout that works well on small iPhone 8 screens.
- Google/Gmail login using Firebase Authentication.
- Cloud sync using Firestore.
- Firestore offline persistence enabled.
- PWA support with manifest and service worker.
- App shell should open offline after first load.
- Cached conversations and messages should be readable offline.
- Offline writes should sync when the device is online again.

Authentication:
- Show a sign-in screen when logged out.
- Add a "Continue with Google" button.
- Keep user data private to the signed-in user.
- Add a sign-out option.

Conversations:
- User can create conversations.
- User can rename conversations.
- User can delete conversations with confirmation.
- Conversation list should show title, latest message preview, and last updated time.

Messages:
- User can create text messages inside a conversation.
- Enter should insert a newline in the composer.
- Ctrl+Enter should send the current text block on Windows/Linux.
- Cmd+Enter should send the current text block on macOS and iPad hardware keyboards.
- User can edit messages.
- User can delete messages with confirmation.
- User can forward a message to another conversation.
- User can move a message to another conversation.
- User can reorder text blocks inside a conversation.
- Forwarding creates a new message in the target conversation with the same text.
- Moving creates a message in the target conversation and removes the original from the source conversation.
- Show an optional "Forwarded" label on forwarded messages.
- Show an optional "Moved" label on moved messages.
- Show an "edited" label if a message was changed.

Search:
- Add simple message search.
- Search across message text.
- Show matching message text, conversation title, and date/time.
- Clicking a search result should open the conversation.

Data model:
- users/{userId}/conversations/{conversationId}
- users/{userId}/conversations/{conversationId}/messages/{messageId}

Conversation fields:
- id
- userId
- title
- createdAt
- updatedAt
- lastMessagePreview

Message fields:
- id
- userId
- conversationId
- text
- searchText
- createdAt
- updatedAt
- sortOrder
- isForwarded
- transferType
- forwardedFromConversationId
- forwardedFromMessageId

Keep the app simple. Do not add contacts, group chat, phone numbers, push notifications, media uploads, voice notes, read receipts, or real messaging between different people.
```

---

## 19. Development order

Build in this order:

1. Responsive app layout
2. Firebase project setup
3. Google/Gmail login
4. Firestore database structure
5. Conversation list
6. Create conversation
7. Open conversation
8. Create message
9. Add `Ctrl+Enter` / `Cmd+Enter` send behavior
10. Sync messages across devices
11. Edit message
12. Delete message
13. Forward message to another conversation
14. Move message to another conversation
15. Reorder text blocks
16. Search messages
17. Add PWA manifest
18. Add service worker
19. Enable Firestore offline persistence
20. Test on iPhone 8
21. Test on desktop
22. Test on tablet
23. Test offline behavior

---

## 20. Version 1 product summary

The first useful version should be:

> A private Google-login PWA where I can create conversations, save text blocks, send with keyboard shortcuts, edit/delete/search/reorder them, forward or move blocks between conversations, and access everything across iPhone, desktop, and tablet, with offline support for cached data.
