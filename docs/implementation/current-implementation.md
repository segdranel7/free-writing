# Current Implementation

Last updated: 2026-05-15

Related docs: [documentation overview](../README.md), [product brief](../product/v1-product-brief.md), [architecture](../architecture/firebase-pwa-architecture.md), [QA checklist](../qa-v1-verification.md).

## Current implementation snapshot

The current app state is a working Firebase-backed React PWA named `Free Writing`.

Implemented:

- Vite + React frontend.
- Focused Vitest coverage for message service writes, inline image attachments and paste handling, loaded-message search, composer keyboard conversion behavior, inline editing, reorder controls, desktop and touch drag-to-reorder behavior including edge autoscroll, multi-block merge, English conversion UI/service/helper behavior, and the shared forward/move modal.
- React code organized into small components, a subscription hook, Firebase services, and utility helpers.
- Firebase Authentication with Google provider.
- Firebase configuration guard that shows a setup notice when `.env` is missing or still contains placeholder values.
- Firestore cloud storage under `users/{userId}/conversations/{conversationId}/messages/{messageId}`.
- Firestore security rules scoped to the signed-in user's UID.
- Conversation create, rename, open, and delete.
- Conversation list rows show conversation title and updated time only; they intentionally do not render stored message previews.
- Message create, edit, copy-to-clipboard, delete, forward, move to another conversation, structured conversation links and quote citations, search, manual up/down reorder, drag reorder on desktop and touch/pointer devices with message-list edge autoscroll, and selected-block merge.
- Small image attachments on new and edited blocks. Images can be selected, pasted into the composer, pasted through a touch-friendly clipboard action where the browser permits it, or pasted while editing an existing block.
- Image attachments are compressed in the browser and stored inline in Firestore message documents. Firebase Storage is intentionally not used so the app stays on the free Spark plan.
- English conversion for saved messages and composer draft text. It segments text, presents three English options per segment, and can create a new message below a saved source, replace a saved source, or send selected draft English text directly as a new message.
- Message transfer support distinguishes forwarded messages from moved messages with `transferType`.
- Composer `Ctrl+Enter` / `Cmd+Enter` opens draft English conversion, while plain `Enter` inserts a newline. Inline message edits use `Ctrl+Enter` / `Cmd+Enter` to save.
- Responsive phone/desktop layout.
- Conversation pane layout is constrained to the viewport; only the message list scrolls, keeping the conversation header, merge toolbar, and composer visible in long conversations.
- Dark visual theme across sign-in, sidebar, conversation pane, composer, message bubbles, modal, and hover states.
- PWA manifest and generated service worker.
- Browser/PWA theme colors are aligned to the dark app shell color.
- Firestore persistent local cache is enabled for cached data and offline writes.
- Message order is persisted with numeric `sortOrder` values and syncs across devices.
- Search runs across messages loaded by Firestore subscriptions; the current hook subscribes to every conversation's messages after the conversation list loads.
- Cloudflare Worker backend proxy for hosted English conversion.
- Local Vite development middleware for `/api/to-english` so Codespaces/Vite testing works without Firebase Hosting rewrites.

Known development follow-ups:

- Keep `docs/qa-v1-verification.md` current as Firebase/offline behavior changes.
- Add emulator-backed Firestore rules tests if rule complexity grows beyond the current per-user UID isolation model.
- Verify offline create, edit, delete, forward, move, reorder by controls, reorder by drag on desktop and mobile/touch devices, and merge behavior in a real browser against Firebase/Firestore.
- Consider loading only the active conversation's messages or adding a search index if large conversation lists become slow; this would require revisiting current loaded-message search behavior.
- Consider code-splitting Firebase-heavy client code if the production bundle warning becomes a deployment concern.
- Recompute or clear stored conversation previews after message delete, merge-original deletion, and move-source deletion if `lastMessagePreview` is reused in UI later.
- Watch Firestore document size if image usage grows. Inline images keep the app free, but they are bounded by Firestore document limits and are intended for small screenshots/images rather than large media libraries.
- Add explicit loading/error UI around Firestore subscriptions if snapshot failures need to be surfaced beyond console/dev tooling.
- Keep `docs/ai-maintenance/` prompt files current when the recurring AI maintenance workflows change.

