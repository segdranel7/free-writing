# Simple Multi-Device Messaging PWA — Base Document

## 1. App idea

Create a simple private messaging-style PWA inspired by WhatsApp, but designed for personal/exclusive use.

The app should let the user:

- Write messages
- Read saved messages
- Create separate conversations
- Search messages
- Edit messages
- Delete messages
- Forward text blocks between conversations
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
10. Access the same content from iPhone, desktop, and tablet.
11. Continue reading and writing offline when the app has already loaded and local data is cached.

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
```

Why this is recommended:

- Google login is relatively easy with Firebase Authentication.
- Firestore can sync data across devices.
- Firestore supports offline persistence on the web when enabled.
- A service worker can cache the app shell so the app itself opens offline.

Important note:

> Offline support has two parts: the PWA app shell and the message data cache.

The service worker helps the app open offline. Firestore offline persistence helps cached data remain readable and allows local writes that sync later.

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

Optional message actions:

- Copy message text
- Duplicate message in same conversation

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

---

### 7.7 Message search

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
  "isForwarded": false,
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

`isForwarded`
: Whether this message was forwarded from another conversation.

`forwardedFromConversationId`
: Source conversation ID, if forwarded.

`forwardedFromMessageId`
: Source message ID, if forwarded.

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
- User can edit a message.
- User can delete a message.
- User can forward a message to another conversation.
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
Hosting: Firebase Hosting, Vercel, Netlify, or similar
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
- I can search messages.
- I can forward a message from one conversation to another.
- I can open the app offline after it was previously loaded.
- I can read cached content offline.
- I can create or edit messages offline and have them sync when back online.

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
- User can edit messages.
- User can delete messages with confirmation.
- User can forward a message to another conversation.
- Forwarding creates a new message in the target conversation with the same text.
- Show an optional "Forwarded" label on forwarded messages.
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
- isForwarded
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
9. Sync messages across devices
10. Edit message
11. Delete message
12. Forward message to another conversation
13. Search messages
14. Add PWA manifest
15. Add service worker
16. Enable Firestore offline persistence
17. Test on iPhone 8
18. Test on desktop
19. Test on tablet
20. Test offline behavior

---

## 20. Version 1 product summary

The first useful version should be:

> A private Google-login PWA where I can create conversations, save text messages, edit/delete/search them, forward messages between conversations, and access everything across iPhone, desktop, and tablet, with offline support for cached data.

