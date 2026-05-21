# First Build Prompt

Last updated: 2026-05-21

Related docs: [documentation overview](../README.md), [product brief](../product/v1-product-brief.md), [features and screens](../product/v1-features-and-screens.md).

## 18. First build prompt for an AI coding tool

Use this prompt when asking an AI builder to create the first version:

```text
Build a simple multi-device offline-capable PWA called "Free Writing".

The app is for one private user. It should feel like a minimal WhatsApp-style app, but it is for writing, organizing, tagging/filtering, searching, editing, deleting, merging, converting to English, synthesizing clickable conversation indexes, attaching small images, and copying or moving my own message blocks between private conversations.

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
- Server-side AI proxy for text-block English conversion and conversation index synthesis.
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
- Conversation list should show title and last updated time, without message previews.
- User can reorder conversations in the conversation list with a dedicated drag handle.

Messages:
- User can create text messages inside a conversation.
- User can attach small images to messages by selecting image files or pasting copied images.
- User can create image-only blocks.
- Enter should insert a newline in the composer.
- Ctrl+Enter should open draft English conversion on Windows/Linux.
- Cmd+Enter should open draft English conversion on macOS and iPad hardware keyboards.
- User can edit messages inline inside the message block, without moving the text into the composer.
- User can paste images while editing a message, preview them, and save them onto that block.
- User can copy saved blocks to the system clipboard. Text-only blocks copy plain text; blocks with images use best-effort rich clipboard data containing text and attached images, with plain-text fallback when possible.
- User can delete messages with confirmation.
- User can add and remove tags/flags on message blocks. The tag editor should suggest previously created tags from loaded blocks as the user types, exclude tags already on the current block, and support click or Enter selection.
- User can filter loaded blocks by tag globally and within the active conversation.
- User can copy/forward a whole message or selected text parts to another conversation.
- User can move a whole message or selected text parts to another conversation.
- Copy/move should use a transfer dialog that shows the source text and target conversations. If no text is selected, transfer the whole block.
- In the transfer dialog, tapping a word toggles it selected/unselected. Pressing and dragging across words with mouse, touch, or pen selects or unselects multiple words depending on the first word's state.
- The transfer dialog should support separate non-adjacent selections. Adjacent selected words stay together as a phrase; separate selected parts are sent as separate paragraphs.
- User can reorder text blocks inside a conversation with touch-friendly controls and a dedicated drag handle on desktop and touch/pointer devices.
- Dragging should show a floating preview of the dragged block and an insertion marker in the exact space where the block will land, while normal scrolling remains available from the message body.
- The message list should resolve gaps, padding, and near-miss pointer positions to a valid nearest insertion slot.
- Drag reordering should auto-scroll the visible message list when the user drags near the top or bottom edge so off-screen drop targets remain reachable.
- User can select multiple text blocks inside a conversation and merge them into one unified block.
- Block selection starts with a double-click on desktop or a double-tap on touch devices; after the first block is selected, single clicks/taps toggle other blocks.
- User can convert a text block to English.
- User can convert draft composer text to English and send the selected English result directly.
- User can synthesize a clickable conversation index from the active conversation header.
- Index synthesis should send all visible blocks in display order in one contextual AI request, include previous index blocks, append the new index block to the bottom, and render each generated row as a link to its source block.
- Copying/forwarding creates a new message in the target conversation with the same text, or with the selected text parts, opens the target conversation, and shows `Copied from [conversation name]` in the copied block metadata with the conversation name clickable.
- Moving creates a message in the target conversation and removes the original from the source conversation, or removes only the selected text parts from the source block when partial text is selected.
- Moving leaves the user in the current conversation after completion and shows a non-blocking action to open the target conversation.
- Merging creates one normal replacement message from the selected blocks in display order and removes the selected originals.
- Merging preserves selected image attachments in display order.
- English conversion breaks the source text into sentence-level segments, offers three selectable English versions for each segment, and can create the selected English result as a new message below the original.
- For saved messages, English conversion can also replace the source block with the selected English text.
- For draft text, English conversion sends the selected English text directly as a new message.
- Show an optional "Copied" / "Copied from [conversation name]" label on copied/forwarded messages.
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
- sortOrder

Message fields:
- id
- userId
- conversationId
- text
- searchText
- tags
- createdAt
- updatedAt
- sortOrder
- isForwarded
- transferType
- forwardedFromConversationId
- forwardedFromConversationTitle
- forwardedFromMessageId
- attachments
- references
- blockKind
- indexEntries

AI conversion and synthesis:
- Use a server-side endpoint such as a Cloudflare Worker so the AI provider key is not exposed in browser code.
- Require the signed-in Firebase user for AI requests.
- Store created English results as normal messages with `sortOrder` immediately after the source message.
- Store synthesized conversation indexes as normal bottom messages with `blockKind: "conversation-index"` and structured `indexEntries`.

Image attachment constraints:
- Keep the app on the free Firebase Spark plan.
- Do not use Firebase Storage for Version 1.
- Compress images in the browser and store small image data inline in Firestore message documents.
- Show a clear error if an image is too large for inline storage.
- Saved image previews should be inert when clicked.

Keep the app simple. Do not add contacts, group chat, phone numbers, push notifications, paid media storage, audio/video uploads, voice notes, read receipts, or real messaging between different people.
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
9. Add small inline image attachments through file selection and paste
10. Add `Ctrl+Enter` / `Cmd+Enter` draft English conversion behavior
11. Sync messages across devices
12. Edit message
13. Delete message
14. Copy/forward message to another conversation
15. Move message to another conversation
16. Reorder text blocks
17. Add tags/flags and tag filtering
18. Merge selected text blocks
19. Add English conversion through a server-side proxy
20. Add conversation index synthesis through the server-side proxy
21. Search messages
22. Add PWA manifest
23. Add service worker
24. Enable Firestore offline persistence
25. Test on iPhone 8
26. Test on desktop
27. Test on tablet
28. Test offline behavior
29. Test authenticated English conversion and index synthesis

---