## Current stack

The current codebase uses:

- React 19
- Vite 7
- TypeScript
- Firebase JS SDK 12
- Cloudflare Worker in `workers/translation/` for the hosted Groq proxy
- Legacy Firebase Functions and Admin SDK in the `functions/` package
- `vite-plugin-pwa`
- `lucide-react` for icons
- Groq Chat Completions for English conversion through a server-side proxy

Current visual system:

- `src/styles.css` is a single global stylesheet rather than a component-scoped CSS system.
- The UI uses a dark base (`#101719`) with dark panel surfaces and bright teal action accents.
- `:root` declares `color-scheme: dark` so native form controls and browser defaults align with the app theme.
- Keep theme changes coordinated with `index.html` `theme-color` and `vite.config.ts` manifest `theme_color` / `background_color`.

Firebase is configured through a local `.env` file using Vite environment variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_TRANSLATION_API_URL=
```

The `.env` file should stay local and must not be committed. `VITE_FIREBASE_STORAGE_BUCKET` can be blank; image attachments are compressed client-side and stored inline in Firestore message documents so the app stays compatible with the free Firebase Spark plan.

`VITE_TRANSLATION_API_URL` is optional for local Vite dev. Leave it blank locally to use the same-origin `/api/to-english` middleware in `vite.config.ts`. For the hosted app, set it to the deployed Cloudflare Worker URL before building production.

For local Vite-only translation testing, `GROQ_API_KEY` may be stored in ignored `.env` without the `VITE_` prefix. For Cloudflare Worker local testing, copy `.dev.vars.example` to `.dev.vars`. For the deployed Worker, set secrets with Wrangler:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FIREBASE_API_KEY
```

Current setup behavior:

- `src/firebase.ts` treats empty values and common placeholder values as unconfigured.
- When Firebase is not configured, `app`, `auth`, `googleProvider`, and `db` remain `null`.
- `src/components/SignInScreen.tsx` disables Google sign-in and shows a setup notice instead of letting Firebase initialization fail.
- Service functions call `requireAuth()` or `requireDb()` so accidental use without real Firebase config produces a clear error.

## Current frontend code organization

The current React implementation is organized by responsibility so future changes can be made in smaller, safer areas:

```text
src/App.tsx
  Coordinates app state, derived data, and user action handlers.

src/components/SignInScreen.tsx
  Logged-out Firebase sign-in screen.

src/components/Sidebar.tsx
  Search, conversation list, create, rename, delete, and navigation UI. Normal conversation rows show title and updated time; search results still show matching message text for context.

src/components/ConversationPane.tsx
  Active conversation view, selected-message state, copy/edit/transfer/reorder/drag-and-drop/merge/English conversion orchestration, reference picker state, conversion picker state, and inline edit/image-paste state.

src/components/MessageBubble.tsx
  Per-message rendering and local action wiring. Owns message metadata display, inert image attachment previews, structured reference cards, inline edit form markup, copy feedback label, reorder buttons, transfer/delete/English action buttons, and drag/pointer event binding passed down from `ConversationPane`.

src/components/MessageComposer.tsx
  Draft composer rendering, pending reference chips, image selection/paste previews, and keyboard behavior. Owns the composer form markup, draft textarea, visible send action, and `Ctrl+Enter` / `Cmd+Enter` draft English conversion shortcut passed down from `ConversationPane`.

src/components/EnglishPickerModal.tsx
  English conversion dialog rendering. Receives picker state and callbacks from `ConversationPane`, renders loading/error/ready/saving states, option radios, preview, and saved-message or draft-specific actions.

src/components/ForwardModal.tsx
  Conversation picker used when forwarding or moving a message.

src/hooks/useMessagingData.ts
  Authentication, conversation, and message subscription lifecycle.
  After sign-in, subscribes to the conversation list and then to every conversation's messages.
  This keeps loaded-message search simple, but can become expensive for large datasets.
  It does not currently expose per-subscription loading or error states to the UI.

src/services/
  Firebase auth, conversation, message, image preparation, search, and translation request operations.
  `messages.ts` keeps Firestore message write payload construction in small local helpers so create, transfer, merge, image attachment, and English-result writes share the same field defaults.
  `storage.ts` is named for historical upload intent but currently performs free-plan client-side image compression and inline attachment construction; it does not call Firebase Storage.

workers/translation/index.ts
  Cloudflare Worker for authenticated English conversion requests. Verifies Firebase ID tokens through Google Identity Toolkit, calls Groq with the `GROQ_API_KEY` secret, validates the JSON shape, and returns segment/options data.

functions/src/index.ts
  Legacy Firebase Function version of the translation proxy. Firebase Functions require the Blaze plan and are not used by the default free hosted deployment.

src/utils/
  Shared formatting, error, ordering, and small pure text helpers. `englishConversion.ts` assembles selected English conversion segment options into the preview/saved text. `messageOrder.ts` computes behavior-preserving message reorder arrays for up/down controls and drag/drop targets.

src/styles.css
  Global dark theme, responsive layout, viewport-constrained conversation pane, component surfaces, input states, message bubbles, drag reorder states, modal styling, English picker styling, and hover states.

index.html + vite.config.ts
  Browser theme color, generated PWA manifest colors, and local `/api/to-english` development middleware. Theme colors currently match the dark app shell so installed/mobile surfaces do not flash the old light theme.
```

