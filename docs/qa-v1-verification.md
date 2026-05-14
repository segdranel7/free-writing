# V1 Verification Checklist

Use this checklist before treating the current Firebase-backed PWA as a stable v1 checkpoint.

## Automated checks

Run:

```bash
npm run test
npm run build
```

Expected result:

- Vitest passes for search, message service writes, message copy feedback, composer keyboard behavior, reorder controls, selected-block merge, English conversion UI/service behavior, and the forward/move modal.
- The production build completes without TypeScript or Vite errors.

## English conversion setup

Before testing hosted real conversion, deploy the Cloudflare Worker and configure its server-side secrets:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FIREBASE_API_KEY
npx wrangler deploy
```

For local Vite-only testing, put `GROQ_API_KEY` in ignored `.env` without the `VITE_` prefix and restart the dev server. The browser should call `/api/to-english`; in Vite dev this is local middleware.

For hosted Firebase testing, set `VITE_TRANSLATION_API_URL` in ignored `.env.production.local` to the deployed Worker URL before `npm run build`, then deploy Firebase Hosting only. The current Worker URL is:

```env
VITE_TRANSLATION_API_URL=https://free-writing-translation.free-writing-danielsegatto.workers.dev
```

## Firestore rules

Deploy or test `firebase.rules` before sharing a deployed app URL.

Expected result:

- Signed-out users cannot read or write `users/{userId}` documents.
- A signed-in user can read and write only under `users/{theirUid}`.
- A signed-in user cannot read, create, update, or delete another user's conversations or messages.

Suggested manual paths:

```text
users/{uid}
users/{uid}/conversations/{conversationId}
users/{uid}/conversations/{conversationId}/messages/{messageId}
```

## Real-browser offline QA

Run against a configured Firebase project in Chrome or Safari after visiting the app once while online.

1. Sign in with Google.
2. Create two conversations.
3. Create several messages in the first conversation.
4. Edit one message.
5. Copy one message and confirm clipboard feedback appears.
6. Delete one message.
7. Forward one message to the second conversation.
8. Move one message to the second conversation.
9. Reorder messages with the up/down controls.
10. Select at least two messages, merge them, and confirm one unified block replaces the originals.
11. Create or use a long conversation and confirm scrolling moves only the message list while the conversation header, merge toolbar, and bottom composer remain visible.
12. Convert one message to English, choose non-default options for at least one segment, and create the English block.
13. Confirm the English block appears directly below the original and remains after reload.
14. Convert another message to English and replace the source block with the selected English text.
15. Enter draft text in the composer, convert the draft to English, choose an option, and confirm the draft updates before sending.
16. Search for text that exists in loaded messages.
17. Disconnect the browser from the network.
18. Reload the app.
19. Confirm the app shell opens and cached conversations/messages remain readable.
20. While offline, create, edit, copy, delete, forward, move, reorder, and merge messages.
21. Confirm requesting a new English conversion while offline fails gracefully without creating, replacing, or changing draft text.
22. Reconnect to the network.
23. Confirm all queued changes sync and remain visible after another reload.

Expected result:

- `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards sends a new message or saves an edit.
- Plain `Enter` inserts a newline in the composer.
- Forwarded messages are labeled `Forwarded`; moved messages are labeled `Moved`.
- Source links navigate back to the original conversation when source metadata exists.
- Reordered messages keep their order after reconnect and reload.
- Merged messages keep the selected text in display order, and the original selected blocks remain removed after reconnect and reload.
- English conversion can keep the original message unchanged by creating a new block, or replace the original when `Replace block` is chosen.
- Draft English conversion updates only the composer draft until the user sends it.
- Long conversations keep the composer and merge action reachable without scrolling the whole page.

## Known follow-up if a step fails

- If offline reload fails, inspect service worker registration and generated PWA assets.
- If cached reads or queued writes fail, inspect Firestore persistent local cache setup in `src/firebase.ts`.
- If cross-user access succeeds, stop and fix `firebase.rules` before deployment.
- If English conversion returns 404 in Vite dev, restart the Vite dev server so local `/api/to-english` middleware is active.
- If English conversion returns 401, confirm Google sign-in succeeded and the current preview/hosting domain is in Firebase Authentication authorized domains.
- If English conversion returns 500/502, confirm `GROQ_API_KEY` and `FIREBASE_API_KEY` are configured in the correct Worker runtime and inspect Worker or Vite server logs.
