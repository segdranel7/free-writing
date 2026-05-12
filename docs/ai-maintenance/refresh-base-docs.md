# Refresh Base Development Docs

Use when meaningful application behavior, architecture, data flow, setup, deployment, constraints, or risks have changed.

## Prompt

```text
Please refresh the base development documentation using docs/ai-maintenance/refresh-base-docs.md as the operating guide.

Primary objective:
Keep the docs accurate, concise, and practical as long-term context for future AI-assisted development. A future AI should be able to quickly understand the current application architecture, user flows, data model, implementation patterns, known constraints, and recent meaningful changes.

Please:
1. Review the current codebase and existing base docs before editing.
2. Update documentation to reflect the actual current state of the app, not planned or outdated behavior.
3. Prioritize information that helps a future AI continue development safely and efficiently.
4. Include important architecture decisions, component responsibilities, state/data flow, storage/offline behavior, authentication assumptions, build/run/test commands, and known risks or TODOs.
5. Remove or correct stale information.
6. Keep the writing clear and dense with useful context rather than verbose.
7. Avoid rewriting unrelated documentation unless it improves future development continuity.
8. Summarize what changed and mention any docs that may still need follow-up.
```
