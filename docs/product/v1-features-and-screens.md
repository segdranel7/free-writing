# Version 1 Features and Screens

Last updated: 2026-05-29

Related docs: [design principles](design-principles.md), [product brief](v1-product-brief.md), [architecture](../architecture/firebase-pwa-architecture.md), [current implementation](../implementation/current-implementation.md).

## 7. Main features

### 7.1 Google/Gmail login

The user should be able to sign in using Google.

Requirements:

- Show a simple sign-in screen when logged out.
- Use a button like `Continue with Google`.
- After login, load only that user’s conversations and messages.
- Keep the user signed in between sessions where possible.
- Provide a simple sign-out option.

Recommended implementation:

- Firebase Authentication
- Google provider

---

### 7.2 Conversations

The user can create multiple conversations.

Examples:

- Personal Notes
- Work Ideas
- Journal
- Links
- Project A
- Reminders

Conversation features:

- Create a new conversation
- Rename a conversation
- Open a conversation
- See last updated time
- Delete a conversation, with confirmation
- Reorder conversations in the conversation list with a drag handle
- While reordering, show block-like drag feedback: a floating row preview and an insertion marker at the exact landing position.
- Releasing a reordered conversation should keep the user on the conversation list; it should not automatically open the reordered row or the new top row.
- When a conversation receives a newly created block, whether from direct input, forwarding, moving, or English block creation, that conversation moves to the top of the list.

For Version 1, conversations are private to the signed-in user.

---

### 7.3 Messages

Inside each conversation, the user can create messages.

Each message should show:

- Text
- Image attachments, when present
- Created date/time
- Edited indicator, if edited

Long message text should initially render as a compact preview of roughly three lines, with an icon-only expand/collapse control that reveals or hides the full block content.

Required message actions:

- Create message
- Toggle information-only view for the active conversation
- Add small image attachments from the file picker or copied image paste
- Edit message
- Copy block content to the system clipboard
- Download text block content as a Markdown `.md` file
- Export the active conversation or all conversations as JSON plus Markdown
- Delete message
- Add, remove, and reuse tags/flags on a message
- Copy/forward message to another conversation
- Move message to another conversation
- Reorder message within the current conversation with explicit controls or a drag handle on desktop and touch/pointer devices
- Merge multiple selected messages into one unified block
- Convert message to English
- Synthesize a clickable conversation index block for the active conversation
- Switch the active conversation between List and Kanban visualizations

Optional message actions:

- Duplicate message in same conversation

### 7.3.0 Information-only view mode

The user can switch the active conversation into an information-only view to concentrate on each block's content.

Version 1 behavior:

- The conversation header exposes an `Information-only mode` toggle.
- The mode is remembered locally in the browser and applies when returning to the app on that device.
- While active, each block still shows its text, images, tags, created/edited/scheduled metadata, references, backlinks, inline conversation links, and synthesized index rows.
- While active, normal creation/editing/management controls are hidden, including the composer, block action bars, tag add/remove controls, selection toolbar, and long-text expand/collapse buttons.
- Long text renders fully in this mode so the user does not need an expand action to read it.
- Navigation remains available: inline conversation links, reference cards, backlinks, copied-source conversation links, and synthesized index rows still open their targets.
- Each text-bearing saved block exposes a `Show normal controls` option. Using it restores the normal per-block controls for only that block while the rest of the conversation remains in information-only view.
- Only one block can show normal controls at a time; choosing another block closes the previously opened one.
- The active normal-controls block can return to the information-only presentation with `Return block to view mode`.
- Entering information-only mode clears multi-block selection state.

Requirements:

- This is a visualization preference, not Firestore data. It should not change messages, conversations, tags, references, or ordering.
- The local browser preference should not be treated as account-synced state.

### 7.3.0.1 Visualization templates and Kanban

The user can view the same conversation blocks through alternate templates over time. Version 1 starts with List and Kanban.

Version 1 behavior:

