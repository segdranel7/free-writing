# Firebase PWA Architecture

Last updated: 2026-05-28

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
Cloudflare Worker for server-side AI translation, English organization, and conversation-index synthesis requests
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
  "lastMessagePreview": "Short preview of latest message",
  "sortOrder": 1000,
  "visualizationView": "kanban",
  "kanbanColumns": [
    {
      "id": "kanban-column-id",
      "title": "Drafting",
      "sortOrder": 1000
    }
  ]
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

`sortOrder`
: Numeric display order in the conversation list. Conversations should display by `sortOrder` ascending, with recent update time as a fallback for older records without explicit ordering. Manual conversation reorder rewrites all conversation `sortOrder` values in visible order. When a conversation receives a newly created block, the app assigns that conversation a new top `sortOrder` so it moves above the current first row.

`visualizationView`
: Saved per-conversation view preference. Current known values are `list` and `kanban`; missing or unknown values are treated as `list`.

`kanbanColumns`
: Optional embedded custom Kanban column definitions for the conversation. Columns are ordered by their own numeric `sortOrder`. A conversation can have no Kanban columns; in that case Kanban view opens to an empty setup state rather than creating default columns automatically.

---

### 9.3 Message

```json
{
  "id": "message-id",
  "userId": "firebase-user-id",
  "conversationId": "conversation-id",
  "text": "Message content",
  "searchText": "message content",
  "tags": ["urgent", "idea"],
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
  "references": [
    {
      "id": "block-reference-id",
      "type": "block",
      "sourceConversationId": "source-conversation-id",
      "sourceConversationTitle": "Source title",
      "sourceMessageId": "source-message-id",
      "sourceMessagePreview": "Target block preview"
    },
    {
      "id": "reference-id",
      "type": "quote",
      "sourceConversationId": "source-conversation-id",
      "sourceConversationTitle": "Source title",
      "sourceMessageId": "source-message-id",
      "quoteText": "Selected source text",
      "startOffset": 0,
      "endOffset": 20
    }
  ],
  "createdAt": "2026-05-11T12:00:00.000Z",
  "updatedAt": null,
  "scheduledAt": "2026-05-21T09:30:00.000Z",
  "sortOrder": 1000,
  "kanbanColumnId": "kanban-column-id",
  "kanbanSortOrder": 1000,
  "isForwarded": false,
  "transferType": null,
  "forwardedFromConversationId": null,
  "forwardedFromConversationTitle": null,
  "forwardedFromMessageId": null,
  "blockKind": "conversation-index",
  "indexEntries": [
    {
      "id": "entry-id",
      "sourceMessageId": "source-message-id",
      "title": "Short index title",
      "summary": "Context-aware navigation summary"
    }
  ]
}
```

### Message fields

`id`
: Unique message ID.

New composer text/reference/date-only sends reserve a Firestore document ID on the client before writing. The local pending UI block and the persisted message use the same ID so listener confirmation replaces the optimistic block instead of rendering a duplicate. The pending marker is client-only UI state and is not stored in Firestore.

`userId`
: Owner of the message.

`conversationId`
: Conversation where the message belongs.

`text`
: Message content. Inline conversation links are stored directly in text as `[[Conversation title]]`; rendering resolves them against the user's loaded conversations and hides the bracket markers only when exactly one conversation title matches.

`searchText`
: Lowercase version of message content for simple search.

`tags`
: Free-text labels attached to a block. Tags and flags share this field. The client trims tags, removes empty values, deduplicates them case-insensitively, and preserves the first display casing. Older messages without this field are treated as having no tags.

`attachments`
: Optional array of message attachments. Current supported attachment type is `image`. Images are compressed client-side and stored as inline data URLs in Firestore message documents, so they must stay small enough for Firestore document limits.

`references`
: Structured references attached to the message separately from `text`. A `conversation` reference stores the source conversation ID and title snapshot. A `block` reference stores a source conversation/message ID plus a message preview for whole-block connections. A `quote` reference also stores selected quote text and start/end offsets in the source message. Older messages without this field are treated as having no references. Incoming backlinks are derived client-side from loaded messages that contain `block` or `quote` references; they are not stored as separate reverse-link records.

`createdAt`
: When message was created.

`updatedAt`
: When message was edited. Null if never edited.

`scheduledAt`
: Optional user-assigned date/time used by the global calendar. Null or absent means the block is unscheduled. Older messages without this field are treated as unscheduled.

