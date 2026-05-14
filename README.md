# My Messages

A private, Firebase-backed messaging-style PWA for saving and organizing your own text conversations across devices.

## Current state

- Google sign-in through Firebase Authentication.
- Setup guard for missing or placeholder Firebase `.env` values.
- Firestore-backed conversations and messages.
- Firestore rules scoped to the signed-in user's `uid`.
- Conversation create, rename, open, and delete.
- Message create, edit, copy-to-clipboard, delete, forward, move between conversations, search, and manual reorder.
- Per-message English conversion through a Firebase Functions proxy backed by Groq.
- `Ctrl+Enter` / `Cmd+Enter` sends a new message or saves an edit; plain `Enter` inserts a newline.
- PWA manifest and generated service worker.
- Dark visual theme, including matching browser/PWA theme colors.
- Firestore persistent local cache for cached data and queued offline writes.
- Message order is stored with `sortOrder` and syncs across devices.
- Search is client-side over messages loaded by current Firestore subscriptions.

## Development priorities

- Keep the V1 verification checklist current as Firebase/offline behavior changes.
- Verify offline create, edit, delete, forward, move, and reorder behavior against Firebase/Firestore in a real browser.
- Consider loading only the active conversation's messages or adding a search index if large conversation lists become slow.
- Consider code-splitting Firebase-heavy client code if the production bundle warning becomes a deployment concern.
- Recompute conversation previews after delete and move-source removals if stale previews become confusing.
- Add explicit loading/error UI around Firestore subscriptions if snapshot failures need to be user-visible.

## Code organization

The React app is split by responsibility:

- `src/App.tsx` coordinates app state, derived data, and user actions.
- `src/components/SignInScreen.tsx` renders the logged-out Firebase sign-in flow.
- `src/components/Sidebar.tsx` renders search and conversation navigation.
- `src/components/ConversationPane.tsx` renders the active conversation, messages, copy/edit/transfer/reorder controls, and composer.
- `src/components/ForwardModal.tsx` renders the transfer target picker for forwarding or moving messages.
- `src/hooks/useMessagingData.ts` owns auth, conversation, and message subscriptions; it currently subscribes to every conversation's messages to support loaded-message search.
- `src/services/` contains Firebase auth, conversation, message, and search operations.
- `functions/` contains the secured `/api/to-english` Firebase Function used for English conversion.
- `src/utils/` contains small shared formatting and error helpers.
- `src/styles.css` owns the dark theme and responsive layout styles; `index.html` and the PWA manifest config use the same dark theme color for browser/install surfaces.

## Setup

1. Create a Firebase project.
2. Enable **Authentication > Google**.
3. Create a Firestore database.
4. Copy `.env.example` to `.env` and fill in your Firebase web app config.
5. Install dependencies and run the app:

```bash
npm install
npm run dev
```

Expected `.env` keys:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_TRANSLATION_API_URL=
```

If any required value is missing or still looks like a placeholder, the sign-in screen shows a setup notice and disables Google sign-in until `.env` is fixed and the dev server is restarted.

`VITE_TRANSLATION_API_URL` is optional and mainly useful for pointing local browser builds at an emulator endpoint. Production uses the Firebase Hosting rewrite at `/api/to-english`.

Set the Groq API key as a Firebase Functions secret, not in `.env`:

```bash
firebase functions:secrets:set GROQ_API_KEY
```

## Firebase rules

Deploy `firebase.rules` so each signed-in user can only access their own path:

```bash
firebase deploy --only firestore:rules
```

## Hosting

This app is intended to be hosted on **Firebase Hosting**. The repo already includes `firebase.json`, configured to serve the Vite production build from `dist/` and rewrite app routes to `index.html`.

Build and deploy:

```bash
npm run build
firebase deploy --only hosting
```

When deploying both hosting and Firestore rules:

```bash
firebase deploy --only hosting,firestore:rules
```

For Google sign-in, make sure the Firebase Hosting domain is allowed in **Authentication > Settings > Authorized domains**.

## Data model

```text
users/{userId}
  conversations/{conversationId}
    messages/{messageId}
```

The app does not currently write a profile document at `users/{userId}`; it uses that path as the owner namespace for conversation subcollections.

Messages should include:

- `text`
- `searchText`
- `createdAt`
- `updatedAt`
- `sortOrder`
- `isForwarded`
- `transferType`
- `forwardedFromConversationId`
- `forwardedFromMessageId`

Existing messages without `sortOrder` are displayed in chronological order until a reorder action persists explicit order values.

Message listeners query Firestore by `createdAt` and then normalize/sort by `sortOrder` in client code, preserving chronological fallback behavior for older records.

Conversation `lastMessagePreview` is updated on create, edit, forward, and the target side of a move. It is not currently recalculated after message delete or after removing a moved message from its source conversation.

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run test` runs the focused Vitest suite.
- `npm run build` type-checks and builds the PWA.
- `npm run functions:build` type-checks and builds the Firebase Functions backend.
- `npm run preview` serves the production build locally.

## Verification

Run the automated checks before deployment or larger refactors:

```bash
npm run test
npm run build
```

Use `docs/qa-v1-verification.md` for the real-browser Firebase/offline QA pass, including Firestore user-isolation expectations and offline sync scenarios that need an actual configured Firebase project.

## Product documentation

See `docs/README.md` for the product and development documentation entry point. Detailed docs are split across `docs/product/`, `docs/architecture/`, `docs/implementation/`, and `docs/prompts/`.

See `docs/ai-maintenance-prompts.md` for the AI maintenance prompt index. Individual prompt files live in `docs/ai-maintenance/`.
