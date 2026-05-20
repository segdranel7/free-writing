# Free Writing Documentation

Last updated: 2026-05-20

This is the entry point for the Free Writing PWA documentation. The detailed base document has been split into smaller files so product intent, architecture, implementation status, and reusable prompts can be updated independently.

## App summary

Free Writing is a private, Google-login messaging-style PWA for one user. It supports conversations, conversation list drag reordering, saved text/image blocks, image paste and selection, search, copying text/image blocks to the browser clipboard, editing, deletion, forwarding or moving whole blocks or selected parts of a block, manual up/down and drag-handle block reordering on desktop and touch/pointer devices, multi-block merging, per-block English conversion, multi-device access, and offline support for the app shell plus cached Firestore data.

Target devices:

- iPhone 8
- Desktop computer
- Tablet

Recommended Version 1 stack:

- React PWA
- Firebase Authentication with Google provider
- Firestore cloud data with offline persistence
- Cloudflare Worker for server-side AI translation proxying
- PWA manifest and service worker
- Firebase Hosting

## Split documentation

Read these files by purpose:

- [Product brief](product/v1-product-brief.md): app idea, target devices, Version 1 goal, exclusions, core user story, and product summary.
- [Features and screens](product/v1-features-and-screens.md): feature behavior, screen requirements, functional and non-functional requirements, and acceptance criteria.
- [Firebase PWA architecture](architecture/firebase-pwa-architecture.md): architecture decision, data model, Firestore structure, offline behavior, sync behavior, security, privacy, and stack options.
- [Current implementation](implementation/current-implementation.md): current React/Firebase app state, code organization, hosting decision, known follow-ups, and implementation-specific notes.
- [First build prompt](prompts/first-build-prompt.md): reusable AI-builder prompt and suggested development order.
- [QA verification checklist](qa-v1-verification.md): automated checks and manual real-browser QA scenarios.

## Product docs

Use the product docs when changing what the app should do or checking whether a behavior belongs in Version 1.

[Product brief](product/v1-product-brief.md) contains:

- App idea
- Target devices
- Version 1 goal
- Version 1 exclusions
- Core user story
- Version 1 product summary

[Features and screens](product/v1-features-and-screens.md) contains:

- Google/Gmail login behavior
- Conversation behavior, including manual conversation ordering
- Message creation, image attachments, editing, deletion, forwarding or moving whole/partial blocks, reordering, merging, and English conversion
- Message search
- Sign-in, conversation list, conversation, and search screens
- Functional requirements
- Non-functional requirements
- Acceptance criteria

## Architecture docs

Use [Firebase PWA architecture](architecture/firebase-pwa-architecture.md) when changing storage, authentication, security, offline support, sync behavior, or server-side AI/API integration.

It contains:

- Key architecture decision
- Data model
- Firestore database structure
- Offline app shell and data behavior
- Sync behavior
- Security and privacy requirements
- Suggested technology options

## Implementation docs

Use [Current implementation](implementation/current-implementation.md) when changing code or refreshing AI development context.

It contains:

- Current implementation snapshot
- Current React, Vite, TypeScript, Firebase, and PWA stack
- Frontend code organization
- Firebase Hosting decision and deployment flow
- Known development follow-ups
- Implementation-specific notes that were previously embedded in feature and architecture sections

## Prompt docs

Use [First build prompt](prompts/first-build-prompt.md) when asking an AI coding tool to rebuild or reason from the original Version 1 brief.

It contains:

- The reusable first-build prompt
- The suggested development order

## QA docs

Use [QA verification checklist](qa-v1-verification.md) before treating Firebase, Cloudflare Worker translation, offline behavior, or browser-specific behavior as stable.

## Version 1 product summary

The first useful version should be:

> A private Google-login PWA where I can create and organize conversations, save text/image blocks, copy text and attached images where the browser clipboard allows, convert text to English, quickly convert draft text with keyboard shortcuts, edit/delete/search/reorder/merge blocks, forward or move whole blocks or selected parts between conversations, and access everything across iPhone, desktop, and tablet, with offline support for cached data.

## Maintenance guidance

- Keep this file as the canonical documentation starting point.
- Update the product docs when desired behavior changes.
- Update the architecture doc when storage, auth, sync, offline behavior, or security decisions change.
- Update the implementation doc when the actual codebase changes.
- Update the prompt doc when the reusable AI-builder prompt or development order changes.
