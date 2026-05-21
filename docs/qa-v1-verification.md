# V1 Verification Checklist

Use this checklist before treating the current Firebase-backed PWA as a stable v1 checkpoint.

## Automated checks

Run:

```bash
npm run test
npm run build
```

Expected result:

- Vitest passes for app-level transfer navigation, forward/move transfer decision helpers, transfer word-selection helpers, search, tag normalization/filtering and inline tag suggestions, conversation service writes including top-list touches for new blocks, sidebar drag reordering with insertion markers, gap drop zones, edge autoscroll, and post-drag click suppression, message service writes, image-only messages, composer image selection/paste, inline edit image paste, text-only and rich block copy feedback/fallbacks, composer keyboard conversion behavior including draft English sends with pasted images, inline editing, copied-origin metadata/link rendering, post-move notice rendering, reorder controls, desktop and touch drag-handle reorder behavior including body-scroll protection, insertion markers, gap drop zones, and edge autoscroll, selected-block merge including desktop double-click and mobile double-tap entry, English conversion UI/service behavior, conversation index synthesis service/UI/Worker behavior, and the forward/move transfer modal including multi-part word selection.
- The production build completes without TypeScript or Vite errors.

## AI conversion and synthesis setup

Before testing hosted real English conversion or conversation index synthesis, deploy the Cloudflare Worker and configure its server-side secrets:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FIREBASE_API_KEY
npx wrangler deploy
```

For local Vite-only testing, put `GROQ_API_KEY` in ignored `.env` without the `VITE_` prefix and also ensure Firebase values, especially `VITE_FIREBASE_PROJECT_ID`, are present in `.env`. Restart the dev server, then confirm the browser calls `/api/to-english` for English conversion and `/api/synthesize-index` for index synthesis; in Vite dev these are local middleware.

For hosted Firebase testing, set `VITE_TRANSLATION_API_URL` in ignored `.env.production.local` to the deployed Worker URL before `npm run build`, then deploy Firebase Hosting only. Conversation index synthesis derives `/api/synthesize-index` from this Worker URL unless `VITE_SYNTHESIS_API_URL` is explicitly configured.

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
4. Confirm the conversation list shows conversation titles and last updated times without message previews.
5. Drag one conversation row by its handle, confirm the dragged row follows the pointer, an insertion marker shows the landing space, the visible order changes, and releasing the row keeps you on the conversation list without opening the dragged row or the new top row.
6. Release a dragged conversation over a gap, padding, or near-miss spot in the conversation list and confirm it still moves to the nearest insertion marker.
7. In a long conversation list, drag a conversation handle near the top and bottom edges of the visible list and confirm the list auto-scrolls while the drag stays active.
8. Reload and confirm the conversation order persists.
9. Add an image to a new block with the file picker.
10. Paste a copied image into the composer and confirm the preview appears.
11. If testing on a touch device/browser with clipboard support, use the paste-image button and confirm the preview appears; if clipboard read is unavailable, confirm it falls back to file selection.
12. Send an image-only block and confirm its conversation moves to the top of the list and the block remains visible after reload.
13. Click a saved image preview and confirm nothing opens.
14. Edit one message inline inside its message block; confirm the bottom composer keeps any new-message draft unchanged and the edit field expands to show the whole text without an internal scrollbar.
15. Paste a copied image while editing a block, save, and confirm the image is appended to that same block.
16. Copy one text message, paste into a plain text target, and confirm the text plus clipboard feedback appear.
17. Copy one block that has text and an attached image, paste into a rich target such as a document/email editor where supported, and confirm the text and image paste together. If the target only accepts text, confirm at least the text pastes.
18. Copy one image-only block, paste into a compatible image/rich target where supported, and confirm the image is available; if the browser or target does not support rich clipboard images, confirm the app shows clear copy feedback.
19. Delete one message.
20. Add a tag to a block, add the same tag with different casing to another block, and confirm the tag is deduped/filterable case-insensitively.
21. Open the tag editor on another block, type part of an existing tag, confirm suggestions filter as typed and exclude tags already on that block, then select a suggestion with Enter or click.
22. Use the global tag browser and active conversation tag filter to confirm tagged blocks are shown, then remove a tag and confirm filters update.
23. Copy/forward one whole message to the second conversation and confirm the target conversation moves to the top of the list, the app opens the target conversation, and the copied block shows `Copied from [source conversation]` with only the source conversation name clickable.
24. Click the copied block's source conversation name and confirm it opens the source conversation without requiring a lower source card.
25. Open the copy/forward dialog for a text block, select one contiguous phrase by tapping words, select one separate non-adjacent word or phrase, deselect one selected word by tapping it again, then copy/forward the remaining selected parts to the second conversation. Confirm the preview and target message contain only the selected parts, with separate selected parts split into separate paragraphs.
26. Open the move dialog for a text block, press/hold a word and drag across other words with mouse or touch to select a phrase, then move the selected part to the second conversation. Confirm the moved message contains only that selected part, the source block removes only the selected text, the target conversation moves to the top of the list, and the current conversation remains open with a notice that can open the target.
27. In the move dialog, start a drag on an already selected word and drag across selected words to unselect them. Confirm the preview updates and visually selected words match the preview.
28. Move one whole message to the second conversation without selecting text and confirm the target conversation moves to the top of the list, the current conversation remains open, and the move notice can open the target conversation.
29. Reorder messages with the up/down controls.
30. On desktop, use the block's drag handle to drag one text block between other blocks and confirm the visible order changes, the dragged block follows the pointer, and an insertion marker shows the exact landing space.
31. On desktop, release a dragged block over a gap, padding, or near-miss spot in the message list and confirm it still moves to the nearest insertion marker.
32. In a long conversation on desktop, drag a block handle near the top and bottom edges of the visible message list and confirm the list auto-scrolls while the drag stays active.
33. On a phone or touch emulator, scroll by swiping the body of a long text block and confirm it scrolls normally without starting a reorder.
34. On a phone or touch emulator, use the block's drag handle to drag one text block between other blocks and confirm the visible order changes, the dragged block follows the pointer, and an insertion marker shows the exact landing space.
35. In a long conversation on a touch device or emulator, drag a block handle near the top and bottom edges of the visible message list and confirm the list auto-scrolls while the drag stays active.
36. Select at least two messages, including a block with an image when possible, merge them, and confirm one unified block replaces the originals and keeps selected attachments. On desktop, enter block selection by double-clicking the first block; on touch devices, enter it by double-tapping the first block. After selection mode starts, confirm single clicks/taps toggle the remaining blocks.
37. Create or use a long conversation and confirm scrolling moves only the message list while the conversation header, merge toolbar, and bottom composer remain visible.
38. Confirm the active conversation header shows the conversation title without a message-count subtitle.
39. Convert a message with several sentences to English, confirm the picker shows multiple sentence-level segment groups without a separate assembled preview, choose non-default options for at least one segment, and create the English block.
40. Confirm the English block appears directly below the original, moves the receiving conversation to the top of the list, and remains after reload.
41. Convert another message to English and replace the source block with the selected English text.
42. Enter draft text in the composer, paste or select a small image, convert the draft to English, choose an option, and confirm `Send English` creates the selected English text as a new message with the image attached, clears the composer image preview, and does not first place the English text in the composer.
43. Click `Synthesize conversation index` in the active conversation header and confirm exactly one new index block appears at the bottom of the conversation.
44. Confirm the synthesized index includes one clickable row per source block that existed before synthesis, including earlier synthesized index blocks if any existed.
45. Click several index rows and confirm the message list scrolls to the matching source block and highlights it. Delete a referenced source block if practical and confirm that row becomes disabled rather than failing.
46. Search for text that exists in loaded messages, including text from a synthesized index block.
47. Disconnect the browser from the network.
48. Reload the app.
49. Confirm the app shell opens and cached conversations/messages remain readable.
50. While offline, create, edit, paste or select a small image where supported, copy, delete, tag/filter, forward whole and selected text, move whole and selected text, reorder conversations, reorder messages by controls, reorder messages by drag handle where supported, and merge messages.
51. Confirm requesting a new English conversion while offline fails gracefully without creating, replacing, sending, or changing draft text.
52. Confirm requesting a new conversation index while offline fails gracefully without creating a new index block.
53. Reconnect to the network.
54. Confirm all queued changes sync and remain visible after another reload.

Expected result:

- `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards opens draft English conversion from the composer and saves an inline edit from the message edit field.
- Plain `Enter` inserts a newline in the composer.
- Small images can be added without Firebase Storage; if an image is too large for inline Firestore storage, the UI shows a clear error and keeps the unsent draft/edit.
- Saved image previews are inert when clicked.
- Text-only block copy writes plain text. Blocks with attachments use best-effort rich clipboard data with text/html and image data where supported, and text fallback for text-bearing blocks.
- Tag suggestions use previously created tags from loaded blocks, filter as the user types, exclude tags already on the block, and still allow new free-text tags.
- Copied/forwarded messages are labeled `Copied` or `Copied from [source conversation]`; only the source conversation name is clickable, and there is no lower copied-source card. Moved messages are labeled `Moved`.
- Forward/move dialogs transfer the whole block when no words are selected, and transfer only selected words when one or more word selections exist.
- Forward/move word selection supports tap toggling, click-to-deselect, separate non-adjacent selections, and pointer drag selection/unselection on mouse and touch.
- Structured conversation and quote reference cards navigate to their source conversation or source text block when the source is still loaded; unavailable sources remain readable from their stored snapshot.
- Icon-only controls, including composer toolbar actions, modal close buttons, row/message actions, and the mobile back button, show their icons centered within the button boundary.
- Reordered conversations keep their order after reconnect and reload.
- Releasing a reordered conversation keeps the user on the conversation list rather than opening the reordered row or the first row.
- Conversations receiving newly created blocks move to the top of the list after direct creation, forwarding, moving, selected-text moving, and English block creation.
- Reordered messages keep their order after reconnect and reload, whether reordered by explicit controls or the drag handle on desktop and mobile/touch devices.
- Drag reordering continues smoothly when the intended drop target starts off-screen by auto-scrolling the message or conversation list near its top or bottom edge, and list gaps resolve to the nearest insertion slot instead of cancelling the drop.
- Block merge selection starts by double-clicking or double-tapping the first block and then supports single-click/tap toggling for additional blocks. Merged messages keep the selected text in display order, and the original selected blocks remain removed after reconnect and reload.
- English conversion can keep the original message unchanged by creating a new block, or replace the original when `Replace block` is chosen.
- Draft English conversion sends the selected English result directly as a new message, preserves current composer image attachments and references, clears sent previews, and leaves the composer out of that send step.
- Conversation index synthesis sends the active conversation's visible blocks in one request, appends the result as a bottom block, includes previous index blocks in later synthesis, and uses clickable rows that navigate to source blocks.
- Long conversations keep the composer and merge action reachable without scrolling the whole page.

## Known follow-up if a step fails

- If offline reload fails, inspect service worker registration and generated PWA assets.
- If cached reads or queued writes fail, inspect Firestore persistent local cache setup in `src/firebase.ts`.
- If cross-user access succeeds, stop and fix `firebase.rules` before deployment.
- If English conversion returns 404 in Vite dev, restart the Vite dev server so local `/api/to-english` middleware is active.
- If conversation index synthesis returns 404 in Vite dev, restart the Vite dev server so local `/api/synthesize-index` middleware is active.
- If AI conversion or synthesis returns 401, confirm Google sign-in succeeded, `VITE_FIREBASE_PROJECT_ID` matches the signed-in app, and the current preview/hosting domain is in Firebase Authentication authorized domains.
- If AI conversion or synthesis returns 500/502, confirm `GROQ_API_KEY` and `FIREBASE_API_KEY` are configured in the correct Worker runtime and inspect Worker or Vite server logs.
