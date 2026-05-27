# Current Implementation

Last updated: 2026-05-26

Related docs: [documentation overview](../README.md), [product brief](../product/v1-product-brief.md), [architecture](../architecture/firebase-pwa-architecture.md), [QA checklist](../qa-v1-verification.md).

## Current implementation snapshot

The current app state is a working Firebase-backed React PWA named `Free Writing`.

Implemented:

- Vite + React frontend.
- Focused Vitest coverage for app transfer navigation, forward/move transfer decision helpers, transfer word-selection helpers, conversation service writes including inline wiki-link rename rewrites, sidebar drag reordering, message service writes, block connection/backlink helpers and UI, inline conversation-link parsing/typeahead/rendering, Markdown message rendering, long text block expand/collapse rendering, inline image attachments and paste handling, loaded-message search, tag normalization/filtering and inline tag suggestions, composer keyboard conversion and direct-send behavior, composer date action expansion and submission, inline editing, text/rich block copy feedback and fallbacks, Markdown text-block download helpers, reorder controls, desktop and touch drag-handle reorder behavior including body-scroll protection, gap drop zones, insertion markers, and edge autoscroll, multi-block merge selection on desktop and touch including retargeted delayed-click suppression after touch double-tap entry, English conversion UI/service/helper behavior, conversation index synthesis service/UI/Worker behavior, and the shared forward/move modal.
- React code organized into small components, subscription/shared UI hooks, Firebase services, and utility helpers.
- Firebase Authentication with Google provider.
- Firebase configuration guard that shows a setup notice when `.env` is missing or still contains placeholder values.
- Firestore cloud storage under `users/{userId}/conversations/{conversationId}/messages/{messageId}`.
- Firestore security rules scoped to the signed-in user's UID.
- Conversation create, rename, open, delete, and drag-handle reorder with floating preview, insertion marker, gap-tolerant drops, and edge autoscroll.
- Conversation list rows show conversation title and updated time only; they intentionally do not render stored message previews.
- Message create, compact display of long text blocks with icon-only expand/collapse, edit, copy-to-clipboard for text-only, text/image, and image-only blocks, Markdown `.md` download for text-bearing blocks, delete, copy/forward to another conversation with clickable source-conversation metadata, move whole blocks to another conversation with a post-move open-target notice, partial text copying from the forward transfer dialog, structured conversation links, quote citations, saved block-to-block connections with derived backlinks, inline `[[Conversation title]]` links with composer suggestions, search, manual up/down reorder, drag-handle reorder on desktop and touch/pointer devices with message-list edge autoscroll, selected-block merge, and synthesized clickable conversation index blocks.
- Optimistic composer sends for text/reference/date-only blocks. `App.tsx` reserves a Firestore message ID, appends a local pending block immediately, clears the composer, writes with that same ID, and removes the pending copy when the listener returns the confirmed document. If the write fails, the pending block is removed and the draft is restored.
- Optional block date/time scheduling with a top-level global Calendar screen. Dated blocks from all loaded conversations appear in Today, This week, and This month views; calendar items open and highlight the source block.
- Small image attachments on new and edited blocks. Images can be selected, pasted into the composer, pasted through a touch-friendly clipboard action where the browser permits it, or pasted while editing an existing block.
- Image attachments are compressed in the browser and stored inline in Firestore message documents. Firebase Storage is intentionally not used so the app stays on the free Spark plan.
- English conversion for saved messages and composer draft text. It segments source text, presents three English options per segment, assembles the selected options, sends that selected English through a second AI organization pass that can add Markdown structure, and then creates a new message below a saved source, replaces a saved source, or sends selected draft English text directly as a new message.
- Conversation index synthesis for the active conversation. The header action sends all visible blocks in one contextual AI request, appends a new bottom index block, and renders each generated entry as a clickable row that jumps to its source block.
- Message transfer support distinguishes copied/forwarded messages from moved messages with `transferType` and stores `forwardedFromConversationTitle` for copied-block origin display.
- Composer `Ctrl+Enter` / `Cmd+Enter` opens draft English conversion, `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` sends the current draft directly, and plain `Enter` inserts a newline. Inline message edits use `Ctrl+Enter` / `Cmd+Enter` to save.
- Responsive phone/desktop layout.
- Conversation pane layout is constrained to the viewport; only the message list scrolls, keeping the conversation header, merge toolbar, and composer visible in long conversations. Entering a conversation bottom-aligns the latest visible block, and newly appended visible blocks scroll into the bottom position.
- Dark visual theme across sign-in, sidebar, conversation pane, composer, message bubbles, modal, and hover states.
- PWA manifest and generated service worker.
- Browser/PWA theme colors are aligned to the dark app shell color.
- Firestore persistent local cache is enabled for cached data and offline writes.
- Conversation order and message order are persisted with numeric `sortOrder` values and sync across devices. New blocks move the receiving conversation to the top by assigning a top `sortOrder`; manual reorder remains stable until a later new block arrives in a conversation.
- Search runs across messages loaded by Firestore subscriptions; the current hook subscribes to every conversation's messages after the conversation list loads.
- Calendar browsing runs across the same loaded message set as global search and tag browsing; it does not require a separate Firestore query or external index for v1.
- Cloudflare Worker backend proxy for hosted English conversion, selected-English Markdown organization, and conversation index synthesis.
- Local Vite development middleware for `/api/to-english`, `/api/format-english`, and `/api/synthesize-index` so Codespaces/Vite testing works without Firebase Hosting rewrites.
- Repeatable non-deploying security-check workflow in `docs/ai-maintenance/security-check.md`, exposed through `npm run security:check`.

