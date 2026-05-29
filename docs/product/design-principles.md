# Design Principles

Last updated: 2026-05-29

Related docs: [product brief](v1-product-brief.md), [features and screens](v1-features-and-screens.md), [current implementation](../implementation/current-implementation.md).

## Purpose

Free Writing is a private writing notebook that borrows the familiarity of messaging apps without becoming a social chat product. The interface should help one user capture, read, connect, reorganize, and export their own blocks across phone, tablet, and desktop.

## Principles

### 1. Content Before Controls

The saved writing block is the center of the app. Controls should help the user act on content, then get out of the way.

- Keep conversation titles and block content readable before showing dense toolbars.
- Keep sidebar search, tags, and creation controls compact so the conversation list starts quickly.
- Keep saved-block common actions compact, and move ordering/destructive controls out of the default visual path.
- Avoid making every available action look equally important.
- Prefer icon-only buttons for familiar actions, with clear labels through `title` and `aria-label`.
- Use text labels when an action is uncommon, destructive, or ambiguous.

### 2. One Primary Action Group

Each surface should have one visible primary action group at a time.

- Conversation headers prioritize navigation, the active title, view switching on wider screens, information-only mode, and a More menu.
- App headers prioritize top-level navigation such as Calendar, then move rare account/export actions into More.
- Composer controls prioritize fast capture: keep writing, scheduling, attaching, inline-link insertion, and Send closest to the draft.
- Selection, editing, Kanban management, and composer actions should live close to the state they control instead of competing with the main header.

### 3. Progressive Disclosure

Advanced or lower-frequency actions should remain available without crowding the default view.

- Use overflow menus for export, synthesis, account, and other rare actions.
- Use mode-specific controls only when the mode is active or when the user has made an explicit selection.
- Keep destructive and high-impact actions visible enough to find, but deliberate enough to avoid accidental taps.

### 4. Mobile First, iPhone 8 Honest

The app must fit a narrow phone without treating mobile as a squeezed desktop.

- On phones, preserve a single-column conversation or list view.
- Keep touch targets about 36-44px minimum depending on density and context.
- Do not allow header controls to push titles off screen or force horizontal scrolling.
- Prefer back/title/primary toggle/More in tight headers.

### 5. Stable Reading Regions

The user should always know what part of the app scrolls.

- Long conversations scroll only the message list.
- Conversation headers, active selection toolbars, and the composer remain reachable.
- Avoid layout shifts when temporary controls appear, especially around touch selection and composer transitions.

### 6. Restrained Dark Theme

The dark theme should feel quiet, private, and durable.

- Use the dark app shell as the visual base.
- Reserve bright teal for active state, primary actions, and precise feedback.
- Keep cards and panels simple, with small radii and clear borders.
- Avoid decorative backgrounds that compete with writing.

## Future Agent Guidance

When extending the UI, start by deciding the action hierarchy:

1. What must remain visible for the current task?
2. What belongs near the selected object or active mode?
3. What can move into More without hiding core navigation?
4. What documentation needs to change so future agents preserve the same direction?

Do not add new visible header buttons by default. Add them only when they are high-frequency, mode-defining, or necessary for navigation on the current surface.

For composer changes, preserve the capture hierarchy before adding tools: the textarea and Send remain primary, common draft actions stay closest to them, and secondary tools should move into More or another compact group without pushing Send away from the draft.