Development impact:

- `App.tsx` should stay focused on orchestration and cross-component workflows.
- UI changes should usually start in `src/components/`.
- Theme and layout styling changes should usually start in `src/styles.css`, then update PWA theme colors if the app shell color changes. The app shell and active conversation pane are viewport-height flex layouts; keep message-list scrolling isolated so the header, merge toolbar, and composer remain reachable.
- Firebase read/write behavior should usually start in `src/services/`.
- Hosted translation backend behavior should usually start in `workers/translation/index.ts`; local-only Vite proxy behavior lives in `vite.config.ts`. `functions/src/index.ts` is legacy Firebase Functions code and is not used by the free hosted path.
- Subscription and data-loading behavior should usually start in `src/hooks/useMessagingData.ts`.
- Small reusable helpers should live in `src/utils/`.
- Recurring AI maintenance prompts live in `docs/ai-maintenance/`; `docs/ai-maintenance-prompts.md` is only the index.

This structure makes the app easier for an AI coding tool or human developer to modify because each file has a narrower purpose and fewer unrelated concerns.

## Hosting decision

The Version 1 app should be deployed with **Firebase Hosting**.

Current hosting configuration:

- `firebase.json` serves the production build from `dist/`.
- All routes rewrite to `/index.html` so the React app can handle navigation.
- Hosted English conversion uses the Cloudflare Worker URL configured through `VITE_TRANSLATION_API_URL`.
- Current deployed Worker URL: `https://free-writing-translation.free-writing-danielsegatto.workers.dev`.
- Firestore rules are deployed from `firebase.rules`.

