# V1 Verification Checklist

Use this checklist before treating the current Firebase-backed PWA as a stable v1 checkpoint.

## Automated checks

Run:

```bash
npm run test
npm run build
```

Expected result:

- Vitest passes for search, message service writes, composer keyboard behavior, reorder controls, and the forward/move modal.
- The production build completes without TypeScript or Vite errors.

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
5. Delete one message.
6. Forward one message to the second conversation.
7. Move one message to the second conversation.
8. Reorder messages with the up/down controls.
9. Search for text that exists in loaded messages.
10. Disconnect the browser from the network.
11. Reload the app.
12. Confirm the app shell opens and cached conversations/messages remain readable.
13. While offline, create, edit, delete, forward, move, and reorder messages.
14. Reconnect to the network.
15. Confirm all queued changes sync and remain visible after another reload.

Expected result:

- `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards sends a new message or saves an edit.
- Plain `Enter` inserts a newline in the composer.
- Forwarded messages are labeled `Forwarded`; moved messages are labeled `Moved`.
- Source links navigate back to the original conversation when source metadata exists.
- Reordered messages keep their order after reconnect and reload.

## Known follow-up if a step fails

- If offline reload fails, inspect service worker registration and generated PWA assets.
- If cached reads or queued writes fail, inspect Firestore persistent local cache setup in `src/firebase.ts`.
- If cross-user access succeeds, stop and fix `firebase.rules` before deployment.
