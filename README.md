# Free Writing

A private, Firebase-backed messaging-style PWA for saving and organizing your own text/image conversations across devices.

## Current state

- Google sign-in through Firebase Authentication.
- Setup guard for missing or placeholder Firebase `.env` values.
- Firestore-backed conversations and messages.
- Firestore rules scoped to the signed-in user's `uid`.
- Conversation create, rename, open, and delete.
- Conversation list rows show the conversation title and last updated time, without message previews.
- Message create, edit, copy-to-clipboard, delete, forward, move between conversations, search, and manual reorder.
- App-based export for the active conversation or all conversations as JSON plus Markdown.
- Small image attachments through file selection, copied-image paste, and inline edit paste. Images are compressed client-side and stored inline in Firestore to stay on the free Firebase Spark plan.
- Per-message English conversion through a server-side Groq proxy, using Cloudflare Workers for the free hosted deployment.
- `Ctrl+Enter` / `Cmd+Enter` opens draft English conversion from the composer or saves an inline edit; plain `Enter` inserts a newline.
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
- `src/components/ConversationPane.tsx` renders the active conversation, messages, copy/edit/transfer/reorder controls, inline edit image paste state, and composer.
- `src/components/ForwardModal.tsx` renders the transfer target picker for forwarding or moving messages.
- `src/hooks/useMessagingData.ts` owns auth, conversation, and message subscriptions; it currently subscribes to every conversation's messages to support loaded-message search.
- `src/services/` contains Firebase auth, conversation, message, image preparation, and search operations.
- `workers/translation/` contains the secured Cloudflare Worker used for hosted English conversion.
- `functions/` contains the legacy Firebase Function version of the English conversion proxy, but Firebase Functions require the Blaze plan and are not the default free hosted path.
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

If any required value is missing or still looks like a placeholder, the sign-in screen shows a setup notice and disables Google sign-in until `.env` is fixed and the dev server is restarted. `VITE_FIREBASE_STORAGE_BUCKET` may be left blank because images are compressed and stored inline in Firestore messages to keep the app on the free Firebase Spark plan.

`VITE_TRANSLATION_API_URL` is optional for local Vite dev, where `/api/to-english` is handled by local middleware. For the free hosted app, set it to the deployed Cloudflare Worker URL before building production.

For Cloudflare Worker local testing, copy `.dev.vars.example` to `.dev.vars` and fill in `GROQ_API_KEY` and `FIREBASE_API_KEY`. For the deployed Worker, store both values as Cloudflare secrets:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FIREBASE_API_KEY
```

The Groq key must never be stored in a `VITE_...` variable or committed file.

## Firebase rules

Deploy `firebase.rules` so each signed-in user can only access their own path:

```bash
firebase deploy --only firestore:rules
```

## Hosting

This app is intended to be hosted on **Firebase Hosting** with Firebase Spark-compatible services. English conversion for the hosted app is served by a separate **Cloudflare Worker** so the Groq key stays server-side without Firebase Blaze.

After setting the Worker secrets, deploy or update the Worker first:

```bash
npx wrangler login
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FIREBASE_API_KEY
npx wrangler deploy
```

Then set the Worker URL in ignored production env before building. The current deployed Worker is `https://free-writing-translation.free-writing-danielsegatto.workers.dev`:

```env
VITE_TRANSLATION_API_URL=https://free-writing-translation.free-writing-danielsegatto.workers.dev
```

Build and deploy Firebase Hosting:

```bash
npm run build
npx firebase-tools deploy --only hosting
```

When deploying both hosting and Firestore rules:

```bash
npx firebase-tools deploy --only hosting,firestore:rules
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
- `attachments`

The only current attachment type is `image`. Images are compressed in the browser and stored as inline Firestore data URLs, not uploaded to Firebase Storage.

Existing messages without `sortOrder` are displayed in chronological order until a reorder action persists explicit order values.

Message listeners query Firestore by `createdAt` and then normalize/sort by `sortOrder` in client code, preserving chronological fallback behavior for older records.

Conversation `lastMessagePreview` is still stored and updated for possible future use, but the current conversation list does not render message previews. It is updated on create, edit, forward, merge result creation, English conversion result creation, English replacement edits, and the target side of a move. It is not currently recalculated after message delete, deleting originals during merge, or after removing a moved message from its source conversation.

## App data exports

Signed-in users can export the open conversation from the conversation header or export all conversations from the app header. Each action downloads a full JSON database bundle plus a readable Markdown companion. JSON preserves complete conversation and message records, including inline image data URLs; Markdown omits inline base64 image payloads for readability.

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run test` runs the focused Vitest suite.
- `npm run build` type-checks and builds the PWA.
- `npm run security:check` runs tests, a production build, and `npm audit` without deploying.
- `npm run preview` serves the production build locally.
- `npm run deploy` builds and deploys Firebase Hosting.
- `npm run ship -- "Context-rich commit message"` runs tests, builds with the production Worker URL, commits unignored changes, pushes the current branch, and deploys the hosted app.

Use a commit subject plus short body when the checkpoint contains meaningful product, architecture, implementation, or documentation context. The message should explain what changed, why it matters, and what verification was performed so another AI or developer can continue from that commit. `npm run ship` deploys Firestore rules too when `firebase.rules` changed, and deploys the Cloudflare Worker when `workers/translation/` or `wrangler.jsonc` changed. Set `RUN_TESTS=0`, `DEPLOY_WORKER=0`, or `FIREBASE_ONLY=hosting,firestore:rules` to override the defaults for a specific run.

## Verification

Run the automated checks before deployment or larger refactors:

```bash
npm run test
npm run build
```

Use `docs/qa-v1-verification.md` for the real-browser Firebase/offline QA pass, including Firestore user-isolation expectations and offline sync scenarios that need an actual configured Firebase project.

Use `docs/ai-maintenance/security-check.md` for repeatable non-deploying audits focused on keeping writing and attachments inaccessible to other app users.

## Product documentation

See `docs/README.md` for the product and development documentation entry point. Detailed docs are split across `docs/product/`, `docs/architecture/`, `docs/implementation/`, and `docs/prompts/`.

See `docs/ai-maintenance-prompts.md` for the AI maintenance prompt index. Individual prompt files live in `docs/ai-maintenance/`.
