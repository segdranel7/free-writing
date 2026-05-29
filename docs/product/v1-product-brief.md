# Version 1 Product Brief

Last updated: 2026-05-29

Related docs: [design principles](design-principles.md), [features and screens](v1-features-and-screens.md), [architecture](../architecture/firebase-pwa-architecture.md), [current implementation](../implementation/current-implementation.md).

## 1. App idea

Create a simple private messaging-style PWA inspired by WhatsApp, but designed for personal/exclusive use.

The app should let the user:

- Write messages
- Attach small images by selecting or pasting them
- Switch to an information-only view that hides most block controls while preserving content and navigation
- Switch between List and Kanban views so the same blocks can be organized in different templates over time
- Copy text blocks, including attached images where the browser clipboard and paste target support rich clipboard content
- Download text blocks as Markdown `.md` files
- Export the active conversation or all conversations as JSON plus Markdown from inside the app
- Read saved messages
- Create separate conversations
- Reorder conversations with a drag handle
- Search messages
- Tag or flag message blocks, with fast reuse of tags already created
- Edit messages
- Delete messages
- Open draft English conversion with `Ctrl+Enter` / `Cmd+Enter`
- Send the current draft directly with `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`
- Write inline `[[Conversation title]]` links with suggestions and touch-friendly insert controls
- Copy/forward whole text blocks or selected parts of a block between conversations
- Move whole text blocks between conversations
- Add structured references to another conversation or a quoted message block
- Connect saved blocks to other saved blocks and see backlinks
- Reorder text blocks inside a conversation with explicit controls and a drag handle on desktop and touch/pointer devices
- Merge multiple selected text blocks into one unified block
- Convert saved text blocks, selected saved-text portions, or draft text into organized English Markdown by choosing from AI-generated variants while preserving the chosen English text
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
- Content-first, with secondary actions progressively disclosed instead of crowding reading and writing surfaces

### iPhone 8 considerations

The iPhone 8 has a smaller screen than modern phones, so the interface should avoid clutter.

Important UI rules:

- Keep one main action visible at a time.
- Use a simple single-column layout on phones.
- Keep buttons large enough for touch.
- Keep the message input fixed at the bottom.
- Keep tight headers limited to navigation, title, primary mode controls, and a More menu for secondary actions.
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
6. Switch into an information-only viewing mode when the user wants to focus on block content.
7. Switch the active conversation between List and custom Kanban views, with column assignment controls that stay usable on a small phone.
8. Edit messages.
9. Delete messages.
10. Search messages.
11. Tag or flag message blocks for later filtering, with fast reuse of previously created tags.
12. Attach small images to message blocks by selecting files or pasting copied images.
13. Copy saved blocks to the system clipboard, including attached images where rich clipboard support is available.
14. Download saved text blocks as Markdown `.md` files.
15. Export the active conversation or all conversations from inside the app as JSON plus Markdown for outside-app experiments.
16. Copy/forward whole text blocks or selected parts of a block from one conversation to another, with copied blocks showing their source conversation.
17. Open draft English conversion from the composer with `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards.
18. Send the current draft directly from the composer with `Ctrl+Shift+Enter` on Windows/Linux and `Cmd+Shift+Enter` on macOS/iPad keyboards.
19. Reorder conversations and reorder text blocks inside a conversation with touch-friendly controls and drag handles on desktop and touch/pointer devices.
20. Select multiple text blocks in a conversation and merge them into one unified block, removing the originals.
21. Convert a saved text block, a selected portion of a saved block, or draft text into organized English Markdown by selecting one of three English versions for each segment, then letting AI structure the selected result before it is saved without removing or rewriting chosen segments.
22. Write inline conversation links from the composer or while editing existing blocks, with `[[` suggestions and a visible insert control for touch devices.
23. Connect related saved blocks with whole-block or quote links and see backlinks from connected source blocks.
24. Synthesize a clickable conversation index that maps every current block back to its source.
25. Access the same content from iPhone, desktop, and tablet.
26. Continue reading and writing offline when the app has already loaded and local data is cached.

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

As the only user of the app, I want to sign in with Gmail, create and organize private conversations, write and organize text/image message blocks, switch to an information-only view when I want to concentrate, view those blocks as a list or as custom Kanban columns, link to related conversations inline, connect related blocks with backlinks, add date/time to blocks and browse them on a calendar, tag or flag blocks for filtering, copy saved blocks out to other apps, download text blocks as Markdown, export conversation records for outside-app experiments, merge related blocks, forward full blocks or selected parts, move full blocks, keep copied-block origins visible, convert whole blocks or selected parts into organized English Markdown when needed, synthesize clickable conversation maps, search them, edit them, delete them, and access them from my iPhone, desktop, and tablet, even with limited offline support.

---

## 20. Version 1 product summary

The first useful version should be:

> A private Google-login PWA where I can create and organize conversations, save text/image blocks, switch to an information-only block view, arrange blocks in List or custom Kanban views, write inline conversation links, connect related blocks with backlinks, add date/time to blocks and view them on a calendar, tag or flag blocks with quick reuse suggestions, copy text/images to the clipboard, download text blocks as Markdown files, export conversation records as JSON plus Markdown, convert whole blocks, selected parts, or draft text into organized English Markdown, synthesize clickable conversation indexes, quickly send or convert draft text with keyboard shortcuts, edit/delete/search/reorder/merge blocks, forward whole blocks or selected parts between conversations, move whole blocks between conversations, keep copied blocks' source conversation visible, and access everything across iPhone, desktop, and tablet, with offline support for cached data.