- The conversation header exposes List and Kanban view controls directly on wider screens and through More on narrow screens.
- The selected List/Kanban view is saved per conversation and syncs across devices.
- Kanban uses custom columns created by the user; no default columns are created automatically.
- Existing blocks are not moved into Kanban automatically. They stay visible in List view until assigned to a Kanban column.
- Each block can belong to one Kanban column at a time.
- The block's top tag row exposes a compact button-like column selector when the conversation has Kanban columns. It shows `∅` when no column is selected and the selected column name when assigned, without a visible dropdown arrow.
- New blocks sent from the composer while Kanban is open are assigned to the active Kanban column.
- Columns can be added, renamed, moved left/right, and deleted.
- Deleting a column does not delete blocks. Blocks in that column become unassigned and return to List-only visibility.
- Desktop Kanban shows columns horizontally. Mobile Kanban shows one active column at a time with previous/next column controls and a picker.
- Kanban cards keep the same core block actions where practical: edit, tags, connect, copy/download, English conversion, forward, move to conversation, and delete.
- Kanban cards expose shortcut buttons for moving up/down in the active column and moving to the previous/next column.

Requirements:

- Kanban column metadata is stored on the conversation.
- Kanban card membership and column-local order are stored on the message.
- The normal list `sortOrder` remains separate from Kanban card order.
- This view system should be extensible for future templates such as whiteboard or flowchart without hard-coding all visualization state into the list renderer.

### 7.3.1 Message composer keyboard behavior

The composer should support fast keyboard entry for desktop and hardware-keyboard tablet users.

Requirements:

- `Enter` inserts a new line in the message text.
- `Ctrl+Enter` opens draft English conversion on Windows/Linux.
- `Cmd+Enter` opens draft English conversion on macOS and iPad hardware keyboards.
- `Ctrl+Shift+Enter` sends the current draft directly on Windows/Linux.
- `Cmd+Shift+Enter` sends the current draft directly on macOS and iPad hardware keyboards.
- Typing `[[` opens conversation-title suggestions for inline conversation links.
- The composer should also expose a visible `[[` insert action so touch users can start an inline conversation link without relying on a hardware or software keyboard sequence.
- On phone screens, the composer keeps `Date`, image attach, `[[` insertion, a composer More menu, and Send in one action row; paste image, structured references, quote citation, and draft English conversion stay available in that More menu.
- On tablet/desktop screens, the composer can keep all draft tools visible while preserving Send as the visually primary action.
- Conversation-title suggestions filter as the user types and support mouse/touch selection plus desktop keyboard navigation with `ArrowUp`, `ArrowDown`, `Enter`, `Tab`, and `Escape`.
- The visible Send button sends the current draft.
- Empty or whitespace-only messages should not be sent.
- Text/reference/date-only messages should appear in the active conversation immediately after sending, with a pending state if the network write has not confirmed yet.
- A rapid double-click or repeated keyboard submit should create only one block for the same send attempt.
- If a text/reference/date-only send fails, the pending block should disappear, the draft/reference/date state should be restored, and a clear composer error should appear.
- Image-only messages may be sent when at least one image is attached.
- Messages with image files may wait until image preparation succeeds before appearing, because the app must first compress and validate the attachment payload.
- While editing a message inline, `Ctrl+Enter` / `Cmd+Enter` should save the edit.
- The visible Send and inline Save buttons remain available for touch users.

### 7.3.2 Image attachments

The user can add small images to message blocks while staying compatible with the free Firebase Spark plan.

Version 1 behavior:

- The composer supports selecting image files.
- The composer supports pasting copied images from normal paste events.
- Touch devices have a visible paste-image action that uses the browser clipboard API when available and falls back to file selection when not available.
- The inline edit field supports pasting images while editing an existing block.
- Pasted or selected images show previews before saving.
- New images added during editing are appended to the existing block attachments.
- Saved image previews are inert; clicking them should not open a new tab or viewer.
- Image-only blocks are allowed.

Requirements:

- Images are compressed client-side and stored inline in the Firestore message document instead of Firebase Storage, so no paid Firebase Storage bucket is required.
- If an image or set of images is too large for inline storage, the app should show a clear error and keep the draft/edit content intact.
- Search and English conversion operate on message text, not image contents.

### 7.3.3 Copy blocks

The user can copy saved block content to the system clipboard.

Version 1 behavior:

- Text-only blocks copy plain text.
- Blocks with images copy plain text plus rich HTML containing the block text and attached images where the browser supports rich clipboard writes.
- Image-only blocks can be copied.
- Copying an image block also provides the first attached image as an image clipboard item when the browser supports it.
- If rich clipboard copy is unavailable or fails for a block that has text, the app falls back to copying plain text.
- Copy feedback should clearly show success or failure.

Requirements:

