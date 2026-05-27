# First Build Prompt

Last updated: 2026-05-26

Related docs: [documentation overview](../README.md), [product brief](../product/v1-product-brief.md), [features and screens](../product/v1-features-and-screens.md).

## 18. First build prompt for an AI coding tool

Use this prompt when asking an AI builder to create the first version:

```text
Build a simple multi-device offline-capable PWA called "Free Writing".

The app is for one private user. It should feel like a minimal WhatsApp-style app, but it is for writing, organizing, scheduling dated blocks on a calendar, tagging/filtering, searching, editing, deleting, merging, converting to English, synthesizing clickable conversation indexes, attaching small images, and copying or moving my own message blocks between private conversations.

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
- Server-side AI proxy for text-block English conversion, selected-English Markdown organization, and conversation index synthesis.
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
- Text/reference/date-only sends should render immediately as a pending block, reconcile to one confirmed block by shared Firestore message ID, and restore the composer content if the write fails.
- Repeated Send clicks or direct-send shortcuts while a send is pending should not create duplicate blocks.
- Opening a conversation should position the latest visible block at the bottom of the message list, and sending/appending a new visible block should scroll that block to the bottom.
- Long text blocks should show only a compact preview of roughly three lines until the user expands them with an icon-only control. The same control should collapse the block again.
- User can attach small images to messages by selecting image files or pasting copied images.
- User can create image-only blocks.
- Enter should insert a newline in the composer.
- Ctrl+Enter should open draft English conversion on Windows/Linux.
- Cmd+Enter should open draft English conversion on macOS and iPad hardware keyboards.
- Ctrl+Shift+Enter should send the current draft directly on Windows/Linux.
- Cmd+Shift+Enter should send the current draft directly on macOS and iPad hardware keyboards.
- User can edit messages inline inside the message block, without moving the text into the composer.
- User can paste images while editing a message, preview them, and save them onto that block.
- User can add, edit, clear, and view one scheduled date/time on a block.
- User can open a global Calendar screen from the sidebar and browse dated blocks from all loaded conversations in Today, This week, and This month views.
- Today should use a time-sorted agenda list. This week should group blocks by day. This month should use a month grid on desktop and a date-grouped list on mobile.
- Clicking a calendar item should open the source conversation and highlight the source block.
- User can copy saved blocks to the system clipboard. Text-only blocks copy plain text; blocks with images use best-effort rich clipboard data containing text and attached images, with plain-text fallback when possible.
- User can download a saved text-bearing block as a Markdown `.md` file containing the raw block text. The filename should include a sanitized conversation title, the block creation date, and the block ID.
- User can delete messages with confirmation.
- User can add and remove tags/flags on message blocks. The tag editor should suggest previously created tags from loaded blocks as the user types, exclude tags already on the current block, and support click or Enter selection.
- User can filter loaded blocks by tag globally and within the active conversation.
- User can copy/forward a whole message or selected text parts to another conversation.
- User can move a whole message to another conversation.
- Copy/forward should use a two-step transfer dialog: first select source text with an option to leave nothing selected for the whole block, then choose the target conversation. The source selection step should not show a separate preview because the selected words are visible in the selection area.
- Move should go straight to target conversation selection without a source text selection step.
- Repeated target clicks/taps while the transfer write is pending should not create duplicate copied or moved blocks.
- In the forward transfer dialog, tapping a word toggles it selected/unselected. Pressing and dragging across words with mouse, touch, or pen selects or unselects multiple words depending on the first word's state.
- The forward transfer dialog should support separate non-adjacent selections. Adjacent selected words stay together as a phrase; separate selected parts are sent as separate paragraphs.
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
- User can connect a saved block to any loaded saved block, including same-conversation blocks and self-links, as either a whole-block connection or selected quote-fragment connections.
- Quote-fragment connection selection should use the same click and drag word-selection behavior as the forward transfer dialog, including separate non-adjacent fragments.
- Blocks with incoming saved-block connections should show collapsed backlink rows that expand to clickable source-block cards.
- Copying/forwarding creates a new message in the target conversation with the same text, or with the selected text parts, opens the target conversation, and shows `Copied from [conversation name]` in the copied block metadata with the conversation name clickable.
- Moving creates a message in the target conversation and removes the original from the source conversation.
- Moving leaves the user in the current conversation after completion and shows a non-blocking action to open the target conversation.
- Merging creates one normal replacement message from the selected blocks in display order and removes the selected originals.
- Merging preserves selected image attachments in display order.
- Whole-block copy/move preserves scheduled date/time. Partial text forwards create target blocks from the selected text. Merging keeps the earliest scheduled date/time from the selected blocks.
- English conversion breaks the source text into sentence-level segments and offers three selectable English versions for each segment.
- After the user chooses segment options, send the selected English through a second AI pass that organizes it into a readable Markdown block before saving or sending.
- For saved messages, English conversion can create the organized English Markdown result as a new message below the original or replace the source block with the organized result.
- For draft text, English conversion sends the organized English Markdown result directly as a new message.
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
- scheduledAt
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
- Store created English results as normal messages with `sortOrder` immediately after the source message. The saved text should be the organized Markdown result from the second English pass.
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
10. Add composer keyboard behavior for `Ctrl+Enter` / `Cmd+Enter` draft English conversion and `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` direct send
11. Sync messages across devices
12. Edit message
13. Delete message
14. Copy/forward message to another conversation
15. Move message to another conversation
16. Reorder text blocks
17. Add tags/flags and tag filtering
18. Add date/time scheduling and the global calendar
19. Merge selected text blocks
20. Add English conversion and selected-English Markdown organization through a server-side proxy
21. Add conversation index synthesis through the server-side proxy
22. Search messages
23. Add PWA manifest
24. Add service worker
25. Enable Firestore offline persistence
26. Test on iPhone 8
27. Test on desktop
28. Test on tablet
29. Test offline behavior
30. Test authenticated English conversion, English organization, and index synthesis

---
