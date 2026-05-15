# Firebase PWA Architecture

Last updated: 2026-05-15

Related docs: [product brief](../product/v1-product-brief.md), [features and screens](../product/v1-features-and-screens.md), [current implementation](../implementation/current-implementation.md).

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
Cloudflare Worker for server-side AI translation requests
Firestore offline persistence for offline reads/writes
PWA service worker for offline app shell
Firebase Hosting for the deployed static app
```

Why this is recommended:

- Google login is relatively easy with Firebase Authentication.
- Firestore can sync data across devices.
- Firestore supports offline persistence on the web when enabled.
- Cloudflare Workers keep third-party AI API keys out of browser code while Firebase remains on the no-cost Spark plan.
- A service worker can cache the app shell so the app itself opens offline.
- Firebase Hosting is the chosen hosting target because it fits the existing Firebase Auth and Firestore stack, provides HTTPS, and serves the Vite PWA build directly from `dist/`.
- Small image attachments are stored inline in Firestore message documents after client-side compression. Firebase Storage is intentionally not used because it requires a paid project upgrade for this app.

Important note:

> Offline support has two parts: the PWA app shell and the message data cache.

The service worker helps the app open offline. Firestore offline persistence helps cached data remain readable and allows local writes that sync later.

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
  "attachments": [
    {
      "id": "attachment-id",
      "type": "image",
      "url": "data:image/jpeg;base64,...",
      "name": "pasted-image.png",
      "contentType": "image/jpeg",
      "size": 123456
    }
  ],
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

`attachments`
: Optional array of message attachments. Current supported attachment type is `image`. Images are compressed client-side and stored as inline data URLs in Firestore message documents, so they must stay small enough for Firestore document limits.

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

Source metadata can exist without a visible source label. The UI only renders the source navigation label when `forwardedFromConversationId` is present and the message text contains the literal `<-source` marker; blocks without that marker must not display the label.

English conversion results are also stored as normal messages. Creating an English block links the new block back to its source through `forwardedFromConversationId` and `forwardedFromMessageId`, while leaving `transferType` as `null` so it does not display as a forwarded or moved message. Replacing a source block with English text updates the same message through the normal edit path. Converting draft text sends the selected assembled English text directly as a new normal message instead of writing it back into the composer draft.

Merged text/image blocks are stored as normal messages. Merging does not require extra fields beyond `attachments`; the app creates a replacement message with unified text plus selected attachments in display order and deletes the selected original messages in the same batch.

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
- Offline reorder actions are saved locally first.
- Offline merge actions are saved locally first when the selected messages are cached.
- Inline image attachments are cached and synced as part of the Firestore message document. Large images may be rejected before writing if client-side compression cannot keep the document small enough.
- Changes sync to the cloud when the device is online again.

Important limitation:

> Offline access depends on what has already been loaded and cached on that device.

If a conversation was never opened on a device before going offline, it may not be available offline on that device.

AI-backed English conversion is an online-only feature. Previously created or replaced English blocks are cached like other messages, but requesting new conversion options requires network access to the server-side API.

---

## 12. Sync behavior

When online:

- New messages should sync to the cloud.
- Edited messages should sync to the cloud.
- Deleted messages should sync to the cloud.
- Forwarded messages should sync to the cloud.
- Moved messages should sync to the cloud.
- Merged replacement messages and deletion of their originals should sync to the cloud.
- English conversion result messages and replacement edits should sync to the cloud.
- Inline image attachments should sync as part of their message documents.
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
- AI conversion requests must require a signed-in Firebase user.
- Third-party AI API keys must be stored server-side as Cloudflare Worker secrets for the free hosted deployment.

Recommended Firebase security rule concept:

```text
Allow access only when request.auth.uid equals the userId in the path.
```

Important privacy note:

- Cloud sync means messages are stored in a cloud database.
- Inline image attachments are stored in Firestore message documents, not Firebase Storage.
- English conversion sends the selected source text to a third-party AI provider through the server-side proxy.
- This is different from a local-only app.
- For very sensitive content, future encryption should be considered.

## 13.1 Server-side English conversion

The deployed app should route English conversion requests to the Cloudflare Worker configured by `VITE_TRANSLATION_API_URL`.

Expected request flow:

```text
Browser
  -> Firebase ID token in Authorization header
  -> Cloudflare Worker verifies the token through Google Identity Toolkit
  -> Worker calls Groq with GROQ_API_KEY secret
  -> Worker returns validated segment/options JSON
```

The browser receives only structured translation options. It must never receive the Groq key.

---

## 16. Suggested technology options

### Recommended simple stack

```text
Frontend: React, Vue, Svelte, or plain JavaScript
Auth: Firebase Authentication with Google provider
Database: Firestore
Server API: Cloudflare Worker
Offline data: Firestore offline persistence
PWA: Manifest + service worker
Hosting: Firebase Hosting
```

### Simplest AI-builder-friendly stack

```text
React PWA
Firebase Auth
Firestore
Cloudflare Worker translation proxy
Firebase Hosting
```

This keeps Firebase on the no-cost Spark plan while preserving a server-side AI key boundary.

---