- Copying is a browser clipboard API action only and does not change Firestore data.
- Attached images should be included in display order in the rich HTML clipboard payload.
- Actual paste results depend on the target app; plain text fields may only receive the text.

### 7.3.3.1 Download text blocks as Markdown

The user can download a saved text block as a local Markdown file.

Version 1 behavior:

- Text-bearing blocks expose a `Download text as Markdown` action.
- The downloaded file contains the block's raw text content.
- The filename uses a sanitized conversation title, the block creation date, the block ID, and the `.md` extension.
- Blocks with no text do not expose an enabled Markdown download action.

Requirements:

- Downloading is a browser-only action and does not change Firestore data.
- Image attachments are not embedded in the Markdown file in Version 1.

### 7.3.3.2 Export conversation data

The user can export conversation data from inside the signed-in app for experiments outside the app.

Version 1 behavior:

- The active conversation header More menu exposes an `Export conversation` action.
- The app header More menu exposes an `Export all conversations` action.
- Each export downloads a faithful JSON bundle and a readable Markdown companion.
- JSON preserves full conversation and message records, including inline image attachment data.
- Markdown includes readable conversation/message metadata and raw text, but omits inline base64 image payloads.
- Export actions show a concise pending state and a clear error if the export fails.

Requirements:

- Exporting is a browser download action and does not change Firestore data.
- Export reads through the signed-in user's normal Firestore access; no admin credential or separate CLI path is required.
- Pending optimistic blocks are excluded until confirmed by Firestore.

### 7.3.4 Convert text to English

The user can convert saved text blocks, selected saved-text portions, or draft composer text into English.

Version 1 behavior:

- Each message has a `Convert to English` action.
- The composer has a `Convert draft to English` action when a non-empty draft is present.
- Saved-message conversion opens with a source text selection step. Leaving all words unselected converts the whole block; selecting words converts only that part.
- The saved-message selection step uses the same tap/click toggle and pointer-drag word selection behavior as forwarding and quote selection, and should use most of the available viewport on tiny devices.
- For selected saved-message text, the conversion request sends the selected text plus surrounding before/after context. The AI must use the context only for meaning and continuity, not translate or return it.
- The app breaks the selected text into sentence-level segments, preferring one segment per complete sentence or short standalone line.
- After the user chooses segment options, the selected English text is sent through a second AI organization pass before saving or sending.
- The organization pass is limited to arranging the selected English segments into readable Markdown. It may add headings, subheadings, bullet lists, numbered lists, quotes, line breaks, paragraph breaks, and concise organizational text, but every selected segment must remain present verbatim.
- Each segment shows three selectable English versions.
- The first option is selected by default.
- The user can choose one version for every segment.
- The picker focuses on the segment option list and does not show a separate assembled preview.
- For a saved message, `Create block` inserts the organized English Markdown text for the selected part as a new message directly below the original.
- For a saved message, `Replace block` updates the original block. Whole-block conversion replaces the whole block; partial conversion replaces only the selected source text and keeps surrounding text intact.
- For draft text, `Send English` sends the organized English Markdown text directly as a new message while preserving any current composer image attachments and structured references.

Requirements:

- Empty text should not be sent for conversion.
- Conversion requires the signed-in user and working server-side translation and English-organization endpoints.
- Translation or organization failures should show a clear error without creating, replacing, or changing draft text.
- The Groq/API key must stay server-side and must not be exposed through `VITE_` browser environment variables.
- Saved English results are normal message text, so Markdown remains editable, searchable, copyable, downloadable as raw `.md` text, and renderable in the message body.

---

### 7.3.5 Conversation index synthesis

The user can synthesize a map-like index for the active conversation.

Version 1 behavior:

- The active conversation header More menu has a `Synthesize conversation index` action.
- The action sends all currently visible conversation blocks in display order in one contextual AI request.
- Previous synthesized index blocks are included as source blocks for later synthesis.
- The newly created index block is appended to the bottom of the conversation.
- Each index entry is clickable and jumps to the corresponding source block, reusing the same source-block navigation/highlight behavior as references.
- If a source block is later deleted, its index entry remains visible but disabled.

Requirements:

- Synthesis requires the signed-in user and a working server-side AI endpoint.
- The AI request must consider the whole conversation context before generating entries and must not make one separate summarization request per block.
- The response must include exactly one entry for each submitted block.
- Synthesis failures should show a clear error without creating a new block.
- The Groq/API key must stay server-side and must not be exposed through `VITE_` browser environment variables.

