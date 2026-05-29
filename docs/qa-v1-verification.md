# V1 Verification Checklist

Use this checklist before treating the current Firebase-backed PWA as a stable v1 checkpoint.

## Automated checks

Run:

```bash
npm run test
npm run build
```

For a full non-deploying security pass, run:

```bash
npm run security:check
```

Expected result:

- Vitest passes for app-level optimistic text-block send/reconciliation/failure behavior, information-only mode persistence and block-level normal-controls override, List/Kanban visualization switching, custom Kanban column normalization/deduping, column management, block column assignment, Kanban card movement, transfer and calendar navigation, forward/move transfer decision helpers, transfer word-selection helpers, search, calendar date grouping, tag normalization/filtering and inline tag suggestions, inline conversation-link parsing/typeahead/rendering, composer and inline-edit `[[` shortcut insertion, conversation service writes including top-list touches for new blocks and inline wiki-link rename rewrites, sidebar drag reordering with insertion markers, gap drop zones, edge autoscroll, and post-drag click suppression, message service writes including scheduled date/time preservation, image-only messages, Kanban placement, block connection/backlink helpers and UI, Markdown message rendering, long text block expand/collapse rendering, composer image/date selection and paste, composer duplicate-submit guards, inline edit image/date behavior, text-only and rich block copy feedback/fallbacks, Markdown text-block download helpers, app-based conversation export serialization/Markdown helpers, composer keyboard conversion and direct-send behavior including draft English sends with pasted images, inline editing, copied-origin metadata/link rendering, post-move notice rendering, reorder controls, desktop and touch drag-handle reorder behavior including body-scroll protection, insertion markers, gap drop zones, and edge autoscroll, selected-block merge including desktop double-click, mobile double-tap entry, and delayed-click suppression during the selection toolbar transition, whole-block and partial English conversion with context plus second-pass English organization UI/service/Worker behavior, conversation index synthesis service/UI/Worker behavior, and the transfer modal including forward multi-part word selection, move direct target selection, and duplicate target-click protection.
- The production build completes without TypeScript or Vite errors.
- `npm run security:check` additionally runs `npm audit` and should report no known dependency vulnerabilities.

## Repeatable security check

Use `docs/ai-maintenance/security-check.md` when the goal is specifically to confirm that writing and attachments remain private to the signed-in user's account.

Expected security boundary:

- Firestore access remains scoped to `users/{request.auth.uid}`.
- Image attachments remain inline Firestore data URLs, not public storage objects.
- English conversion, selected-English organization, and conversation-index synthesis send text only through authenticated server-side proxy requests. Partial saved-message English conversion may send surrounding before/after text as context, but only for the explicit conversion request.
- Secrets remain in ignored local files or platform secret stores, not tracked files or browser-exposed `VITE_...` variables.
- Browser offline persistence is treated as an accepted device-local cache, not as cross-user access.
- App-based conversation exports use the signed-in user's normal Firestore access. Exported JSON should be treated as private production writing data because it preserves full message records and inline image data URLs.

## App export smoke check

Run after signing in with a Firebase-backed account that has at least one conversation.

Expected result:

- The active conversation header More menu can export one `.json` and one `.md` file for the open conversation.
- The sidebar app header More menu can export one `.json` and one `.md` file for all conversations.
- Export buttons disable while an export is pending and show a concise error if the export fails.
- JSON contains full conversation records and nested message records, including attachment payloads.
- Markdown companions are readable and do not include inline base64 image data.
- No Firestore writes occur.

## Kanban visualization QA

Run these checks in a real browser after signing in and creating at least one conversation with several blocks.

1. Switch the active conversation from List to Kanban and back, reload, and confirm the selected view persists per conversation.
2. Open Kanban before creating columns and confirm no default columns are created automatically.
3. Add several custom columns, rename one, move columns left/right, reload, and confirm their names and order persist.
4. Assign a block from the compact selector beside its tag chips. Confirm the selector shows `∅` before assignment, the selected column name after assignment, and no separate downward arrow.
5. Delete a column that has assigned blocks and confirm those blocks are not deleted; they become unassigned and return to List-only visibility.
6. Send a new block while Kanban is open and confirm it lands in the active column.
7. Move a Kanban card up/down within a column and to the previous/next column, then reload and confirm the order and column assignment persist.
8. On an iPhone 8-sized viewport, confirm Kanban shows one active column at a time with compact previous/next controls and a column picker, without the column selector or card shortcut buttons overflowing the block.
9. Watch the browser console while adding or editing columns and confirm there are no duplicate React key warnings for Kanban column IDs.

