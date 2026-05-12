# My Messages

A private, Firebase-backed messaging-style PWA for saving and organizing your own text conversations across devices.

## Current state

- Google sign-in through Firebase Authentication.
- Firestore-backed conversations and messages.
- Firestore rules scoped to the signed-in user's `uid`.
- Conversation create, rename, open, and delete.
- Message create, edit, delete, forward, move between conversations, search, and manual reorder.
- `Ctrl+Enter` / `Cmd+Enter` sends a new message or saves an edit; plain `Enter` inserts a newline.
- PWA manifest and generated service worker.
- Firestore persistent local cache for cached data and queued offline writes.
- Message order is stored with `sortOrder` and syncs across devices.

## Development priorities

- Keep the V1 verification checklist current as Firebase/offline behavior changes.
- Verify offline create, edit, delete, forward, move, and reorder behavior against Firebase/Firestore in a real browser.
- Consider loading only the active conversation's messages if large conversation lists become slow.
- Consider code-splitting Firebase-heavy client code if the production bundle warning becomes a deployment concern.

## Code organization

The React app is split by responsibility:

- `src/App.tsx` coordinates app state, derived data, and user actions.
- `src/components/SignInScreen.tsx` renders the logged-out Firebase sign-in flow.
- `src/components/Sidebar.tsx` renders search and conversation navigation.
- `src/components/ConversationPane.tsx` renders the active conversation, messages, reorder controls, and composer.
- `src/components/ForwardModal.tsx` renders the transfer target picker for forwarding or moving messages.
- `src/hooks/useMessagingData.ts` owns auth, conversation, and message subscriptions.
- `src/services/` contains Firebase auth, conversation, message, and search operations.
- `src/utils/` contains small shared formatting and error helpers.

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

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run test` runs the focused Vitest suite.
- `npm run build` type-checks and builds the PWA.
- `npm run preview` serves the production build locally.

## Verification

Run the automated checks before deployment or larger refactors:

```bash
npm run test
npm run build
```

Use `docs/qa-v1-verification.md` for the real-browser Firebase/offline QA pass, including Firestore user-isolation expectations and offline sync scenarios that need an actual configured Firebase project.

## Product documentation

See `simple_offline_messaging_pwa_base_doc.md` for the full product and development base document.

See `docs/ai-maintenance-prompts.md` for the AI maintenance prompt index. Individual prompt files live in `docs/ai-maintenance/`.
