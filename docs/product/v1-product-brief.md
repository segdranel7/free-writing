# Version 1 Product Brief

Last updated: 2026-05-26

Related docs: [features and screens](v1-features-and-screens.md), [architecture](../architecture/firebase-pwa-architecture.md), [current implementation](../implementation/current-implementation.md).

## 1. App idea

Create a simple private messaging-style PWA inspired by WhatsApp, but designed for personal/exclusive use.

The app should let the user:

- Write messages
- Attach small images by selecting or pasting them
- Copy text blocks, including attached images where the browser clipboard and paste target support rich clipboard content
- Download text blocks as Markdown `.md` files
- Read saved messages
- Create separate conversations
- Reorder conversations with a drag handle
- Search messages
- Tag or flag message blocks, with fast reuse of tags already created
- Edit messages
- Delete messages
- Open draft English conversion with `Ctrl+Enter` / `Cmd+Enter`
- Send the current draft directly with `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`
- Copy/forward whole text blocks or selected parts of a block between conversations
- Move whole text blocks between conversations
- Add structured references to another conversation or a quoted message block
- Connect saved blocks to other saved blocks and see backlinks
- Reorder text blocks inside a conversation with explicit controls and a drag handle on desktop and touch/pointer devices
- Merge multiple selected text blocks into one unified block
- Convert saved text blocks or draft text into organized English Markdown by choosing from AI-generated variants
- Synthesize a clickable index that maps the current conversation
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
9. Tag or flag message blocks for later filtering, with fast reuse of previously created tags.
10. Attach small images to message blocks by selecting files or pasting copied images.
11. Copy saved blocks to the system clipboard, including attached images where rich clipboard support is available.
12. Download saved text blocks as Markdown `.md` files.
13. Copy/forward whole text blocks or selected parts of a block from one conversation to another, with copied blocks showing their source conversation.
14. Open draft English conversion from the composer with `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards.
15. Send the current draft directly from the composer with `Ctrl+Shift+Enter` on Windows/Linux and `Cmd+Shift+Enter` on macOS/iPad keyboards.
16. Reorder conversations and reorder text blocks inside a conversation with touch-friendly controls and drag handles on desktop and touch/pointer devices.
17. Select multiple text blocks in a conversation and merge them into one unified block, removing the originals.
18. Convert a saved text block or draft text into organized English Markdown by selecting one of three English versions for each segment, then letting AI structure the selected result before it is saved.
19. Connect related saved blocks with whole-block or quote links and see backlinks from connected source blocks.
20. Synthesize a clickable conversation index that maps every current block back to its source.
21. Access the same content from iPhone, desktop, and tablet.
22. Continue reading and writing offline when the app has already loaded and local data is cached.

## 5. What Version 1 should not include

Avoid these in the first multi-device version:

- Real-time messaging between different people
- Contacts
- Phone numbers
- Groups with multiple users
- Read receipts
- Online/offline presence
- Push notifications
- Large/original media uploads
- Audio/video uploads
- Voice notes
- General-purpose AI chat
- End-to-end encryption
- Complex permissions
- Admin dashboard
- Payment system

This version is still for one private user.

---

## 6. Core user story

As the only user of the app, I want to sign in with Gmail, create and organize private conversations, write and organize text/image message blocks, connect related blocks with backlinks, add date/time to blocks and browse them on a calendar, tag or flag blocks for filtering, copy saved blocks out to other apps or download text blocks as Markdown when needed, merge related blocks, forward full blocks or selected parts, move full blocks, keep copied-block origins visible, convert text blocks into organized English Markdown when needed, synthesize clickable conversation maps, search them, edit them, delete them, and access them from my iPhone, desktop, and tablet, even with limited offline support.

---

## 20. Version 1 product summary

The first useful version should be:

> A private Google-login PWA where I can create and organize conversations, save text/image blocks, connect related blocks with backlinks, add date/time to blocks and view them on a calendar, tag or flag blocks with quick reuse suggestions, copy text/images to the clipboard, download text blocks as Markdown files, convert text into organized English Markdown, synthesize clickable conversation indexes, quickly send or convert draft text with keyboard shortcuts, edit/delete/search/reorder/merge blocks, forward whole blocks or selected parts between conversations, move whole blocks between conversations, keep copied blocks' source conversation visible, and access everything across iPhone, desktop, and tablet, with offline support for cached data.