## AI conversion and synthesis setup

Before testing hosted real English conversion, selected-English organization, or conversation index synthesis, deploy the Cloudflare Worker and configure its server-side secrets:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FIREBASE_API_KEY
npx wrangler deploy
```

For local Vite-only testing, put `GROQ_API_KEY` in ignored `.env` without the `VITE_` prefix and also ensure Firebase values, especially `VITE_FIREBASE_PROJECT_ID`, are present in `.env`. Restart the dev server, then confirm the browser calls `/api/to-english` for English conversion, `/api/format-english` for selected-English organization, and `/api/synthesize-index` for index synthesis; in Vite dev these are local middleware.

For hosted Firebase testing, set `VITE_TRANSLATION_API_URL` in ignored `.env.production.local` to the deployed Worker URL before `npm run build`, then deploy Firebase Hosting only. English formatting derives `/api/format-english` from this Worker URL, and conversation index synthesis derives `/api/synthesize-index` unless `VITE_SYNTHESIS_API_URL` is explicitly configured.

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
19. Download one text-bearing block as Markdown and confirm the saved `.md` file contains the raw block text.
20. Confirm the Markdown download action is disabled or unavailable for an image-only block with no text.
21. Create or use a block longer than three lines and confirm only a compact preview is initially visible, the icon-only expand button reveals the full text, and the collapse icon hides it again.
22. Turn on information-only mode from the conversation header. Confirm the composer, block action bars, tag add/remove controls, and expand/collapse buttons disappear; block text, images, tags, dates, references, backlinks, copied-source metadata, inline conversation links, and synthesized index rows remain visible and navigable.
23. In information-only mode, confirm long text renders fully without using an expand control.
24. Use `Show normal controls` on one text block. Confirm the normal block controls return only for that block, no edit field opens automatically, and the rest of the conversation stays in information-only view.
25. Use `Show normal controls` on a second text block and confirm the first block returns to view mode. Then use `Return block to view mode` and confirm all blocks return to information-only presentation.
26. Reload and confirm the information-only mode preference is restored on that browser/device.
27. Delete one message.
28. Add a tag to a block, add the same tag with different casing to another block, and confirm the tag is deduped/filterable case-insensitively.
29. Open the tag editor on another block, type part of an existing tag, confirm suggestions filter as typed and exclude tags already on that block, then select a suggestion with Enter or click.
30. Use the global tag browser and active conversation tag filter to confirm tagged blocks are shown, then remove a tag and confirm filters update.
31. Send a text-only block and confirm it appears immediately in the conversation as pending or sending before any visible network delay; after sync/reload, confirm the same block appears once, not duplicated.
32. Rapidly click the Send button or press the direct-send shortcut twice for one draft and confirm only one block is created.
33. Simulate or observe a failed text-only send if practical and confirm the pending block disappears, the draft returns, and an error appears.
34. Use the composer's `Date` action to add a date and time to a new block, then confirm the block appears immediately and the saved block shows that scheduled metadata after sync.
35. Edit an existing block, add a different date and time, save, then edit it again and clear the date/time. Confirm the block appears on the calendar only while the date/time is set.
36. Open the Calendar screen from the sidebar and confirm Today shows a time-sorted agenda, This week groups blocks by day, and This month uses the month/date grouping appropriate to the device width.
37. Click a calendar item and confirm it opens the source conversation and highlights the source block.
38. Copy/forward one whole message to the second conversation and confirm the target conversation moves to the top of the list, the app opens the target conversation, and the copied block shows `Copied from [source conversation]` with only the source conversation name clickable.
39. In the transfer target list, rapidly click/tap the target conversation while the copy/write is pending and confirm only one target block is created.
40. Click the copied block's source conversation name and confirm it opens the source conversation without requiring a lower source card.
41. In the composer, type `[[`, confirm conversation-title suggestions appear, filter as you type, use `ArrowDown` / `ArrowUp` to change the highlighted suggestion, complete one with `Enter` or `Tab`, and confirm clicking a suggestion also completes the marker.
42. In the composer, use the visible `[[` insert button and confirm it inserts the marker at the cursor, focuses the text field, and opens the same conversation-title suggestions.
43. Edit an existing text block, type `[[` or use the visible `[[` insert button, and confirm the same conversation-title suggestion and completion behavior works without moving the text into the bottom composer.
44. Send the inline conversation link and confirm the saved block displays only the linked conversation title with a visual cue, not the `[[` / `]]` markers. Click it and confirm it opens the target conversation.
45. If practical, create duplicate conversation titles and confirm duplicate inline-link targets stay plain text and are not offered as suggestions. Rename a uniquely linked conversation and confirm saved inline markers update to the new title.
46. Open the copy/forward dialog for a text block and confirm the first step shows only the selectable source text, without the target conversation list or a separate selected-text preview. Select one contiguous phrase by tapping words, select one separate non-adjacent word or phrase, deselect one selected word by tapping it again, then advance to target selection and copy/forward the remaining selected parts to the second conversation. Confirm the target message contains only the selected parts, with separate selected parts split into separate paragraphs.
47. Reopen the copy/forward dialog, leave all words unselected, advance to target selection, and confirm copying/forwarding sends the whole block.
48. In the copy/forward target list, use Back to return to source text selection and confirm selected words remain selected.
49. Open the move dialog for a text block and confirm it opens directly to target conversation selection, with no selectable source text step and no Back button.
50. In the move dialog, rapidly click/tap the target conversation while the move/write is pending and confirm only one target block is created and the source is deleted once.
51. Move one whole message to the second conversation and confirm the target conversation moves to the top of the list, the current conversation remains open, and the move notice can open the target conversation.
52. Reorder messages with the up/down controls.
53. On desktop, use the block's drag handle to drag one text block between other blocks and confirm the visible order changes, the dragged block follows the pointer, and an insertion marker shows the exact landing space.
54. On desktop, release a dragged block over a gap, padding, or near-miss spot in the message list and confirm it still moves to the nearest insertion marker.
55. In a long conversation on desktop, drag a block handle near the top and bottom edges of the visible message list and confirm the list auto-scrolls while the drag stays active.
56. On a phone or touch emulator, scroll by swiping the body of a long text block and confirm it scrolls normally without starting a reorder.
57. On a phone or touch emulator, use the block's drag handle to drag one text block between other blocks and confirm the visible order changes, the dragged block follows the pointer, and an insertion marker shows the exact landing space.
58. In a long conversation on a touch device or emulator, drag a block handle near the top and bottom edges of the visible message list and confirm the list auto-scrolls while the drag stays active.
59. Select at least two messages, including a block with an image when possible, merge them, and confirm one unified block replaces the originals and keeps selected attachments. On desktop, enter block selection by double-clicking the first block; on touch devices, enter it by double-tapping the first block. Confirm the toolbar/composer transition does not accidentally select a neighboring block, then confirm intentional single clicks/taps toggle the remaining blocks.
60. Create or use a long conversation and confirm scrolling moves only the message list while the conversation header, merge toolbar, and bottom composer remain visible.
61. Open a long conversation and confirm the latest visible block starts aligned at the bottom of the message list, then send a new block and confirm the new block scrolls into that same bottom position.
62. Confirm the active conversation header shows the conversation title without a message-count subtitle.
63. Convert a message with several sentences to English, confirm the picker first shows a large selectable source-text panel, leave all words unselected, choose `Convert block`, then confirm multiple English-only segment groups appear without source-language segment text or a separate assembled preview. Choose non-default options for at least one segment and create the English block.
64. Confirm the picker shows an organizing/saving state after segment selection, then the English block appears directly below the original, moves the receiving conversation to the top of the list, contains organized Markdown structure when helpful, preserves every selected English segment verbatim, renders headings/lists/line breaks visually in the message body, and remains after reload.
65. Convert another message to English, select only a phrase from the source text, confirm tap/click word toggles and drag selection work on the device under test, then choose `Convert selection`. Create a new English block and confirm it contains only the selected part's English result while the AI result still reads correctly in context.
66. Repeat partial saved-message conversion and choose `Replace block`; confirm only the selected source phrase is replaced by the organized English result and the surrounding original text remains in place.
67. Enter draft text in the composer and press `Ctrl+Shift+Enter` on Windows/Linux or `Cmd+Shift+Enter` on macOS/iPad hardware keyboards. Confirm the draft sends directly without opening English conversion and cannot be sent twice by repeating the shortcut during the pending send.
68. Enter draft text in the composer, paste or select a small image, convert the draft to English, choose an option, and confirm `Send English` organizes the selected English text, creates the organized Markdown result as a new message with the image attached, clears the composer image preview, and does not first place the English text in the composer.
69. Click `Synthesize conversation index` in the active conversation header More menu and confirm exactly one new index block appears at the bottom of the conversation.
70. Confirm the synthesized index includes one clickable row per source block that existed before synthesis, including earlier synthesized index blocks if any existed.
71. Click several index rows and confirm the message list scrolls to the matching source block and highlights it. Delete a referenced source block if practical and confirm that row becomes disabled rather than failing.
72. Search for text that exists in loaded messages, including text from a synthesized index block.
73. Disconnect the browser from the network.
74. Reload the app.
75. Confirm the app shell opens and cached conversations/messages remain readable.
76. While offline, create, edit, paste or select a small image where supported, copy, delete, tag/filter, forward whole and selected text, move whole blocks, reorder conversations, reorder messages by controls, reorder messages by drag handle where supported, and merge messages.
77. Confirm requesting a new English conversion while offline fails gracefully without creating, replacing, sending, or changing draft text.
78. Confirm requesting a new conversation index while offline fails gracefully without creating a new index block.
79. Reconnect to the network.
80. Confirm all queued changes sync and remain visible after another reload.

Expected result:

- `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS/iPad keyboards opens draft English conversion from the composer and saves an inline edit from the message edit field.
- `Ctrl+Shift+Enter` on Windows/Linux and `Cmd+Shift+Enter` on macOS/iPad keyboards sends the current composer draft directly without opening English conversion.
- Plain `Enter` inserts a newline in the composer.
- Text/reference/date-only sends show a pending block immediately, reconcile to one confirmed block after sync, and restore the draft if the write fails. Rapid repeat sends or transfer target clicks do not create duplicates.
- Small images can be added without Firebase Storage; if an image is too large for inline Firestore storage, the UI shows a clear error and keeps the unsent draft/edit.
- Saved image previews are inert when clicked.
- Text-only block copy writes plain text. Blocks with attachments use best-effort rich clipboard data with text/html and image data where supported, and text fallback for text-bearing blocks.
- Markdown text-block downloads create a local `.md` file containing the raw block text, and empty text blocks do not expose an enabled download action.
- Long text blocks initially show a compact preview, expose icon-only expand/collapse controls with accessible labels/tooltips, and reference-target navigation expands the source block when needed so highlighted quote text is visible.
- Information-only mode hides normal block controls and the composer while preserving block information and navigation. Long text renders fully in that mode, the preference persists locally in the browser, and `Show normal controls` exposes normal actions for only one block at a time without opening edit mode automatically.
- Tag suggestions use previously created tags from loaded blocks, filter as the user types, exclude tags already on the block, and still allow new free-text tags.
- Dated blocks appear in the global calendar by browser-local date/time, with unscheduled blocks hidden from calendar views. The composer's `Date` action exposes its collapsed/expanded state to assistive technology. Whole-block copy/move preserves date/time, and merging keeps the earliest selected date/time.
- On phone-width layouts, the composer keeps `Date`, image attach, `[[` insertion, composer More, and Send in one action row, while paste image, structured reference, quote citation, and draft English conversion remain reachable from More.
- Copied/forwarded messages are labeled `Copied` or `Copied from [source conversation]`; only the source conversation name is clickable, and there is no lower copied-source card. Moved messages are labeled `Moved`.
- Forward dialogs start on a text selection step, transfer the whole block when no words are selected, and transfer only selected words when one or more word selections exist. The selected text is visible in the selection area itself; there is no separate preview.
- Forward word selection supports tap toggling, click-to-deselect, separate non-adjacent selections, and pointer drag selection/unselection on mouse and touch. Move dialogs skip text selection and go straight to target conversation selection.
- Structured conversation, whole-block, and quote reference cards navigate to their source conversation or source block when the source is still loaded; quote references highlight the selected source text. Unavailable sources remain readable from their stored snapshot.
- Saved blocks can connect to any loaded block, including themselves. Quote connection selection supports click toggles, drag selection/unselection, and separate non-adjacent fragments like the forward text-selection dialog. Incoming whole-block and quote connections appear as collapsed `Connected from N blocks` backlink rows, and expanded backlink cards navigate to the source block.
- Inline conversation links render from `[[Conversation title]]` text as marker-free title chips only when the title uniquely matches a conversation. The composer and inline edit suggestion lists filter by typed title text, support click and keyboard completion, and omit duplicate-title targets. Their visible `[[` insert buttons place the marker at the textarea cursor and open the same suggestions for touch users.
- Icon-only controls, including modal close buttons, row/message actions, and the mobile back button, show their icons centered within the button boundary. The composer's labeled `Date` action keeps its icon and text aligned without crowding the other toolbar actions.
- Saved block action toolbars keep common actions visible, while normal list reorder controls and Delete are available from block More; Delete is visually separated as the destructive action.
- Reordered conversations keep their order after reconnect and reload.
- Releasing a reordered conversation keeps the user on the conversation list rather than opening the reordered row or the first row.
- Conversations receiving newly created blocks move to the top of the list after direct creation, forwarding, moving, and English block creation.
- Reordered messages keep their order after reconnect and reload, whether reordered by explicit controls or the drag handle on desktop and mobile/touch devices.
- Drag reordering continues smoothly when the intended drop target starts off-screen by auto-scrolling the message or conversation list near its top or bottom edge, and list gaps resolve to the nearest insertion slot instead of cancelling the drop.
- Opening a conversation and appending a new visible block both leave the latest visible block aligned to the bottom of the scrollable message list.
- Block merge selection starts by double-clicking or double-tapping the first block, ignores the immediate delayed click that can be retargeted during the toolbar/composer transition, and then supports single-click/tap toggling for additional blocks. Merged messages keep the selected text in display order, and the original selected blocks remain removed after reconnect and reload.
- English conversion can keep the original message unchanged by creating a new block, or replace the original/selected source part when `Replace block` is chosen. Partial saved-message conversion sends only the selected source text for segmentation, uses surrounding source text only as context, and organizes selected segment text by a second AI pass before persistence. The organization pass may add Markdown structure around the chosen segments but must preserve every selected segment verbatim.
- Draft English conversion sends the organized selected English result directly as a new message, preserves current composer image attachments and references, clears sent previews, and leaves the composer out of that send step.
- Conversation index synthesis sends the active conversation's visible blocks in one request, appends the result as a bottom block, includes previous index blocks in later synthesis, and uses clickable rows that navigate to source blocks.
- Long conversations keep the composer and merge action reachable without scrolling the whole page.

## Known follow-up if a step fails

- If offline reload fails, inspect service worker registration and generated PWA assets.
- If cached reads or queued writes fail, inspect Firestore persistent local cache setup in `src/firebase.ts`.
- If cross-user access succeeds, stop and fix `firebase.rules` before deployment.
- If English conversion returns 404 in Vite dev, restart the Vite dev server so local `/api/to-english` and `/api/format-english` middleware are active.
- If conversation index synthesis returns 404 in Vite dev, restart the Vite dev server so local `/api/synthesize-index` middleware is active.
- If AI conversion or synthesis returns 401, confirm Google sign-in succeeded, `VITE_FIREBASE_PROJECT_ID` matches the signed-in app, and the current preview/hosting domain is in Firebase Authentication authorized domains.
- If AI conversion or synthesis returns 500/502, confirm `GROQ_API_KEY` and `FIREBASE_API_KEY` are configured in the correct Worker runtime and inspect Worker or Vite server logs.
