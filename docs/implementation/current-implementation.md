# Current Implementation

Last updated: 2026-05-14

Related docs: [documentation overview](../README.md), [product brief](../product/v1-product-brief.md), [architecture](../architecture/firebase-pwa-architecture.md), [QA checklist](../qa-v1-verification.md).

## Current implementation snapshot

The current app state is a working Firebase-backed React PWA named `My Messages`.

Implemented:

- Vite + React frontend.
- Focused Vitest coverage for message service writes, loaded-message search, composer keyboard sending, reorder controls, multi-block merge, English conversion UI/service behavior, and the shared forward/move modal.
- React code organized into small components, a subscription hook, Firebase services, and utility helpers.
- Firebase Authentication with Google provider.
- Firebase configuration guard that shows a setup notice when `.env` is missing or still contains placeholder values.
- Firestore cloud storage under `users/{userId}/conversations/{conversationId}/messages/{messageId}`.
- Firestore security rules scoped to the signed-in user's UID.
- Conversation create, rename, open, and delete.
- Message create, edit, copy-to-clipboard, delete, forward, move to another conversation, search, manual reorder, and selected-block merge.
- English conversion for saved messages and composer draft text. It segments text, presents three English options per segment, and can create a new message below a saved source, replace a saved source, or place the selected English text back into the draft.
- Message transfer support distinguishes forwarded messages from moved messages with `transferType`.
- Composer keyboard send/save with `Ctrl+Enter` / `Cmd+Enter`, while plain `Enter` inserts a newline.
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
- Verify offline create, edit, delete, forward, move, reorder, and merge behavior in a real browser against Firebase/Firestore.
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

The `.env` file should stay local and must not be committed.

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
  Search, conversation list, create, rename, delete, and navigation UI.

src/components/ConversationPane.tsx
  Active conversation view, message list, selected-message state, copy/edit/transfer/reorder/merge/English conversion controls, conversion picker state, edit state, and composer UI.

src/components/ForwardModal.tsx
  Conversation picker used when forwarding or moving a message.

src/hooks/useMessagingData.ts
  Authentication, conversation, and message subscription lifecycle.
  After sign-in, subscribes to the conversation list and then to every conversation's messages.
  This keeps loaded-message search simple, but can become expensive for large datasets.
  It does not currently expose per-subscription loading or error states to the UI.

src/services/
  Firebase auth, conversation, message, search, and translation request operations.

workers/translation/index.ts
  Cloudflare Worker for authenticated English conversion requests. Verifies Firebase ID tokens through Google Identity Toolkit, calls Groq with the `GROQ_API_KEY` secret, validates the JSON shape, and returns segment/options data.

functions/src/index.ts
  Legacy Firebase Function version of the translation proxy. Firebase Functions require the Blaze plan and are not used by the default free hosted deployment.

src/utils/
  Shared formatting and error helpers.

src/styles.css
  Global dark theme, responsive layout, viewport-constrained conversation pane, component surfaces, input states, message bubbles, modal styling, English picker styling, and hover states.

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
- Moved messages currently use `isForwarded: true`, `transferType: 'moved'`, `forwardedFromConversationId`, and `forwardedFromMessageId`.
- `src/components/ConversationPane.tsx` includes a `Move to conversation` message action and displays `Moved` or `Forwarded` through `getTransferLabel`.
- `src/components/ConversationPane.tsx` includes a `Copy text` message action with short-lived success/failure feedback; the copy action is browser clipboard API UI only and does not touch Firestore.
- `src/App.tsx` models the pending transfer as `{ mode: 'forward' | 'move', message }`.
- `src/components/ForwardModal.tsx` receives `mode` and `sourceMessage`, changes its heading between `Forward to` and `Move to`, and excludes the source conversation from target choices.
- Moving touches the target conversation preview after the batch, but does not recompute the source conversation preview after deleting the original.
- `src/services/messages.ts` has `mergeMessages`, which normalizes the selected messages into display order, joins trimmed block text with blank lines, creates one replacement message at the first selected message's `sortOrder`, and deletes the selected originals in the same Firestore batch.
- Merged replacement blocks are normal messages with `isForwarded: false`, `transferType: null`, and no source metadata.
- `src/components/ConversationPane.tsx` tracks selected message IDs, prunes selections when messages/conversations change, highlights selected bubbles, and enables the merge action only when at least two current messages are selected.
- Successful merge clears the current selection. Failed merge keeps the selection and shows an inline error in the selection toolbar.

### Message search

- `src/services/search.ts` searches the `searchText` field on messages already present in `messagesByConversation`.
- `src/hooks/useMessagingData.ts` keeps that cache populated by subscribing to each conversation's messages, not only the active conversation.
- Search results clear the search term and open the result's conversation.
- This is intentionally simple, but it means search coverage depends on the active subscriptions and local cache.
- Message subscriptions query Firestore by `createdAt` and then normalize/sort by `sortOrder` in client code so older records without explicit ordering still display chronologically.

### English conversion

- `src/services/translation.ts` posts `{ text }` to `VITE_TRANSLATION_API_URL` or `/api/to-english`.
- The request includes the current Firebase ID token in the `Authorization` header.
- `src/components/ConversationPane.tsx` owns the English picker modal state. It shows loading, error, ready, creating, replacing, and draft-update states.
- Each AI segment returns exactly three options. The first is selected by default, and selected options are joined with spaces for the preview/saved text.
- Saved-message conversion can create a new English block below the source or replace the source message by calling the normal edit flow. Draft conversion places the selected English text back into the composer without saving until the user sends it.
- `src/services/messages.ts` has `createMessageAfter`, which inserts the English result directly below the source message by choosing a midpoint `sortOrder` when possible or rebalancing order when no numeric gap exists.
- English conversion is online-only. Created and replaced English blocks persist like normal messages and then participate in Firestore cache/sync behavior.
- Hosted production uses `workers/translation/index.ts`, Firebase ID-token verification through Google Identity Toolkit, and Cloudflare Worker secrets for `GROQ_API_KEY` and `FIREBASE_API_KEY`. Local Vite dev uses equivalent middleware in `vite.config.ts` with `GROQ_API_KEY` from ignored `.env`.
- Translation prompts in the Worker and Vite middleware ask the model to prefer larger logical segments, complete sentences, or short paragraphs instead of splitting aggressively into small phrases.

### Offline behavior

- Firestore offline persistence is enabled in `src/firebase.ts`.
- The current code initializes Firestore with persistent local cache and a multiple-tab manager.
- The installed Firebase SDK exposes this setting as `localCache`, using `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.

### Sync behavior

Conversation `lastMessagePreview` is updated on create, edit, forward, move target writes, merge result creation, English conversion result creation, and English replacement edits. It is not currently recalculated after deleting a message, deleting originals during merge, or removing a moved message from its source conversation.

### Performance

Current implementation loads every conversation's messages to support simple search; switch to active-conversation loading plus a search-specific strategy if the dataset grows.
