# Current Implementation

Last updated: 2026-05-13

Related docs: [documentation overview](../README.md), [product brief](../product/v1-product-brief.md), [architecture](../architecture/firebase-pwa-architecture.md), [QA checklist](../qa-v1-verification.md).

## Current implementation snapshot

The current app state is a working Firebase-backed React PWA named `My Messages`.

Implemented:

- Vite + React frontend.
- Focused Vitest coverage for message service writes, loaded-message search, composer keyboard sending, reorder controls, and the shared forward/move modal.
- React code organized into small components, a subscription hook, Firebase services, and utility helpers.
- Firebase Authentication with Google provider.
- Firebase configuration guard that shows a setup notice when `.env` is missing or still contains placeholder values.
- Firestore cloud storage under `users/{userId}/conversations/{conversationId}/messages/{messageId}`.
- Firestore security rules scoped to the signed-in user's UID.
- Conversation create, rename, open, and delete.
- Message create, edit, copy-to-clipboard, delete, forward, move to another conversation, search, and manual reorder.
- Message transfer support distinguishes forwarded messages from moved messages with `transferType`.
- Composer keyboard send/save with `Ctrl+Enter` / `Cmd+Enter`, while plain `Enter` inserts a newline.
- Responsive phone/desktop layout.
- Dark visual theme across sign-in, sidebar, conversation pane, composer, message bubbles, modal, and hover states.
- PWA manifest and generated service worker.
- Browser/PWA theme colors are aligned to the dark app shell color.
- Firestore persistent local cache is enabled for cached data and offline writes.
- Message order is persisted with numeric `sortOrder` values and syncs across devices.
- Search runs across messages loaded by Firestore subscriptions; the current hook subscribes to every conversation's messages after the conversation list loads.

Known development follow-ups:

- Keep `docs/qa-v1-verification.md` current as Firebase/offline behavior changes.
- Add emulator-backed Firestore rules tests if rule complexity grows beyond the current per-user UID isolation model.
- Verify offline create, edit, delete, forward, move, and reorder behavior in a real browser against Firebase/Firestore.
- Consider loading only the active conversation's messages or adding a search index if large conversation lists become slow; this would require revisiting current loaded-message search behavior.
- Consider code-splitting Firebase-heavy client code if the production bundle warning becomes a deployment concern.
- Recompute or clear source conversation previews after message delete and move actions if stale `lastMessagePreview` values become confusing.
- Add explicit loading/error UI around Firestore subscriptions if snapshot failures need to be surfaced beyond console/dev tooling.
- Keep `docs/ai-maintenance/` prompt files current when the recurring AI maintenance workflows change.

## Current stack

The current codebase uses:

- React 19
- Vite 7
- TypeScript
- Firebase JS SDK 12
- `vite-plugin-pwa`
- `lucide-react` for icons

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
```

The `.env` file should stay local and must not be committed.

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
  Search, conversation list, create, rename, delete, and navigation UI.

src/components/ConversationPane.tsx
  Active conversation view, message list, copy/edit/transfer/reorder controls, edit state, and composer UI.

src/components/ForwardModal.tsx
  Conversation picker used when forwarding or moving a message.

src/hooks/useMessagingData.ts
  Authentication, conversation, and message subscription lifecycle.
  After sign-in, subscribes to the conversation list and then to every conversation's messages.
  This keeps loaded-message search simple, but can become expensive for large datasets.
  It does not currently expose per-subscription loading or error states to the UI.

src/services/
  Firebase auth, conversation, message, and search operations.

src/utils/
  Shared formatting and error helpers.

src/styles.css
  Global dark theme, responsive layout, component surfaces, input states, message bubbles, modal styling, and hover states.

index.html + vite.config.ts
  Browser theme color and generated PWA manifest colors. These currently match the dark app shell so installed/mobile surfaces do not flash the old light theme.
```

Development impact:

- `App.tsx` should stay focused on orchestration and cross-component workflows.
- UI changes should usually start in `src/components/`.
- Theme and layout styling changes should usually start in `src/styles.css`, then update PWA theme colors if the app shell color changes.
- Firebase read/write behavior should usually start in `src/services/`.
- Subscription and data-loading behavior should usually start in `src/hooks/useMessagingData.ts`.
- Small reusable helpers should live in `src/utils/`.
- Recurring AI maintenance prompts live in `docs/ai-maintenance/`; `docs/ai-maintenance-prompts.md` is only the index.

This structure makes the app easier for an AI coding tool or human developer to modify because each file has a narrower purpose and fewer unrelated concerns.

## Hosting decision

The Version 1 app should be deployed with **Firebase Hosting**.

Current hosting configuration:

- `firebase.json` serves the production build from `dist/`.
- All routes rewrite to `/index.html` so the React app can handle navigation.
- Firestore rules are deployed from `firebase.rules`.

Primary deployment flow:

```bash
npm run build
firebase deploy --only hosting
```

Deploy hosting and Firestore rules together when security rules changed:

```bash
firebase deploy --only hosting,firestore:rules
```

After deployment, confirm the Firebase Hosting domain is listed under **Firebase Authentication > Settings > Authorized domains** so Google sign-in works on the hosted app.

Local hosting on an idle machine is not the primary Version 1 deployment target. It remains a possible later option for serving the static `dist/` files privately, but Firebase would still provide authentication, Firestore storage, and cross-device sync unless the backend architecture is changed.

## Embedded implementation notes moved from the base document

### Database structure

- The app does not currently create or update a profile document at `users/{userId}`. That path is used as the security and ownership namespace for each user's conversation subcollection.

### Move messages between conversations

- `src/services/messages.ts` has `moveMessage`, which writes the target message and deletes the source message in a Firestore batch.
- Moved messages currently use `isForwarded: true`, `transferType: 'moved'`, `forwardedFromConversationId`, and `forwardedFromMessageId`.
- `src/components/ConversationPane.tsx` includes a `Move to conversation` message action and displays `Moved` or `Forwarded` through `getTransferLabel`.
- `src/components/ConversationPane.tsx` includes a `Copy text` message action with short-lived success/failure feedback; the copy action is browser clipboard API UI only and does not touch Firestore.
- `src/App.tsx` models the pending transfer as `{ mode: 'forward' | 'move', message }`.
- `src/components/ForwardModal.tsx` receives `mode` and `sourceMessage`, changes its heading between `Forward to` and `Move to`, and excludes the source conversation from target choices.
- Moving touches the target conversation preview after the batch, but does not recompute the source conversation preview after deleting the original.

### Message search

- `src/services/search.ts` searches the `searchText` field on messages already present in `messagesByConversation`.
- `src/hooks/useMessagingData.ts` keeps that cache populated by subscribing to each conversation's messages, not only the active conversation.
- Search results clear the search term and open the result's conversation.
- This is intentionally simple, but it means search coverage depends on the active subscriptions and local cache.
- Message subscriptions query Firestore by `createdAt` and then normalize/sort by `sortOrder` in client code so older records without explicit ordering still display chronologically.

### Offline behavior

- Firestore offline persistence is enabled in `src/firebase.ts`.
- The current code initializes Firestore with persistent local cache and a multiple-tab manager.
- The installed Firebase SDK exposes this setting as `localCache`, using `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.

### Sync behavior

Conversation `lastMessagePreview` is updated on create, edit, forward, and move target writes. It is not currently recalculated after deleting a message or removing a moved message from its source conversation.

### Performance

Current implementation loads every conversation's messages to support simple search; switch to active-conversation loading plus a search-specific strategy if the dataset grows.