`sortOrder`
: Numeric display order within a conversation. Messages should be displayed by `sortOrder` ascending, with `createdAt` as a fallback.

`kanbanColumnId`
: Optional custom Kanban column assignment. Blocks without this field or with null remain normal list blocks and do not appear in Kanban until assigned.

`kanbanSortOrder`
: Optional display order inside a Kanban column. Card order is independent from the conversation list `sortOrder` so a block can keep its normal list position while also moving within a Kanban column.

`isForwarded`
: Whether this message was forwarded from another conversation.

`transferType`
: Optional transfer label. Current known values are `forwarded`, `moved`, or `null`. This is newer than `isForwarded` and gives the UI a clearer way to distinguish copied forwards from moved messages.

`forwardedFromConversationId`
: Source conversation ID, if forwarded or moved.

`forwardedFromConversationTitle`
: Optional source conversation title snapshot for copied/forwarded blocks. The UI uses it to render `Copied from [conversation name]`; moved messages keep this null and render only `Moved`.

`forwardedFromMessageId`
: Source message ID, if forwarded or moved.

`blockKind`
: Optional specialized block type. Current known value is `conversation-index`; ordinary messages omit this field.

`indexEntries`
: Optional structured entries for synthesized conversation-index blocks. Each entry points to a source message ID in the same conversation and stores display text for the clickable index row. Old or normal messages without this field are treated as having no index entries.

### 9.4 App-based experimentation exports

Prompt, agent, and flow experiments can start from export files downloaded inside the signed-in app. The app exposes export buttons for the active conversation and for all conversations. Exports use the normal Firebase client SDK and Firestore rules, so no admin credential or separate database access path is required.

Each export creates:

- A JSON bundle with `schemaVersion`, `exportedAt`, `userId`, the full conversation document record, and every message document record.
- A Markdown companion for reading and prompt review.

The JSON bundle is the faithful database snapshot. It preserves inline image data URLs, references, tags, scheduled dates, transfer metadata, Kanban fields, conversation-index entries, and serialized timestamp metadata. The Markdown file intentionally omits inline base64 image payloads and points back to the JSON export for complete attachment data.

This workflow is intentionally export-only. Experiment outputs should not be written back to production Firestore until a separate guarded import or app feature is designed.

Forwarded and moved source metadata is kept for transfer labeling and compatibility. Copied/forwarded blocks can expose conversation-level source navigation through `forwardedFromConversationId` plus `forwardedFromConversationTitle`; whole-block and quote-level navigation is rendered from structured `references` instead of text markers.

Inline conversation links are deliberately schema-free: they use the existing `text` and `searchText` fields, not the structured `references` array. Missing or duplicate title matches remain plain text. Conversation rename writes update matching inline title markers in saved message text and `searchText`, while structured reference title snapshots remain unchanged.

Whole-block copy and move operations preserve tags and `scheduledAt`. Selected-text forwards create target blocks from the selected text; because that text may be only a fragment of the source block, future metadata changes should avoid assuming selected-text forwards describe the full source block.

English conversion results are also stored as normal messages. Creating an English block links the new block back to its source through `forwardedFromConversationId` and `forwardedFromMessageId`, while leaving `transferType` as `null` so it does not display as a forwarded or moved message. The created English block preserves the source block's tags but is unscheduled. Saved-message conversion can target the whole block or selected text ranges; partial conversion sends only the selected text plus surrounding before/after context to the AI proxy, and partial replacement updates only the selected source text while preserving the rest of the block. Whole-block replacement updates the same message through the normal edit path and preserves its existing `scheduledAt`. Converting draft text sends the selected English text directly as a new normal message instead of writing it back into the composer draft, and it preserves current composer image attachments, structured references, and draft date/time on that new message. Before any English result is created, replaced, or sent, the selected segment text goes through a second server-side AI organization pass that returns normal message text, often with Markdown headings, lists, quotes, or paragraph spacing. That pass receives the exact selected segment strings, is instructed to preserve them verbatim, and is rejected by the proxy if any selected segment is removed.

Synthesized conversation indexes are stored as ordinary message documents with `blockKind: "conversation-index"` and `indexEntries`. The `text` field stores a plain fallback/search representation of the generated index, while `indexEntries` drives the clickable rows. Creating an index appends a new bottom message and moves the receiving conversation to the top like other new blocks. Previous index blocks remain normal source blocks and are included in later synthesis requests.

