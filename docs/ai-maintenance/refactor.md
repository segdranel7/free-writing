# AI Maintainability Refactor

Use after significant changes, or when files have grown harder for an AI assistant to reason about. The goal is not cosmetic churn. The goal is to make the codebase more legible, modular, predictable, and safe to continue editing.

## Prompt

```text
Please run an AI maintainability refactor using docs/ai-maintenance/refactor.md as the operating guide.

Primary objective:
Organize the code so that a future AI assistant or human developer can understand and extend it with less context, fewer hidden dependencies, and lower risk. Preserve behavior unless a bug is found and clearly fixed.

Please:
1. Review the current codebase structure, especially files touched by recent work.
2. Identify refactors that improve AI comprehension: smaller responsibilities, clearer names, explicit data flow, reusable helpers, reduced duplication, and simpler component/service boundaries.
3. Keep changes scoped and behavior-preserving unless you call out a real bug.
4. Prefer existing project patterns over introducing new abstractions.
5. Move logic toward the right layer:
   - UI rendering and local UI state in components.
   - Cross-component orchestration in `src/App.tsx` only when needed.
   - Firebase reads/writes in `src/services/`.
   - Subscription lifecycle in `src/hooks/`.
   - Small pure helpers in `src/utils/`.
6. Avoid broad rewrites, style-only churn, or abstractions that do not reduce real complexity.
7. Keep TypeScript types explicit where they clarify contracts between files.
8. Add or update focused verification where reasonable for the changed area.
9. Run available build/tests when practical.
10. Summarize the refactor, the reason it helps future AI development, and any remaining risks.
```
