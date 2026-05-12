# My Messages

A private, Firebase-backed messaging-style PWA for saving and organizing your own text conversations across devices.

## Current state

- Google sign-in through Firebase Authentication.
- Firestore-backed conversations and messages.
- Firestore rules scoped to the signed-in user's `uid`.
- Conversation create, rename, open, and delete.
- Message create, edit, delete, forward, and search.
- PWA manifest and generated service worker.
- Firestore offline persistence for cached data and queued offline writes.

## Development priorities

- Send a message or save an edit with `Ctrl+Enter` / `Cmd+Enter`.
- Keep `Enter` as newline insertion in the composer.
- Replace deprecated Firestore persistence setup with the newer persistent local cache settings.
- Add manual reordering for text blocks inside a conversation.
- Persist message order with a `sortOrder` field and sync it across devices.

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
- `forwardedFromConversationId`
- `forwardedFromMessageId`

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run build` type-checks and builds the PWA.
- `npm run preview` serves the production build locally.

## Product documentation

See `simple_offline_messaging_pwa_base_doc.md` for the full product and development base document.