---

### 7.3.6 Message references and block connections

The user can attach structured references to another conversation or a quoted message block, and can connect saved blocks to other saved blocks. The user can also write inline conversation links in the message text with `[[Conversation title]]`.

Version 1 behavior:

- The composer can add a reference to another conversation or a selected quote from an existing message.
- A saved block can connect to any loaded block, including a block in the same conversation or itself.
- Saved-block connections can point to the whole target block or selected quote fragments inside the target block.
- Quote fragment selection uses the same word-selection behavior as forwarding: click toggles words, dragging selects or unselects multiple words, and separate non-adjacent fragments stay separate.
- Blocks with incoming saved-block connections show a collapsed backlink row such as `Connected from 2 blocks`; expanding it shows clickable source-block cards.
- The composer supports `[[Conversation title]]` inline links through typeahead suggestions from unique conversation titles.
- The inline edit form supports the same `[[Conversation title]]` typeahead behavior while editing an existing block.
- The composer and inline edit form both provide a visible `[[` insert action that places the marker at the current cursor or selection and opens suggestions.
- Saved inline conversation links render as the conversation title with a visual linked/quoted cue; the `[[` and `]]` markers do not show in the message body.
- Inline conversation links open the matching conversation when exactly one loaded conversation has that title.
- Missing or duplicate conversation titles remain plain text.
- Renaming a conversation should update matching inline `[[Old title]]` markers to the new title in saved messages.
- Reference cards render below the message text once saved.
- Conversation references open the source conversation when the source is loaded.
- Whole-block and quote references open the source message, with quote references highlighting the quoted text range when the source is loaded.
- References are stored separately from message body text and remain visible even if the source is not currently loaded.
- Duplicate exact connections from the same source block are ignored.

Requirements:

- Conversation/quote reference creation is available in the composer, and saved-block connection creation is available from each saved block.
- Reference cards should clearly show the source conversation, target block preview, or quoted text.
- Users can remove references while editing an existing message.
- References do not require additional external search infrastructure.
- Inline conversation links are stored in normal message text and do not add a separate schema field.

---

### 7.3.7 Tags and flags

The user can tag or flag message blocks for later filtering.

Version 1 behavior:

- Each message can show one or more tag chips.
- The user can add a free-text tag from the message block.
- While typing a tag, the editor suggests previously created tags from all loaded blocks.
- Suggestions filter case-insensitively, exclude tags already on the current block, and can be selected by click or Enter.
- The user can remove tags from a message block.
- The conversation screen can filter the active conversation by tag.
- The conversation list/sidebar can browse global tags and show matching loaded blocks across conversations.

Requirements:

- Tags and flags share the same free-text `tags` field.
- Tags should be trimmed, ignore empty values, and dedupe case-insensitively.
- Filtering uses loaded/cached messages and should not require external search infrastructure.

---

### 7.3.8 Date/time and calendar

The user can add a date and time to a message block and browse dated blocks on a global calendar.

Version 1 behavior:

- A block may be unscheduled or have one required date+time value.
- The composer provides a visible `Date` action that opens the date/time control; the inline edit form provides the date/time control directly.
- Clearing the date/time removes the block from calendar views.
- Dated blocks show their scheduled date/time in block metadata.
- The global Calendar screen shows dated blocks from all loaded conversations.
- Calendar views are `Today`, `This week`, and `This month`.
- Today is an agenda list sorted by time.
- This week groups blocks by day, using seven columns on desktop and stacked day sections on mobile.
- This month uses a month grid on desktop and a date-grouped list on mobile.
- Selecting a calendar item opens its source conversation and highlights the source block.

Requirements:

- Calendar date grouping uses the browser's local time.
- This week starts on Sunday.
- Blocks without a scheduled date/time do not appear on the calendar.
- Whole-block copy and move preserve scheduled date/time.
- Selected-text forwards create target blocks from the selected text.
- New English blocks and synthesized conversation index blocks are unscheduled; replacing a source block with English keeps the source block's existing date/time.
- Merged blocks use the earliest scheduled date/time from the selected blocks.

---

### 7.4 Message editing

The user can edit a message after creating it.

Requirements:

