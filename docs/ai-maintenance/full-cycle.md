# Full AI Maintenance Cycle

Use when you want refactoring, documentation refresh, verification, commit/push, and hosted deployment handled as one checkpoint.

## Prompt

```text
Please use docs/ai-maintenance/full-cycle.md to run the full AI maintenance cycle:
1. Refactor the code for AI maintainability where useful.
2. Refresh the base development docs.
3. Verify the project with the available build/tests.
4. Commit, push, and deploy the resulting checkpoint with `npm run ship -- "Context-rich commit message"` or `bash scripts/commit-push-deploy.sh "Context-rich commit message"`; include what changed, why it matters, and verification performed.

Keep the primary objective in mind: preserve a codebase and documentation set that a future AI assistant can quickly understand, safely modify, and continue developing.
```