Primary deployment flow:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FIREBASE_API_KEY
npx wrangler deploy
npm run build
npx firebase-tools deploy --only hosting
```

Deploy hosting and Firestore rules together when security rules changed:

```bash
npx firebase-tools deploy --only hosting,firestore:rules
```

After deployment, confirm the Firebase Hosting domain is listed under **Firebase Authentication > Settings > Authorized domains** so Google sign-in works on the hosted app.

For Codespaces or other preview domains, add the preview host to Firebase Authentication authorized domains before testing Google sign-in.

Local hosting on an idle machine is not the primary Version 1 deployment target. It remains a possible later option for serving the static `dist/` files privately, but Firebase would still provide authentication, Firestore storage, and cross-device sync unless the backend architecture is changed.

## Embedded implementation notes moved from the base document

### Database structure

- The app does not currently create or update a profile document at `users/{userId}`. That path is used as the security and ownership namespace for each user's conversation subcollection.

### Move and merge messages

- `src/services/messages.ts` has `moveMessage`, which writes the target message and deletes the source message in a Firestore batch.
- `src/services/messages.ts` uses local write-payload helpers to keep normal, forwarded, moved, merged, and English-result message fields consistent.
- Moved messages currently use `isForwarded: true`, `transferType: 'moved'`, `forwardedFromConversationId`, and `forwardedFromMessageId`.
- `src/components/MessageBubble.tsx` includes a `Move to conversation` message action and displays `Moved` or `Forwarded` through `getTransferLabel`.
- `src/components/MessageBubble.tsx` renders user-visible source navigation through structured reference cards; forwarded and moved source metadata still drives transfer labels.
- `src/components/MessageBubble.tsx` includes a `Copy text` message action with short-lived success/failure feedback; the copy action is browser clipboard API UI only and does not touch Firestore.
- `src/App.tsx` models the pending transfer as `{ mode: 'forward' | 'move', message }`.
- `src/components/ForwardModal.tsx` receives `mode` and `sourceMessage`, changes its heading between `Forward to` and `Move to`, and excludes the source conversation from target choices.
- Moving touches the target conversation preview after the batch, but does not recompute the source conversation preview after deleting the original.
- `src/services/messages.ts` has `mergeMessages`, which normalizes the selected messages into display order, joins trimmed block text with blank lines, carries selected attachments forward in display order, creates one replacement message at the first selected message's `sortOrder`, and deletes the selected originals in the same Firestore batch.
- Merged replacement blocks are normal messages with `isForwarded: false`, `transferType: null`, and no source metadata.
- `src/components/ConversationPane.tsx` tracks selected message IDs, prunes selections when messages/conversations change, highlights selected bubbles, and enables the merge action only when at least two current messages are selected.
- Successful merge clears the current selection. Failed merge keeps the selection and shows an inline error in the selection toolbar.

### Message editing

- `src/App.tsx` tracks only which `Message` is currently being edited; it no longer copies edit text into the composer draft.
- `src/components/MessageBubble.tsx` renders the active edit as an inline textarea inside the message bubble with `Save` and `Cancel` actions.
- The inline edit textarea auto-expands to its content height with `useLayoutEffect`, so the full message remains visible while editing without an internal scrollbar.
- The bottom composer remains available for creating new messages while a message is being edited.
- Pasting copied images into the inline edit textarea adds removable previews inside the edit form. Saving appends the prepared image attachments to the existing block; existing attachments remain visible while editing.
- Inline edit save calls `onSaveEdit(message, text, imageFiles)`, which prepares any new image files, routes to `editMessage`, and clears `editingMessage` after the write.

### Image attachments

- `src/types.ts` models optional `attachments` on messages. The only current attachment type is `image`.
- `src/services/storage.ts` compresses images client-side to JPEG data URLs, enforces per-image and per-message inline size limits, and returns message attachment metadata. The service name is historical; there is no Firebase Storage upload path.
- `src/App.tsx` prepares image files before message create/edit writes by calling `uploadMessageImages`, then passes inline attachments into `createMessage` or `editMessage`.
- `src/components/MessageComposer.tsx` supports image file selection, normal paste events, and a visible paste-image button for touch devices. Clipboard read support is browser-dependent; when it is unavailable, the button falls back to file selection.
- `src/components/MessageBubble.tsx` renders saved image previews as inert elements, not links. Clicking a saved image intentionally does nothing.
- Image-only messages are allowed. Conversation previews use `Image` or `{n} images` when a message has no text.
- Search and English conversion use message text only; image contents are not OCR-indexed or sent to the AI conversion endpoint.
- Inline Firestore image storage avoids paid Firebase Storage but is not suitable for large original media. If compression cannot keep images within the configured limits, the composer/editor shows an error and preserves the unsent content.

### Reorder messages

- `src/App.tsx` keeps reorder persistence centralized by optimistically updating `messagesByConversation` and then calling `reorderMessages`.
- `src/utils/messageOrder.ts` keeps the pure reorder-array calculations outside `App.tsx`, with focused tests for up/down moves and drag/drop target moves.
- `src/components/ConversationPane.tsx` owns drag/reorder state and persistence callbacks, while `src/components/MessageBubble.tsx` exposes up/down buttons, native desktop drag-and-drop bindings, and mobile/touch pointer bindings on each message bubble.
- Dragging starts from the message bubble itself; interactive controls inside the bubble, such as buttons and checkboxes, cancel drag start so normal actions remain easy to click.
- Touch/pen dragging tracks the pointer position with `document.elementFromPoint`, highlights the current target bubble, and reorders on pointer release after a small movement threshold.
- Dragging near the top or bottom edge of the `.messages` scroll container starts a `requestAnimationFrame` autoscroll loop so desktop and touch/pen drags can reach off-screen drop targets without releasing the block. The loop is stopped on drop, drag end, pointer release, pointer cancel, or leaving the edge zone.
- Native desktop drag state is kept independent from touch/pen pointer state so browser pointer-cancel events during desktop drag do not clear the active desktop drop target.
- Dropping one message on another asks `App.tsx` to move the dragged message to the target message's current position.
- `src/services/messages.ts` persists the final visible order by rewriting numeric `sortOrder` values in a Firestore batch.

### Message search

- `src/services/search.ts` searches the `searchText` field on messages already present in `messagesByConversation`.
- `src/hooks/useMessagingData.ts` keeps that cache populated by subscribing to each conversation's messages, not only the active conversation.
- Search results clear the search term and open the result's conversation.
- This is intentionally simple, but it means search coverage depends on the active subscriptions and local cache.
- Message subscriptions query Firestore by `createdAt` and then normalize/sort by `sortOrder` in client code so older records without explicit ordering still display chronologically.

### Cross-conversation references

- Messages can store structured `references` separately from body text. Conversation references point to another conversation by ID with a title snapshot; quote references also point to a source message and selected text offsets.
- `src/components/ConversationPane.tsx` opens composer-side pickers for conversation links and quote citations. Quote selection happens inside the modal without leaving the active conversation.
- `src/components/MessageBubble.tsx` renders reference cards below message text. Conversation references navigate to the source conversation; quote references navigate to the source message and temporarily highlight the cited text range when the source is still loaded.
- Inline editing can remove existing references from a saved message. Adding new references is composer-only.
- Old messages without `references` are normalized to an empty reference list by the message subscription path.

### English conversion

- `src/services/translation.ts` posts `{ text }` to `VITE_TRANSLATION_API_URL` or `/api/to-english`.
- The request includes the current Firebase ID token in the `Authorization` header.
- `src/components/ConversationPane.tsx` owns the English picker state and save orchestration. It opens conversion for saved messages or draft text, tracks loading/error/ready/creating/replacing/draft-send states, and routes saves back to message creation/editing callbacks.
- `src/components/EnglishPickerModal.tsx` renders the English conversion dialog from that state. It does not call translation or Firestore directly.
- `src/utils/englishConversion.ts` assembles the selected English options for preview and saving. Each AI segment returns exactly three options, the first option is selected by default, and selected options are joined with spaces.
- Saved-message conversion can create a new English block below the source or replace the source message by calling the normal edit flow. Draft conversion sends the selected English text directly as a new message and clears the composer draft through the normal create-message path.
- `src/services/messages.ts` has `createMessageAfter`, which inserts the English result directly below the source message by choosing a midpoint `sortOrder` when possible or rebalancing order when no numeric gap exists.
- English conversion is online-only. Created and replaced English blocks persist like normal messages and then participate in Firestore cache/sync behavior.
- Hosted production uses `workers/translation/index.ts`, Firebase ID-token verification through Google Identity Toolkit, and Cloudflare Worker secrets for `GROQ_API_KEY` and `FIREBASE_API_KEY`. Local Vite dev uses equivalent middleware in `vite.config.ts` with `GROQ_API_KEY` from ignored `.env`.
- Translation prompts in the Worker and Vite middleware ask the model to prefer larger logical segments, complete sentences, or short paragraphs instead of splitting aggressively into small phrases.

### Offline behavior

- Firestore offline persistence is enabled in `src/firebase.ts`.
- The current code initializes Firestore with persistent local cache and a multiple-tab manager.
- The installed Firebase SDK exposes this setting as `localCache`, using `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.

### Sync behavior

Conversation `lastMessagePreview` is still stored and updated for possible future use, but the current conversation list does not render it. It is updated on create, edit, forward, move target writes, merge result creation, English conversion result creation, and English replacement edits. It is not currently recalculated after deleting a message, deleting originals during merge, or removing a moved message from its source conversation.

### Header display

- `src/components/ConversationPane.tsx` shows the active conversation title in the pane header, without the previous message-count subtitle.

### Performance

Current implementation loads every conversation's messages to support simple search; switch to active-conversation loading plus a search-specific strategy if the dataset grows.