- Edit action available from each message.
- Existing message text appears in an inline edit field inside the message block, not in the bottom composer.
- The inline edit field expands to show the whole text while editing instead of requiring scrolling inside the field.
- Typing `[[` or using the visible `[[` insert action while editing opens the same inline conversation-link suggestions as the composer.
- User can save or cancel.
- After saving, update the message text.
- Pasted images while editing should be appended to the block on save.
- Store `updatedAt` timestamp.
- Show a small `edited` label when a message has been changed.
- The bottom composer remains reserved for creating new messages while a block is being edited.

---

### 7.5 Message deletion

The user can delete messages simply and clearly.

Recommended behavior:

- Each message has a delete option.
- Ask for confirmation before deleting.
- Delete should remove the message from the conversation.

For Version 1, use hard delete.

Future option:

- Soft delete using `deletedAt`, allowing undo or recovery.

---

### 7.6 Copy/forward messages between conversations

The user can copy/forward a whole message block, or selected parts of a text block, from one conversation to another.

Version 1 behavior:

- User opens a message action.
- User chooses `Copy to conversation`.
- App shows a transfer dialog that first shows only the source text selection area, then advances to a separate target conversation step.
- The source text step does not show a separate preview; the selected text is visible in the source selection area itself.
- If the user does not select text before choosing a target conversation, the whole block is forwarded.
- The user can tap words to select or deselect them.
- The user can press/hold a word and drag across words with mouse, touch, or pen input to select them.
- Selected words may be adjacent or non-adjacent.
- Adjacent selected words are transferred as one phrase; separate selected parts are transferred as separate paragraphs.
- User selects target conversation.
- Target selection should be single-flight: repeated taps/clicks while the transfer write is pending must not create duplicate target blocks.
- App creates a new message in the target conversation using the whole text or selected text parts.
- After copying, the app opens the target conversation.
- The copied message shows a small `Copied from [conversation name]` metadata line. The conversation name is clickable and opens the source conversation.
- Copied-message origin navigation is conversation-level; whole-block and quote-level navigation are provided by structured references.

The copied/forwarded message should store optional metadata:

- Original conversation ID
- Original conversation title snapshot
- Original message ID
- Copied/forwarded date/time

Simple display:

- Show the copied/forwarded text as a normal message.
- Small label: `Copied`; when the source title is known, show `Copied from [conversation name]`.

### 7.6.1 Move messages between conversations

The app supports moving a whole message block from one conversation to another.

Intended behavior:

- User chooses `Move to conversation` from a message action.
- App goes straight to target conversation selection; there is no source text selection step for moving.
- Whole-block moves create the target message and delete the original message from the source conversation in the same Firestore batch.
- Target selection should be single-flight: repeated taps/clicks while the move write is pending must not create duplicate target blocks.
- After moving, the user stays in the current conversation and sees a non-blocking option to open the target conversation.
- The moved message stores source metadata for transfer history. User-visible cross-conversation navigation is provided by structured conversation links and quote citations.
- The moved message displays a small `Moved` label.


---

### 7.7 Reorder text blocks

The user can manually reorder text blocks inside a conversation.

Recommended Version 1 behavior:

- Each message has simple move up/down reorder controls.
- Touch-friendly move up/down controls should remain available.
- On desktop, the user can use a visible drag handle to drag a text block to an insertion position between blocks.
- On mobile/touch devices, the user can use the same drag handle to move a text block to an insertion position without blocking normal message-list scrolling from the block body.
- While dragging, the app should show clear feedback: the dragged block follows the pointer as a preview, and an insertion marker highlights the exact space where the block will land.
- The message list should treat gaps, padding, and near-miss pointer positions as valid drop zones by resolving them to the nearest insertion position.
- When a drag reaches the top or bottom edge of the visible message list, the list should auto-scroll so off-screen drop targets can be reached without ending the drag.
- Drag-and-drop is an enhancement; explicit move controls should still exist for predictable accessibility and fallback behavior.
- Reordering changes the display order of messages in that conversation only.
- Reordering does not change `createdAt`; creation time remains historical metadata.
- Reordering syncs across signed-in devices.
- Offline reordering should be queued locally and synced when online again.

Recommended data approach:

- Store a numeric `sortOrder` field on each message.
- Display messages by `sortOrder` ascending, then `createdAt` ascending as a fallback.
- When creating a message, assign a `sortOrder` greater than the current last message.
- When forwarding a message into a conversation, append it to the end with a new `sortOrder`.
- For existing messages without `sortOrder`, preserve chronological display order until a reorder action persists explicit values.
- For the first version, move up/down updates the ordered message list with a Firestore batch.