Known development follow-ups:

- Keep `docs/qa-v1-verification.md` current as Firebase/offline behavior changes.
- Use `docs/ai-maintenance/security-check.md` whenever security or privacy needs a repeatable audit focused on keeping writing and attachments inaccessible to other app users.
- Add emulator-backed Firestore rules tests if rule complexity grows beyond the current per-user UID isolation model.
- Verify offline create, edit, delete, forward, move, conversation reorder, message reorder by controls, message reorder by drag handle on desktop and mobile/touch devices, and merge behavior in a real browser against Firebase/Firestore.
- Consider loading only the active conversation's messages or adding a search index if large conversation lists become slow; this would require revisiting current loaded-message search behavior.
- Consider code-splitting Firebase-heavy client code if the production bundle warning becomes a deployment concern.
- Recompute or clear stored conversation previews after message delete, merge-original deletion, and move-source deletion if `lastMessagePreview` is reused in UI later.
- Watch Firestore document size if image usage grows. Inline images keep the app free, but they are bounded by Firestore document limits and are intended for small screenshots/images rather than large media libraries.
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
- Groq Chat Completions for English conversion, selected-English organization, and conversation index synthesis through a server-side proxy

Current visual system:

- `src/styles.css` is a single global stylesheet rather than a component-scoped CSS system.
- The UI uses a dark base (`#101719`) with dark panel surfaces and bright teal action accents.
- `:root` declares `color-scheme: dark` so native form controls and browser defaults align with the app theme.
- Shared button styling lives in `src/styles.css`: use `.icon-button` for icon-only controls, including the mobile back button, `.composer-date-button` for the composer's labeled date action, and `.primary-button` or `.new-conversation` for primary text+icon actions. The composer date width is centralized with `--composer-date-button-width` so desktop and mobile sizing stay aligned. These shared styles center direct SVG children and prevent icon sizing/alignment drift when new lucide icons are added.
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
VITE_SYNTHESIS_API_URL=
```

The `.env` file should stay local and must not be committed. `VITE_FIREBASE_STORAGE_BUCKET` can be blank; image attachments are compressed client-side and stored inline in Firestore message documents so the app stays compatible with the free Firebase Spark plan.

`VITE_TRANSLATION_API_URL` is optional for local Vite dev. Leave it blank locally to use the same-origin `/api/to-english`, `/api/format-english`, and `/api/synthesize-index` middleware in `vite.config.ts`. For the hosted app, set it to the deployed Cloudflare Worker URL before building production; English formatting derives `/api/format-english` from that same Worker URL, and conversation index synthesis derives `/api/synthesize-index` unless `VITE_SYNTHESIS_API_URL` is explicitly set.

For local Vite-only translation testing, `GROQ_API_KEY` may be stored in ignored `.env` without the `VITE_` prefix. The local middleware verifies Firebase ID-token JWTs against Google's Firebase public certificates and checks the configured `VITE_FIREBASE_PROJECT_ID`. For Cloudflare Worker local testing, copy `.dev.vars.example` to `.dev.vars`. For the deployed Worker, set secrets with Wrangler:

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
  Coordinates app state, derived data, and user action handlers. Owns local optimistic pending-message state for text/reference/date-only sends and merges pending blocks with Firestore listener data by shared message ID. Cross-component workflows remain here, while pure tag filtering/selection rules and conversation-index text formatting are delegated to `src/utils/tags.ts` and `src/services/synthesis.ts`.

src/components/SignInScreen.tsx
  Logged-out Firebase sign-in screen.

src/components/Sidebar.tsx
  Search, conversation list, create, rename, delete, drag reorder, and navigation UI. Normal conversation rows show title and updated time; search results still show matching message text for context.

src/components/ConversationPane.tsx
  Active conversation view and orchestration for selected-message state, copy/download/edit/transfer/reorder/drag-and-drop/merge flows, English conversion hook wiring, index synthesis, insertion marker state, reference picker open mode, bottom-aligned latest-block scrolling on conversation entry/new block append, and inline edit/image-paste state. Backlink grouping is delegated to `src/utils/messageReferences.ts`.

src/components/CalendarPane.tsx
  Global dated-block calendar. Owns Today/This week/This month view selection, groups loaded blocks by local date, and opens source messages through the same navigation/highlight path as references.

src/components/SelectionToolbar.tsx
  Multi-block selection toolbar rendering for merge, copy-to-conversation, move-to-conversation, copy text, delete, cancel, selected count, busy states, and inline selection errors.

src/components/ReferencePickerModal.tsx
  Composer-side conversation link and quote citation picker plus saved-block connection picker. Owns picker-local conversation/message state, delegates quote word selection gestures to `src/hooks/useWordRangeSelection.ts`, creates structured references, and returns the chosen reference or quote-fragment references to `ConversationPane`.

src/components/MessageDragPreview.tsx
  Floating dragged-message preview rendering used by message drag reordering.

src/components/MessageBubble.tsx
  Per-message rendering and local action wiring. Owns message metadata display including scheduled date/time, client-only `Sending...` pending state, clickable copied-origin conversation names, inert image attachment previews, synthesized index rows, copy feedback label, reorder buttons and drag handle, connect/download/transfer/delete/English action buttons, and drag/pointer event binding passed down from `ConversationPane`. Pending blocks hide normal block actions until confirmed. Text rendering, connection cards/backlinks, inline edit form markup, and block tag rendering/editing are delegated to smaller message components.

src/components/MessageConnections.tsx
  Per-message structured reference and backlink rendering. Owns outbound reference cards, collapsed/expanded backlink rows, reference icons, and navigation target construction for cards while receiving loaded backlink data from `ConversationPane`.

src/components/MessageText.tsx
  Message body text rendering. Owns lightweight safe Markdown rendering for headings, paragraphs, ordered/unordered lists, blockquotes, and line breaks; inline conversation-link rendering; reference-range highlighting; and compact long-text previews. Blocks over three source lines or the wrapped-paragraph character threshold render a preview with an icon-only expand/collapse button; reference-target navigation auto-expands the source block so highlighted quote ranges are visible and uses the plain text path while highlighting. Marker parsing stays delegated to `src/utils/inlineConversationLinks.ts`.

src/components/MessageEditForm.tsx
  Inline message edit form rendering. Owns the edit textarea, scheduled date/time input, existing/new image previews, editable reference cards, save/cancel controls, and edit-form keyboard behavior while receiving all edit state and callbacks from `MessageBubble`.

src/components/MessageTagEditor.tsx
  Per-message tag chip and inline tag editor rendering. Owns tag editor open/draft/highlight/saving/error state, suggestion keyboard handling, add/remove actions, and calls back to `ConversationPane` through `MessageBubble` for persistence. Pure tag normalization, dedupe, add/remove, and suggestion filtering stay in `src/utils/tags.ts`.

src/components/MessageComposer.tsx
  Draft composer rendering, pending reference chips, inline conversation-link typeahead, labeled `Date` action, scheduled date/time input, image selection/paste previews, and keyboard behavior. Owns the composer form markup, draft textarea, visible send action, a synchronous submit guard for rapid clicks/shortcuts, `[[` suggestion list with click and keyboard completion, date action `aria-expanded` / `aria-controls` wiring, `Ctrl+Enter` / `Cmd+Enter` draft English conversion shortcut passed down from `ConversationPane`, and `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` direct-send shortcut through the same submit path as the Send button.

src/components/EnglishPickerModal.tsx
  English conversion dialog rendering. Receives picker state and callbacks from `useEnglishConversionPicker` through `ConversationPane`, renders loading/error/ready/formatting/saving states, a scrollable English-only segment option list, and saved-message or draft-specific actions. It intentionally does not render source-language segment text or a separate assembled preview so large conversions keep the English options readable.

src/components/ForwardModal.tsx
  Transfer dialog used when forwarding or moving a message. Forwarding starts with a source text selection step that renders selectable word tokens, supports tap toggling plus pointer drag select/unselect on mouse/touch/pen, and advances to a separate target conversation step without rendering a separate selected-text preview. Moving skips text selection and opens directly on target conversation selection for whole-block moves. The modal excludes the source conversation, returns selected text ranges or per-message selections for forwarding, owns a synchronous single-flight target-selection guard, disables target buttons while the transfer is pending, and shows inline transfer errors while delegating shared click/drag word-selection gestures to `src/hooks/useWordRangeSelection.ts` and pure selected-count/payload construction to `src/utils/transferSelection.ts`.

src/hooks/useMessagingData.ts
  Authentication, conversation, and message subscription lifecycle.
  After sign-in, subscribes to the conversation list and then to every conversation's messages.
  This keeps loaded-message search simple, but can become expensive for large datasets.
  It does not currently expose per-subscription loading or error states to the UI.

src/hooks/useListReorderDrag.ts
  Shared native drag, touch/pointer drag, insertion target, floating preview, and edge-autoscroll state for reorderable lists.

src/hooks/useWordRangeSelection.ts
  Shared word-token click/tap toggling and pointer drag select/unselect state for transfer and quote-selection modals. It keeps pointer capture, drag direction, single-message ranges, and per-message range maps out of modal components while reusing the pure range helpers in `src/utils/transferSelection.ts`.

src/hooks/useImagePreviews.ts
  Shared object-URL image preview lifecycle for composer and inline edit image files.

src/hooks/useEnglishConversionPicker.ts
  English conversion picker state machine for saved-message and draft conversion. Owns loading/ready/error/formatting/saving states, segment option selection, selected English assembly, second-pass English organization before persistence, draft image/reference preservation, and the callback that clears sent draft image previews.

src/services/
  Firebase auth, conversation, message, image preparation, search, translation, and synthesis request operations.
  `messages.ts` keeps Firestore message write payload construction in small local helpers so create, client-reserved-ID create, transfer, merge, image attachment, English-result, and synthesized-index writes share the same field defaults. `reserveMessageId` and `createMessageWithId` support optimistic composer sends without storing pending-only fields in Firestore.
  `storage.ts` is named for historical upload intent but currently performs free-plan client-side image compression and inline attachment construction; it does not call Firebase Storage.
  `synthesis.ts` posts the active conversation title and all visible blocks to the AI proxy, validates one returned index entry per source block, normalizes empty/image-only blocks to fallback descriptions, and formats the plain-text fallback/search body for persisted index messages.

src/utils/messageDownload.ts
  Browser-only Markdown download helper for saved text blocks. It builds a `text/markdown;charset=utf-8` blob from the raw message text, creates a temporary anchor download, and names files with a sanitized conversation title, message creation date, message ID, and `.md` extension. It rejects empty text blocks and does not persist anything to Firestore or embed image attachments.

workers/translation/index.ts
  Cloudflare Worker for authenticated AI requests. Verifies Firebase ID tokens through Google Identity Toolkit, calls Groq with the `GROQ_API_KEY` secret, validates the JSON shape, and returns English segment/options data, organized selected-English Markdown text, or conversation-index entries.

functions/src/index.ts
  Legacy Firebase Function version of the translation proxy. Firebase Functions require the Blaze plan and are not used by the default free hosted deployment.

src/utils/
  Shared formatting, calendar grouping, clipboard, reference, error, ordering, image-file, tag, and small pure text helpers. `calendar.ts` owns local date/time parsing, date ranges, scheduled-block filtering, and day grouping. `inlineConversationLinks.ts` owns `[[Conversation title]]` parsing, active composer draft detection, suggestion filtering, completion, and title-marker rewrites during conversation rename. `messageReferences.ts` owns structured reference creation, duplicate detection, navigation targets, block previews, and derived backlink grouping. `messageClipboard.ts` owns block copy formatting and rich/plain clipboard fallbacks. `tags.ts` owns tag normalization, tag selection toggles, tag editor add/remove/suggestion filtering, tag summaries, and loaded-message tag result derivation. `englishConversion.ts` assembles selected English conversion segment options into the text passed to the second AI organization step, preserving optional segment separators so lists, headings, lines, and paragraphs are not flattened before formatting. `textSelection.ts` tokenizes transfer/source text into word and whitespace tokens, normalizes selected ranges, assembles selected parts, and removes selected ranges from source text for the service-level partial-move helper. `transferActions.ts` centralizes the forward/move transfer decision logic for single-message, selected-text, and multi-message transfers so `App.tsx` can stay focused on UI orchestration. `transferSelection.ts` keeps the transfer dialog's pure word-range updates, selected range counts, and per-message transfer payload construction testable outside React. `messageOrder.ts` computes behavior-preserving reorder arrays for message up/down controls, conversation drag targets, and message before/after insertion positions. `dropTargets.ts` resolves pointer positions to before/after drop slots from measured item rectangles. `imageFiles.ts` centralizes clipboard image extraction, preview IDs, and clipboard image filename extensions.

src/styles.css
  Global dark theme, responsive layout, viewport-constrained conversation pane, component surfaces, input states, shared button/icon alignment, message bubbles, drag reorder states, modal styling, English picker styling, and hover states.

index.html + vite.config.ts
  Browser theme color, generated PWA manifest colors, and local `/api/to-english`, `/api/format-english`, plus `/api/synthesize-index` development middleware. Theme colors currently match the dark app shell so installed/mobile surfaces do not flash the old light theme.
```

Development impact:

- `App.tsx` should stay focused on orchestration and cross-component workflows.
- UI changes should usually start in `src/components/`.
- Theme and layout styling changes should usually start in `src/styles.css`, then update PWA theme colors if the app shell color changes. The app shell and active conversation pane are viewport-height flex layouts; keep message-list scrolling isolated so the header, merge toolbar, and composer remain reachable.
- Firebase read/write behavior should usually start in `src/services/`.
- Hosted AI backend behavior should usually start in `workers/translation/index.ts`; local-only Vite proxy behavior lives in `vite.config.ts`. `functions/src/index.ts` is legacy Firebase Functions code and is not used by the free hosted path.
- Subscription and data-loading behavior should usually start in `src/hooks/useMessagingData.ts`.
- Small reusable helpers should live in `src/utils/`.
- Recurring AI maintenance prompts live in `docs/ai-maintenance/`; `docs/ai-maintenance-prompts.md` is only the index.

`docs/ai-maintenance/security-check.md` is the canonical repeatable security-audit workflow. It defines the default privacy boundary, read-only operating rules, manual inspection checklist, and `npm run security:check` command for tests, production build, and dependency audit.

This structure makes the app easier for an AI coding tool or human developer to modify because each file has a narrower purpose and fewer unrelated concerns.

## Hosting decision

The Version 1 app should be deployed with **Firebase Hosting**.

Current hosting configuration:

- `firebase.json` serves the production build from `dist/`.
- All routes rewrite to `/index.html` so the React app can handle navigation.
- Hosted English conversion, selected-English organization, and conversation index synthesis use the Cloudflare Worker URL configured through `VITE_TRANSLATION_API_URL`; synthesis can override with `VITE_SYNTHESIS_API_URL` if needed.
- Firestore rules are deployed from `firebase.rules`.

Primary checkpoint/deployment flow:

```bash
npm run ship -- "Context-rich commit message"
```

Or invoke the same checkpoint script directly:

```bash
bash scripts/commit-push-deploy.sh "Context-rich commit message"
```

For direct hosting-only deployment, use:

```bash
npm run deploy
```

`scripts/commit-push-deploy.sh` is the normal publishing path when changes should become a useful future-development checkpoint. Its help text explains that the commit message should capture what changed, why it matters, and what verification ran so another AI or developer can safely continue from the commit. The script runs tests, writes the production Worker URL to ignored `.env.production.local`, builds, commits unignored changes, pushes the current branch, deploys Firebase Hosting, deploys Firestore rules when `firebase.rules` changed, and deploys the Cloudflare Worker when `workers/translation/` or `wrangler.jsonc` changed.

Manual deployment setup/escape hatch:

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

### Forward, move, and merge messages

- `src/components/ForwardModal.tsx` keeps target selection single-flight while `App.tsx` awaits the forward/move operation. Repeated target clicks during that pending window are ignored, target buttons are disabled, and failures show an inline modal error.
- `src/services/messages.ts` has `moveMessage`, which writes the target message and deletes the source message in a Firestore batch.
- `src/services/messages.ts` still has `moveMessageTextSelection`, which can create moved target text from selected source ranges and update or delete the source message in the same Firestore batch, but the current move UI does not expose partial text selection; move actions go straight to whole-block target selection.
- `src/services/messages.ts` uses local write-payload helpers to keep normal, forwarded, moved, merged, and English-result message fields consistent.
- Copied/forwarded messages use `isForwarded: true`, `transferType: 'forwarded'`, `forwardedFromConversationId`, `forwardedFromConversationTitle`, and `forwardedFromMessageId`. `src/components/MessageBubble.tsx` renders these as `Copied from [conversation title]`, where the title is an inline `.source-link` button that navigates to the source conversation.
- Moved messages use `isForwarded: true`, `transferType: 'moved'`, `forwardedFromConversationId`, `forwardedFromMessageId`, and `forwardedFromConversationTitle: null`. They render only the small `Moved` label and do not show copied-origin navigation.
- `src/components/MessageBubble.tsx` includes a `Move to conversation` message action and displays transfer labels through `getTransferLabel`.
- Structured conversation, whole-block, and quote reference cards remain the UI for explicit user-added references and saved block connections; copied-origin metadata is shown only in the top message metadata line.
- `src/components/MessageBubble.tsx` includes a copy action with short-lived success/failure feedback. Text-only messages show `Copy text`; messages with attachments show `Copy block`, and image-only blocks can be copied.
- `src/utils/messageClipboard.ts` handles block clipboard writes. Text-only blocks use `navigator.clipboard.writeText`; blocks with attachments use `navigator.clipboard.write` with `text/plain`, `text/html` containing escaped text plus inline image tags in attachment order, and the first data-URL image as a binary image clipboard item when supported. If rich clipboard writing fails for a block that has text, it falls back to plain-text copy. Image-only rich-copy failures show `Copy failed` through `ConversationPane` copy feedback state.
- Clipboard copy is browser API UI only and does not touch Firestore. Paste fidelity depends on the destination app; plain text fields may receive only text even when rich clipboard data was written.
- `src/App.tsx` models the pending transfer as `{ mode: 'forward' | 'move', message? | messages? }`, uses `src/utils/transferActions.ts` to centralize transfer decision logic, passes source conversation titles into forwarded writes, navigates to the target after copy/forward, and keeps the current conversation active after moves while showing a dismissible `Moved to [target]` notice with an `Open` action.
- `src/components/ForwardModal.tsx` receives `mode`, `sourceMessage`, and optional `sourceMessages`, starts forwards on `Forward text`, advances to `Forward to`, starts moves directly on `Move to`, excludes the source conversation from target choices, and returns optional selected source text ranges or per-message selections for forwarding. It uses `src/hooks/useWordRangeSelection.ts` for shared pointer/click word selection and `src/utils/transferSelection.ts` for selected counts and per-message payload assembly.
- Transfer word selection is scoped to the forward dialog and quote/connection pickers. Normal message bubbles remain plain readable text, and move actions do not expose per-word selection.
- The transfer dialog supports separate selections: tapping a word toggles it, tapping a selected word deselects it, and pressing/holding then dragging with mouse, finger, or pen selects or unselects words depending on the first word's state. Hover is outline-only; selected words use the filled teal state.
- Forwarding with selected ranges creates a normal forwarded target message whose text is assembled from the selected parts. Adjacent selected words remain one phrase; non-adjacent selected parts are joined as separate paragraphs.
- Partial moving is supported by service/helper code but is not currently reachable from the move UI.
- Whole-block moving touches the target conversation preview after the batch, but does not recompute the source conversation preview after deleting the original. The service-level partial-move helper touches both the target and source conversation previews, but it is not reachable from the current move UI.
- `src/services/messages.ts` has `mergeMessages`, which normalizes the selected messages into display order, joins trimmed block text with blank lines, carries selected attachments forward in display order, creates one replacement message at the first selected message's `sortOrder`, and deletes the selected originals in the same Firestore batch.
- Merged replacement blocks are normal messages with `isForwarded: false`, `transferType: null`, and no source metadata.
- `src/components/ConversationPane.tsx` tracks selected message IDs, prunes selections when messages/conversations change, highlights selected bubbles, and owns suppression of the first delayed selection click after touch/pen double-tap entry. That pane-level suppression prevents the browser's follow-up click from selecting a different block if the merge toolbar/composer transition shifts the layout.
- `src/components/MessageBubble.tsx` starts block-selection mode from a desktop double-click or a touch/pen double-tap. Once selection mode is active, ordinary clicks/taps toggle additional blocks selected or unselected. Single clicks/taps outside selection mode do not select blocks.
- Successful merge clears the current selection. Failed merge keeps the selection and shows an inline error in the selection toolbar.

### Message editing

- `src/App.tsx` tracks only which `Message` is currently being edited; it no longer copies edit text into the composer draft.
- `src/components/MessageEditForm.tsx` renders the active edit as an inline textarea inside the message bubble with `Save` and `Cancel` actions. `src/components/MessageBubble.tsx` supplies the current edit state and callbacks.
- The inline edit textarea auto-expands to its content height with `useLayoutEffect`, so the full message remains visible while editing without an internal scrollbar.
- The bottom composer remains available for creating new messages while a message is being edited.
- Pasting copied images into the inline edit textarea adds removable previews inside the edit form. Saving appends the prepared image attachments to the existing block; existing attachments remain visible while editing.
- Inline edit save calls `onSaveEdit(message, text, imageFiles)`, which prepares any new image files, routes to `editMessage`, and clears `editingMessage` after the write.

### Image attachments

- `src/App.tsx` only uses optimistic pending blocks for sends without image files. Image sends wait until client-side compression and size validation complete, because the final attachment data is not available at click time.
- `src/types.ts` models optional `attachments` on messages. The only current attachment type is `image`.
- `src/services/storage.ts` compresses images client-side to JPEG data URLs, enforces per-image and per-message inline size limits, and returns message attachment metadata. The service name is historical; there is no Firebase Storage upload path.
- `src/App.tsx` prepares image files before message create/edit writes by calling `uploadMessageImages`, then passes inline attachments into `createMessage` or `editMessage`.
- `src/components/MessageComposer.tsx` supports image file selection, normal paste events, and a visible paste-image button for touch devices. `src/hooks/useImagePreviews.ts` owns object URL creation/revocation for composer and inline edit preview files. Clipboard read support is browser-dependent; when it is unavailable, the button falls back to file selection.
- `src/components/MessageBubble.tsx` renders saved image previews as inert elements, not links. Clicking a saved image intentionally does nothing.
- Image-only messages are allowed. Conversation previews use `Image` or `{n} images` when a message has no text.
- Search, English conversion, and conversation index synthesis use message text or fallback block descriptions only; image contents are not OCR-indexed or sent to the AI endpoint.
- Inline Firestore image storage avoids paid Firebase Storage but is not suitable for large original media. If compression cannot keep images within the configured limits, the composer/editor shows an error and preserves the unsent content.

### Reorder messages

- `src/App.tsx` keeps reorder persistence centralized by optimistically updating `messagesByConversation` and then calling `reorderMessages`.
- `src/utils/messageOrder.ts` keeps the pure reorder-array calculations outside `App.tsx`, with focused tests for up/down moves, drag/drop target moves, and before/after insertion moves.
- `src/utils/dropTargets.ts` keeps the geometry-independent nearest-slot calculation outside React components, so gap-tolerant drops can be tested without rendering React.
- `src/hooks/useListReorderDrag.ts` owns shared drag/reorder state, floating preview state, drop target resolution, and autoscroll for reorderable lists. `ConversationPane` wires that hook to message reorder persistence. `src/components/MessageDragPreview.tsx` renders the floating preview, while `src/components/MessageBubble.tsx` exposes up/down buttons and a dedicated drag handle with native desktop drag-and-drop and mobile/touch pointer bindings.
- Dragging starts only from the drag handle. The message bubble body is no longer draggable and keeps normal touch scrolling available for long text.
- Desktop, touch, and pen dragging start immediately from the handle, show a floating preview of the dragged block, dim the source bubble, and render an insertion marker in the exact space where the block will land.
- Drop detection first uses the pointer target when it is over a message, then falls back to the nearest before/after insertion slot based on visible message rectangles. This makes gaps, padding, insertion markers, and near-miss positions valid drop zones.
- Dragging near the top or bottom edge of the `.messages` scroll container starts a `requestAnimationFrame` autoscroll loop so desktop and touch/pen drags can reach off-screen drop targets without releasing the block. The loop is stopped on drop, drag end, pointer release, pointer cancel, or leaving the edge zone.
- Native desktop drag state is kept independent from touch/pen pointer state so browser pointer-cancel events during desktop drag do not clear the active desktop drop target.
- Dropping a message asks `App.tsx` to move the dragged message before or after the resolved target message.
- `src/services/messages.ts` persists the final visible order by rewriting numeric `sortOrder` values in a Firestore batch.

### Reorder conversations

- `src/components/Sidebar.tsx` uses `src/hooks/useListReorderDrag.ts` for conversation drag state, floating preview state, before/after insertion marker state, native desktop drag handlers, pointer handlers, gap-tolerant drop target resolution, and edge autoscroll. Sidebar keeps post-drag click suppression local to the conversation list.
- Conversation dragging starts from a dedicated row drag handle and is disabled while a row is being renamed or when only one conversation exists.
- Conversation dragging mirrors block dragging: desktop, touch, and pen drags show a floating row preview, dim the source row, render an insertion marker where the row will land, treat gaps/padding/near-miss positions as nearest insertion slots, and autoscroll the `.conversation-list` near its top or bottom edge.
- Releasing a reordered conversation suppresses the follow-up row click so the app stays on the conversation list instead of opening the dragged row or the new top row.
- `src/App.tsx` optimistically updates `conversations` with a before/after drop position and calls `reorderConversations`.
- `src/services/conversations.ts` normalizes conversations by `sortOrder`, falls back to recent update time for older records, creates new conversations above the current first row, can touch an existing conversation with a new top `sortOrder`, and persists manual ordering by rewriting numeric `sortOrder` values in a Firestore batch.
- `src/hooks/useMessagingData.ts` no longer auto-selects the first conversation when `activeConversationId` is `null`; explicit user actions, search results, reference navigation, creating a conversation, and transfer completion are the navigation paths into a conversation.

### Message search

- `src/services/search.ts` searches the `searchText` field on messages already present in `messagesByConversation`.
- `src/hooks/useMessagingData.ts` keeps that cache populated by subscribing to each conversation's messages, not only the active conversation.
- Search results clear the search term and open the result's conversation.
- This is intentionally simple, but it means search coverage depends on the active subscriptions and local cache.
- Message subscriptions query Firestore by `createdAt` and then normalize/sort by `sortOrder` in client code so older records without explicit ordering still display chronologically.

### Block tags and flags

- Blocks store free-text tags/flags in a normalized `tags` array. `src/utils/tags.ts` trims values, removes empties, deduplicates case-insensitively, and preserves the first display casing.
- `src/services/messages.ts` normalizes old records without `tags` to an empty array and exposes `updateMessageTags` for tag-only updates. Whole-block copy/move and English child blocks preserve tags, merged blocks get the union of source tags, and selected-text forwards create copied target blocks from the selected text.
- `src/utils/tags.ts` is the single home for pure tag behavior: add/remove helpers, case-insensitive selection toggles, editor suggestion filtering, summary counts, OR matching, and global loaded-message result derivation. Keep new tag rules there before wiring them into components.
- `src/components/MessageTagEditor.tsx` renders tag chips on each block and provides the inline add/remove tag editor. It owns editor-local UI state and delegates pure add/remove/suggestion calculations to `src/utils/tags.ts`.
- `src/components/MessageBubble.tsx` mounts `MessageTagEditor` and passes the current message, selection-mode state, loaded tag suggestions, and `onUpdateTags` callback; it no longer owns tag editor state directly.
- `src/components/Sidebar.tsx` shows a global tag browser across loaded blocks. Selecting one or more tags shows matching blocks across conversations; `App.tsx` derives those results through `src/utils/tags.ts`, and opening a result navigates to and highlights that block.
- `src/components/ConversationPane.tsx` shows active-conversation tag filters below the header. Filters use OR matching from `src/utils/tags.ts` and disable reorder controls while blocks are hidden.

### Structured references and block connections

- Messages can store structured `references` separately from body text. Conversation references point to another conversation by ID with a title snapshot. Block references point to a source message and store a target preview. Quote references also store selected text offsets and quote text.
- `src/components/ConversationPane.tsx` opens composer-side pickers for conversation links and quote citations, and saved-message connection pickers for whole-block or quote connections. It receives derived backlink groups from `src/utils/messageReferences.ts`.
- `src/components/ReferencePickerModal.tsx` owns the picker-local conversation/message state and uses `src/hooks/useWordRangeSelection.ts` for quote word selection. Saved-block connection mode can target any loaded block, including same-conversation blocks and self-links. Quote mode reuses the same word-range selection behavior as forward source selection so click and drag can create separate quote fragments, which save as separate quote references in one update.
- `src/components/MessageConnections.tsx` renders outbound reference cards below message text and collapsed backlink rows for incoming loaded references. Conversation references navigate to the source conversation; block references navigate to the source message; quote references navigate to the source message and temporarily highlight the cited text range when the source is still loaded.
- Inline editing can remove existing references from a saved message. Adding saved block connections uses the per-block `Connect block` action.
- Old messages without `references` are normalized to an empty reference list by the message subscription path.

### Inline conversation links

- Message text can include `[[Conversation title]]` markers. The markers stay in stored `text` and `searchText`, but `src/components/MessageText.tsx` renders unique matches as inline clickable title chips without showing the `[[` / `]]` markers.
- `src/components/MessageComposer.tsx` detects an active unfinished `[[` fragment at the textarea cursor, shows unique conversation-title suggestions, filters them case-insensitively as the user types, and completes the highlighted suggestion with click, `Enter`, or `Tab`. `ArrowUp` / `ArrowDown` move the highlight and `Escape` dismisses suggestions.
- `src/utils/inlineConversationLinks.ts` keeps parsing, active-draft detection, suggestion filtering, completion, and title-rewrite behavior pure and covered by focused tests.
- Inline links are title-based and schema-free. Missing or duplicate conversation titles render as plain text and are omitted from suggestions.
- `src/services/conversations.ts` accepts the previous title during rename and rewrites matching `[[Old title]]` markers across the user's saved message text to `[[New title]]`, updating `searchText` and `updatedAt`. Structured reference title snapshots are not rewritten.

### Conversation index synthesis

- `src/services/synthesis.ts` posts `{ conversationTitle, blocks }` to `VITE_SYNTHESIS_API_URL`, a `/api/synthesize-index` path derived from `VITE_TRANSLATION_API_URL`, or same-origin `/api/synthesize-index`.
- `src/components/ConversationPane.tsx` owns the header synthesis action, loading/error state, and calls `onSynthesizeIndex(activeMessages, activeConversation.title)` once for the current visible message list.
- `src/App.tsx` routes synthesis through `requestConversationIndex`, asks `src/services/synthesis.ts` to format the plain-text fallback/search representation, and persists the result with `createConversationIndexMessage`.
- `src/services/messages.ts` has `createConversationIndexMessage`, which appends a normal bottom message with `blockKind: 'conversation-index'` and `indexEntries`, then touches the receiving conversation with `moveToTop: true`.
- `src/components/MessageBubble.tsx` renders index blocks from `indexEntries` as clickable rows. Each row navigates to the source message ID in the same conversation and reuses the existing scroll/highlight behavior. Rows for deleted/unloaded source blocks stay visible but disabled.
- Synthesis includes previous index blocks because they are ordinary visible messages. The newly generated index cannot include itself because it is only written after the AI response returns.
- Empty or image/reference-only source blocks are sent to the synthesis service with fallback descriptions. The AI response must contain exactly one entry for every submitted source message ID; unknown, duplicate, or missing IDs are rejected.
- Conversation index synthesis is online-only. Created index blocks persist like normal messages and then participate in Firestore cache/sync behavior.

### English conversion

- `src/services/translation.ts` posts `{ text }` to `VITE_TRANSLATION_API_URL` or `/api/to-english` for selectable English segment options, and posts the selected English text to `/api/format-english` derived from the same Worker URL or same-origin path for the organization pass.
- The request includes the current Firebase ID token in the `Authorization` header.
- `src/hooks/useEnglishConversionPicker.ts` owns the English picker state and save orchestration. It opens conversion for saved messages or draft text, snapshots composer image files for draft conversion, tracks loading/error/ready/formatting/creating/replacing/draft-send states, assembles the selected English options, calls the second organization endpoint, and routes the organized result back to message creation/editing callbacks.
- `src/components/ConversationPane.tsx` wires the English conversion hook into saved-message actions, composer draft conversion, pending references, and the modal.
- `src/components/EnglishPickerModal.tsx` renders the English conversion dialog from hook state. It does not call translation or Firestore directly, and it keeps the ready state focused on the scrollable segment option list rather than rendering a separate selected-text preview.
- `src/utils/englishConversion.ts` assembles the selected English options before the second organization pass. Each AI segment returns exactly three options, the first option is selected by default, and optional `separatorAfter` metadata preserves spaces, line breaks, or paragraph breaks between selected segments.
- Saved-message conversion can create a new organized English Markdown block below the source or replace the source message by calling the normal edit flow. Draft conversion sends the organized English Markdown text directly as a new message with current composer image attachments and pending references, then clears the composer draft, references, and image previews through the normal create-message path plus composer preview cleanup.
- `src/services/messages.ts` has `createMessageAfter`, which inserts the English result directly below the source message by choosing a midpoint `sortOrder` when possible or rebalancing order when no numeric gap exists.
- English conversion is online-only. Created and replaced English blocks persist like normal messages and then participate in Firestore cache/sync behavior.
- Hosted production uses `workers/translation/index.ts`, Firebase ID-token verification through Google Identity Toolkit, and Cloudflare Worker secrets for `GROQ_API_KEY` and `FIREBASE_API_KEY`. Local Vite dev uses equivalent middleware in `vite.config.ts` with `GROQ_API_KEY` from ignored `.env`, verifies ID-token JWT signatures against Google's Firebase public certificates, and requires the token audience/issuer to match `VITE_FIREBASE_PROJECT_ID`.
- Translation prompts in the Worker and Vite middleware ask the model to prefer sentence-level or line-level segments, with one segment per complete sentence, list item, heading, quote, or short standalone line. English formatting prompts ask the model to keep meaning intact while arranging the selected English text into readable Markdown without adding new facts or filler.

### Offline behavior

- Firestore offline persistence is enabled in `src/firebase.ts`.
- The current code initializes Firestore with persistent local cache and a multiple-tab manager.
- The installed Firebase SDK exposes this setting as `localCache`, using `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.

### Sync behavior

Conversation `lastMessagePreview` is still stored and updated for possible future use, but the current conversation list does not render it. Conversation `sortOrder` controls list ordering, while `updatedAt` remains useful for display and fallback ordering. `touchConversation(..., { moveToTop: true })` updates preview/time and assigns a new top `sortOrder`; it is used for direct message creation, forwarded blocks, moved whole blocks, English result block creation, and synthesized index block creation. Edits, merges, English replacements, and service-level source-side partial move updates touch preview/time without moving the conversation to the top. `lastMessagePreview` is not currently recalculated after deleting a message, deleting originals during merge, or removing a moved message from its source conversation.

### Header display

- `src/components/ConversationPane.tsx` shows the active conversation title in the pane header, without the previous message-count subtitle.

### Performance

Current implementation loads every conversation's messages to support simple search; switch to active-conversation loading plus a search-specific strategy if the dataset grows.
