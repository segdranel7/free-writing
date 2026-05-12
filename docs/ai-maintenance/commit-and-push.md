# Commit And Push Context Checkpoint

Use after documentation refreshes, AI maintainability refactors, or meaningful feature/fix work.

## Prompt

```text
Please review the current git changes, then create a commit and push it using docs/ai-maintenance/commit-and-push.md as the operating guide.

Primary objective:
Create a useful development checkpoint for future AI-assisted work. The commit message should clearly explain the meaningful application changes, refactors, and documentation/context updates so another AI or developer can understand why this checkpoint matters.

Please:
1. Inspect `git status` and review the diff before committing.
2. Do not revert or discard any existing user changes.
3. Include all relevant application and documentation changes that belong to this checkpoint.
4. Run reasonable verification first if appropriate and available.
5. Write a concise but informative commit message focused on what changed and why it matters for continued development.
6. Prefer this shape:

   Subject:
   `Update app structure and AI development context`

   Body:
   - Summarize meaningful user-facing or architectural changes.
   - Summarize refactors that make future development easier.
   - Summarize documentation updates that preserve project context.
   - Mention verification performed.

7. Commit the changes.
8. Push the commit to the current remote branch.
9. Report the commit hash, branch, high-level files changed, and whether verification passed.
```
