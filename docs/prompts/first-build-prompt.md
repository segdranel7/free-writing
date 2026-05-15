# First Build Prompt

Last updated: 2026-05-15

Related docs: [documentation overview](../README.md), [product brief](../product/v1-product-brief.md), [features and screens](../product/v1-features-and-screens.md).

## 18. First build prompt for an AI coding tool

Use this prompt when asking an AI builder to create the first version:

```text
Build a simple multi-device offline-capable PWA called "Free Writing".

The app is for one private user. It should feel like a minimal WhatsApp-style app, but it is for writing, organizing, searching, editing, deleting, merging, converting to English, attaching small images, and forwarding my own message blocks between private conversations.

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
- Server-side AI proxy for text-block English conversion.
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

Messages:
- User can create text messages inside a conversation.
- User can attach small images to messages by selecting image files or pasting copied images.
- User can create image-only blocks.
- Enter should insert a newline in the composer.
- Ctrl+Enter should open draft English conversion on Windows/Linux.
- Cmd+Enter should open draft English conversion on macOS and iPad hardware keyboards.
- User can edit messages inline inside the message block, without moving the text into the composer.
- User can paste images while editing a message, preview them, and save them onto that block.
- User can delete messages with confirmation.
- User can forward a message to another conversation.
- User can move a message to another conversation.
- User can reorder text blocks inside a conversation with touch-friendly controls and drag on desktop and touch/pointer devices.
- Drag reordering should auto-scroll the visible message list when the user drags near the top or bottom edge so off-screen drop targets remain reachable.
- User can select multiple text blocks inside a conversation and merge them into one unified block.
- User can convert a text block to English.
- User can convert draft composer text to English and send the selected English result directly.
- Forwarding creates a new message in the target conversation with the same text.
- Moving creates a message in the target conversation and removes the original from the source conversation.
- Merging creates one normal replacement message from the selected blocks in display order and removes the selected originals.
- Merging preserves selected image attachments in display order.
- English conversion breaks the source text into a small number of larger logical segments, offers three selectable English versions for each segment, and can create the selected English result as a new message below the original.
- For saved messages, English conversion can also replace the source block with the selected English text.
- For draft text, English conversion sends the selected English text directly as a new message.
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
- attachments

English conversion:
- Use a server-side endpoint such as a Cloudflare Worker so the AI provider key is not exposed in browser code.
- Require the signed-in Firebase user for conversion requests.
- Store created English results as normal messages with `sortOrder` immediately after the source message.

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
14. Forward message to another conversation
15. Move message to another conversation
16. Reorder text blocks
17. Merge selected text blocks
18. Add English conversion through a server-side proxy
19. Search messages
20. Add PWA manifest
21. Add service worker
22. Enable Firestore offline persistence
23. Test on iPhone 8
24. Test on desktop
25. Test on tablet
26. Test offline behavior
27. Test authenticated English conversion

---