Future option:

- Add stable fractional ordering or virtualized long-list behavior if conversations become long.

---

### 7.8 Merge text blocks

The user can select multiple text blocks in one conversation and merge them into a single unified block.

Version 1 behavior:

- The user enters block-selection mode by double-clicking a block on desktop or double-tapping a block on touch devices.
- After the first block is selected, clicking or tapping additional blocks toggles them selected or unselected.
- A merge control is disabled until at least two messages are selected.
- Merging creates one new message containing the selected messages in their current display order.
- The merged text keeps the original block boundaries with blank lines between blocks.
- The merged block keeps image attachments from the selected blocks in display order.
- The original selected messages are deleted after the new unified block is created.
- The new merged message appears at the first selected message's display position.
- Merging affects only messages in the current conversation.
- Merged messages are stored as normal messages, not as forwarded or moved messages.

Requirements:

- Merge should be a single Firestore batch so the app does not leave duplicate/orphaned originals after a partial write.
- Empty selected block text should not create empty content in the merged result.
- Image-only selected blocks may still contribute attachments to a merged block.
- After a successful merge, selected-message UI state should clear.
- Merge failures should show a clear error without clearing the selection.

---

### 7.9 Message search

The user can search messages.

Version 1 search should be simple.

Requirements:

- Search input at top of conversations or global search screen.
- Search across message text.
- Show matching messages.
- Each result should show:
  - Matching message text
  - Conversation name
  - Created date/time
- Clicking a result opens the conversation.

Simple implementation options:

1. Search locally in currently loaded messages.
2. Query Firestore for basic text fields.
3. Maintain a simple lowercase `searchText` field for each message.

Recommended for Version 1:

> Use a simple client-side search across the user’s cached/loaded messages first.

For a small personal app, this is much simpler than full-text search infrastructure.


---

## 8. Screens

### 8.1 Sign-in screen

Shown when the user is not signed in.

Content:

- App name
- Short description
- `Continue with Google` button

Example text:

```text
Free Writing
Private conversations for your own notes and text blocks.

[Continue with Google]
```

---

### 8.2 Conversation list screen

Shows all conversations.

Content:

- Header with app name
- Calendar action
- More menu with export all conversations and sign-out actions
- Search button or search input
- New conversation button
- List of conversations

Each conversation row should show:

- Conversation title
- Last updated time
- Drag handle when more than one conversation exists

Phone layout:

- Full-screen conversation list
- Tap conversation to open it

Tablet/desktop layout:

- Optional two-column layout
- Conversation list on left
- Active conversation on right
- Drag-handle conversation reordering should be available from the list with the same preview, insertion marker, gap handling, and edge autoscroll feedback used for block dragging.

---

### 8.3 Conversation screen

Shows messages in one conversation.

Content:

- Conversation title
- Back button on mobile
- Information-only mode toggle in the conversation header
- List/Kanban view controls in the conversation header on wider screens, and in the header More menu on narrow screens
- Secondary header actions such as export and conversation-index synthesis in a More menu
- Kanban column management controls near the active Kanban view rather than competing with the main conversation title
- Message list
- Message input fixed at the bottom of the visible conversation pane
- Image preview strip in the composer when images are selected or pasted
- Message actions: edit, delete, copy/forward
- Message action: copy block content to the clipboard
- Message action: download text block content as a Markdown file
- Message action: move to another conversation
- Long message text preview with an icon-only expand/collapse control
- Message tag chips plus an inline add/remove editor with suggestions
- Compact button-like per-block Kanban column selector beside the tag chips when Kanban columns exist
- Message action: convert to English
- Header More action: synthesize a clickable conversation index
- Header More action: export the active conversation as JSON plus Markdown
- Transfer dialog for copying/forwarding whole blocks or selected text parts with tap and drag word selection, plus direct target selection for whole-block moves
- Reorder controls for moving text blocks, plus drag-handle reordering between blocks on desktop and touch/pointer devices
- Normal list block reorder controls and Delete live in block More so common block actions remain compact.
- Selection controls and a merge action for combining multiple selected blocks
- English conversion picker modal with scrollable segment options
- Date/time metadata and edit controls when a block is scheduled or being edited
- Information-only mode that hides most controls while preserving block information and navigation, with a per-block option to temporarily show normal controls for only one block