Merged text/image blocks are stored as normal messages. The app creates a replacement message with unified text plus selected attachments in display order, assigns the union of source tags and the earliest selected `scheduledAt`, and deletes the selected original messages in the same batch.

Kanban is the first saved visualization template. The active view is stored on the conversation, custom columns are embedded on the conversation, and card membership/order is stored on each message. Existing blocks are not auto-assigned when columns are created; list view remains the complete fallback for unassigned blocks. New blocks sent while Kanban view is open are assigned to the active Kanban column.

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
- Offline conversation reorder actions are saved locally first.
- Offline merge actions are saved locally first when the selected messages are cached.
- Inline image attachments are cached and synced as part of the Firestore message document. Large images may be rejected before writing if client-side compression cannot keep the document small enough.
- Changes sync to the cloud when the device is online again.

Important limitation:

> Offline access depends on what has already been loaded and cached on that device.

If a conversation was never opened on a device before going offline, it may not be available offline on that device.

AI-backed English conversion, English organization, and conversation-index synthesis are online-only features. Previously created English blocks and synthesized index blocks are cached like other messages, but requesting new conversion options, organizing selected English text, or creating a new index requires network access to the server-side API.

---

## 12. Sync behavior

When online:

- New messages should sync to the cloud.
- Text/reference/date-only sends may render locally before the Firestore write confirms. They should reconcile by message ID when the listener returns the persisted document, and failed writes should remove the pending block and restore the composer state.
- Edited messages should sync to the cloud.
- Deleted messages should sync to the cloud.
- Forwarded messages should sync to the cloud.
- Moved messages should sync to the cloud.
- Conversations that receive newly created messages, forwarded blocks, moved whole blocks, or English result blocks should sync their new top-list `sortOrder`.
- Merged replacement messages and deletion of their originals should sync to the cloud.
- English conversion result messages and replacement edits should sync to the cloud.
- Synthesized conversation index messages should sync to the cloud.
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
- AI conversion, English-organization, and synthesis requests must require a signed-in Firebase user.
- Third-party AI API keys must be stored server-side as Cloudflare Worker secrets for the free hosted deployment.

Recommended Firebase security rule concept:

```text
Allow access only when request.auth.uid equals the userId in the path.
```

Important privacy note:

- Cloud sync means messages are stored in a cloud database.
- Inline image attachments are stored in Firestore message documents, not Firebase Storage.
- English conversion sends the source text selected for conversion to a third-party AI provider through the server-side proxy. For partial saved-message conversion, the request also includes surrounding before/after context for meaning, but the context must not be translated or returned as segments. The selected English result then goes through a second server-side AI organization request before saving or sending. The organization request may add Markdown structure and concise organizational text around the selected English, but it must not remove or rewrite any selected segment.
- Conversation-index synthesis sends the active conversation's current block text/fallback descriptions to the same third-party AI provider through the server-side proxy.
- This is different from a local-only app.
- Repeatable security audits should use `docs/ai-maintenance/security-check.md`, with the default privacy boundary that Firebase cloud storage and explicit AI egress are accepted but other users and unauthenticated visitors must not access another user's content.
- For very sensitive content, future encryption should be considered.

## 13.1 Server-side AI requests

The deployed app should route English conversion, English organization, and conversation-index synthesis requests to the Cloudflare Worker configured by `VITE_TRANSLATION_API_URL`. The browser uses `/api/to-english` for selectable English segments and derives `/api/format-english` for the selected-English organization pass from the same Worker URL. It can derive `/api/synthesize-index` from the same Worker URL, or use `VITE_SYNTHESIS_API_URL` if a separate synthesis endpoint is needed later.

Expected request flow:

```text
Browser
  -> Firebase ID token in Authorization header
  -> Cloudflare Worker verifies the token through Google Identity Toolkit
  -> Worker calls Groq with GROQ_API_KEY secret
  -> Worker returns validated segment/options JSON, organized Markdown text JSON, or validated conversation-index JSON
```

The browser receives only structured AI output. It must never receive the Groq key.

Local Vite development uses the same browser request shape and same-origin `/api/to-english`, `/api/format-english`, and `/api/synthesize-index` paths, but the middleware in `vite.config.ts` verifies Firebase ID-token JWT signatures directly against Google's Firebase public certificates and checks the token audience/issuer against `VITE_FIREBASE_PROJECT_ID`.

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
Cloudflare Worker AI proxy
Firebase Hosting
```

This keeps Firebase on the no-cost Spark plan while preserving a server-side AI key boundary.

---
