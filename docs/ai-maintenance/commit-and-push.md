# Commit, Push, And Deploy Context Checkpoint

Use after documentation refreshes, AI maintainability refactors, or meaningful feature/fix work.

## Checkpoint rules

- Prefer the one-command ship workflow so the repository and hosted app advance together.
- Review both tracked and untracked files before committing.
- Treat documentation moves as first-class changes: include the new file, the deleted old file, and all reference updates together.
- If documentation changed, check local Markdown links before committing.
- Do not include local secrets, `.env` files, generated caches, or unrelated temporary files.
- If unrelated user changes are present, preserve them and only include them when they clearly belong to the requested checkpoint.
- Use `npm run ship -- "Context-rich commit message"` or `bash scripts/commit-push-deploy.sh "Context-rich commit message"` for normal checkpoint publishing. Either command runs tests, builds, commits, pushes, and deploys Firebase Hosting. It also deploys Firestore rules or the Cloudflare Worker when matching files changed.
- The ship script and the underlying `scripts/commit-push-deploy.sh` script are intentionally context-checkpoint tools, not only deploy wrappers. Their message argument should include enough useful context for another AI or developer to understand the application changes, architectural implications, documentation updates, and verification performed.

## Prompt

```text
Please review the current git changes, then create a commit, push it, and deploy the hosted app using docs/ai-maintenance/commit-and-push.md as the operating guide.

Primary objective:
Create a useful development checkpoint for future AI-assisted work. The commit message should clearly explain the meaningful application changes, refactors, and documentation/context updates so another AI or developer can understand why this checkpoint matters.

Please:
1. Inspect `git status` and review the diff before committing.
2. Do not revert or discard any existing user changes.
3. Include all relevant application and documentation changes that belong to this checkpoint, including renamed, deleted, and newly added docs.
4. Exclude unrelated local files, secrets, generated caches, and temporary artifacts.
5. If documentation changed, verify local Markdown links before committing.
6. Run reasonable verification first if appropriate and available.
7. Write a concise but informative commit message focused on what changed and why it matters for continued development.
8. Prefer this shape:

   Subject:
   `Update app structure and AI development context`

   Body:
   - Summarize meaningful user-facing or architectural changes.
   - Summarize refactors that make future development easier.
   - Summarize documentation updates that preserve project context.
   - Mention verification performed.

9. Commit, push, and deploy with a context-rich message, for example:
   `npm run ship -- "Update English conversion context

   - Summarize meaningful user-facing or architectural changes.
   - Summarize documentation updates that preserve project context.
   - Verification: npm test and npm run build."`
10. Report the commit hash, branch, live URL, high-level files changed, deployment status, and whether verification passed.
```