Scrolling behavior:

- Long conversations should scroll only the message list, not the entire conversation screen.
- The conversation header, selected-message merge toolbar, and message composer should remain visible while the user scrolls through messages.
- Opening a conversation should position the latest visible block at the bottom of the message list.
- Sending or appending a new visible block should scroll that new block to the bottom of the message list.

---

### 8.4 Search screen or search mode

Allows the user to search messages.

Content:

- Search input
- Matching messages
- Conversation name for each result
- Tap result to open message/conversation

---

### 8.5 Calendar screen

Shows dated blocks across all loaded conversations.

Content:

- Back button on mobile
- Calendar title and current date range
- View switcher for `Today`, `This week`, and `This month`
- Dated block items with scheduled time, conversation title, and block preview

Layout:

- Today uses a time-sorted agenda list.
- This week uses seven day columns on desktop and stacked day sections on mobile.
- This month uses a month grid on desktop and a date-grouped list on mobile.
- Clicking a calendar item opens the source conversation and highlights the source block.

---

## 14. Functional requirements

### Authentication

- User can sign in with Google/Gmail.
- User can sign out.
- User stays signed in when returning to the app, where supported.

### Conversations

- User can create a conversation.
- User can rename a conversation.
- User can open a conversation.
- User can delete a conversation.

### Messages

- User can create a message.
- User can create an image-only message.
- User can enable information-only view, read full block information without most controls, and temporarily show normal controls for one block at a time.
- User can switch the active conversation between List and Kanban views.
- User can add, rename, move, and delete custom Kanban columns.
- User can assign a block to a Kanban column from the block's top tag row, where no selected column is shown with `∅`, an assigned column shows its name, and the selector does not show a separate dropdown arrow.
- User can add image attachments by file selection, paste, or touch paste action where supported.
- User can open draft English conversion from the composer with `Ctrl+Enter` / `Cmd+Enter`.
- User can send the current draft directly from the composer with `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`.
- User can save an inline edit with `Ctrl+Enter` / `Cmd+Enter`.
- User can edit a message.
- User can paste images while editing a message and save them onto that block.
- User can copy text-only, text/image, and image-only blocks to the system clipboard where browser support allows.
- User can download a text-bearing block as a Markdown `.md` file.
- User can export the active conversation or all conversations as JSON plus Markdown from inside the app.
- User can add, remove, and reuse tags/flags on message blocks.
- User can filter loaded blocks by tags globally and within the active conversation.
- User can add, edit, clear, and view a scheduled date/time on a block.
- User can open a global calendar and browse dated blocks for today, this week, or this month.
- User can click a calendar item to open and highlight the source block.
- User can delete a message.
- User can copy/forward a whole message or selected text parts to another conversation.
- User can move a whole message to another conversation.
- User can add a conversation or quote reference to a message.
- User can connect a saved block to another loaded saved block and expand backlinks from connected source blocks.
- User can create an inline conversation link by typing `[[` or using the visible `[[` insert action, filtering conversation suggestions, selecting one, and saving or sending the completed link.
- User can open an inline conversation link from a saved message when its title uniquely matches a conversation.
- User can reorder conversations in the conversation list with a drag handle and see the same order after refresh.
- User stays on the conversation list after releasing a reordered conversation.
- Conversations that receive newly created blocks move to the top of the conversation list.
- User can reorder messages inside a conversation with move controls or drag-handle drop on desktop and touch/pointer devices.
- User can open a conversation or send a new block and land with the latest visible block aligned to the bottom of the message list.
- User can merge multiple selected messages inside a conversation.
- User can convert all or part of a message to English and either create a new result block or replace the whole block/selected part.
- User can convert draft composer text to English and send the selected English result directly with any current composer image attachments and references.
- User can synthesize a conversation index block from all active conversation blocks in one contextual AI request.
- User can click each synthesized index entry to jump to its corresponding source block.
- User can search messages.

### Multi-device

- User can access the same account from iPhone, desktop, and tablet.
- Content syncs between devices when online.

### Offline

- App shell works offline after first load.
- Cached conversations and messages can be read offline.
- New offline changes sync later when online.

---

## 15. Non-functional requirements

### Simplicity

Keep the first version straightforward and avoid unnecessary advanced features.

### Performance

