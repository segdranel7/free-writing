# Version 1 Product Brief

Last updated: 2026-05-15

Related docs: [features and screens](v1-features-and-screens.md), [architecture](../architecture/firebase-pwa-architecture.md), [current implementation](../implementation/current-implementation.md).

## 1. App idea

Create a simple private messaging-style PWA inspired by WhatsApp, but designed for personal/exclusive use.

The app should let the user:

- Write messages
- Attach small images by selecting or pasting them
- Read saved messages
- Create separate conversations
- Search messages
- Edit messages
- Delete messages
- Open draft English conversion with `Ctrl+Enter` / `Cmd+Enter`
- Forward text blocks between conversations
- Reorder text blocks inside a conversation with explicit controls and drag on desktop and touch/pointer devices
- Merge multiple selected text blocks into one unified block
- Convert saved text blocks or draft text to English by choosing from AI-generated variants
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
9. Attach small images to message blocks by selecting files or pasting copied images.
10. Forward/copy text blocks from one conversation to another.
11. Open draft English conversion from the composer with `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards.
12. Reorder text blocks inside a conversation with touch-friendly controls and drag on desktop and touch/pointer devices.
13. Select multiple text blocks in a conversation and merge them into one unified block, removing the originals.
14. Convert a saved text block or draft text to English by selecting one of three English versions for each segment.
15. Access the same content from iPhone, desktop, and tablet.
16. Continue reading and writing offline when the app has already loaded and local data is cached.

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

As the only user of the app, I want to sign in with Gmail, create private conversations, write and organize text/image message blocks, merge related blocks, convert text blocks to English when needed, search them, edit them, delete them, and access them from my iPhone, desktop, and tablet, even with limited offline support.

---

## 20. Version 1 product summary

The first useful version should be:

> A private Google-login PWA where I can create conversations, save text/image blocks, convert text to English, quickly convert draft text with keyboard shortcuts, edit/delete/search/reorder/merge blocks, forward or move blocks between conversations, and access everything across iPhone, desktop, and tablet, with offline support for cached data.