Must work well on iPhone 8.

Guidelines:

- Avoid heavy UI libraries.
- Paginate or limit messages if needed.
- Keep search simple.

### Reliability

The app should not lose messages when offline.

### Responsiveness

The app should adapt to phone, tablet, and desktop screens.

### Privacy

Data should be scoped to the signed-in user.

---

## 17. Acceptance criteria

Version 1 is complete when:

- I can open the app on iPhone 8, desktop, and tablet.
- I can sign in with Google/Gmail.
- I can create conversations.
- I can write messages inside conversations.
- I can enter information-only view, focus on block text/images/tags/metadata/references without the composer or normal block action bars, and still use inline/reference/index navigation.
- I can show normal controls for one block while in information-only view, confirm no edit form opens automatically, open normal controls on another block and see the previous block return to view mode, then close the active block back to view mode.
- I can switch a conversation between List and Kanban views and see the selected view persist after reload.
- I can add, rename, move, and delete custom Kanban columns without default columns being created automatically.
- I can assign a block to a Kanban column from the top tag row; unassigned blocks show `∅`, assigned blocks show the selected column name, the control opens by tapping its button area without a visible dropdown arrow, and deleting a column makes its blocks unassigned rather than deleting them.
- On a phone-sized viewport, I can use Kanban one active column at a time with compact previous/next and picker controls.
- I can add a small image to a new block by file selection or paste.
- I can paste an image while editing an existing block and save it onto that block.
- Clicking a saved image preview does nothing.
- I can refresh the page and still see my messages.
- I can open the same account on another device and see the same messages.
- I can edit a message.
- I can copy a text-only block and paste its text elsewhere.
- I can copy a block with images and paste text plus attached images into a rich paste target where supported by the browser and target app.
- I can copy an image-only block and paste the image into a compatible target where supported.
- I can download a text-bearing block as a Markdown `.md` file whose contents match the block text.
- I can export the active conversation and all conversations from inside the app, receiving JSON that preserves full records and Markdown that is readable without inline base64 image payloads.
- I can delete a message.
- I can tag or flag a block, reuse an existing tag from suggestions while typing, remove the tag, and filter loaded blocks by tag.
- I can add, edit, clear, and view a date/time on a block.
- I can open the global calendar, browse dated blocks by today, this week, or this month, and open a source block from a calendar item.
- I can add a conversation or quote reference to a message and open it when the source is loaded.
- I can connect a saved block to another loaded saved block, including itself, and use backlinks to navigate back to connected source blocks.
- I can type `[[` or use the visible `[[` insert action in the composer, choose a conversation suggestion by click or keyboard, send the block, and see the saved inline link render without bracket markers while still opening the target conversation.
- I can type `[[` or use the visible `[[` insert action while editing an existing block, choose a conversation suggestion, save the edit, and keep the bottom composer reserved for new messages.
- I can open draft English conversion with `Ctrl+Enter` / `Cmd+Enter`.
- I can send the current draft directly with `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`.
- I can search messages.
- I can copy/forward a whole message or selected text parts from one conversation to another, see the copied block's source conversation in its metadata, and click the source conversation name to navigate there.
- I can move a whole message from one conversation to another, remain in the current conversation afterward, and optionally open the target conversation from the move notice.
- I can reorder conversations, see the same preview/insertion-marker feedback as block dragging, stay on the conversation list after release, and see the same order after refresh.
- I can add or transfer a new block into a conversation and see that receiving conversation move to the top of the list.
- I can reorder text blocks with move controls or a drag handle on desktop and touch/pointer devices and see the same order after refresh.
- I can open a conversation or send a new block and see the latest visible block positioned at the bottom of the scrollable message list.
- I can select multiple text blocks, merge them into one block, and confirm the originals are removed.
- I can convert a text block to English, select variants, and create the English result below the original.
- I can replace a source text block with selected English text.
- I can convert draft composer text to English and send the selected English result directly with any current composer image attachments and references.
- I can synthesize a conversation index, see it appear as the bottom block, and click each entry to jump to the referenced source block.
- I can synthesize another index later and have previous index blocks included as part of the conversation context.
- I can open the app offline after it was previously loaded.
- I can read cached content offline.
- I can create or edit messages offline and have them sync when back online.
- I can reorder cached messages offline and have the order sync when back online.
- I can merge cached selected messages offline and have the merged result sync when back online.

---
