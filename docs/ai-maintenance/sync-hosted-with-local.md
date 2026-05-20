# Sync Hosted App With Local

Use when the hosted Firebase app should be updated to match the current local workspace.

This workflow deploys the local source of truth to the live hosted app. It should verify the app first, deploy any changed server-side translation worker code, build the browser app with the production translation endpoint, deploy Firebase Hosting, and deploy Firestore rules when they changed.

## Operating rules

- Treat the local workspace as the version to publish.
- Inspect `git status` before deploying so changed files and generated files are understood.
- Do not commit or expose secrets.
- Do not commit `.env`, `.env.production.local`, `.dev.vars`, `firebase-debug.log`, `.firebase/`, `dist/`, or `node_modules/`.
- Confirm Firebase is using project `free-writing-e29a1` before deploy.
- Use the Cloudflare Worker URL for hosted English conversion:

```env
VITE_TRANSLATION_API_URL=https://free-writing-translation.free-writing-danielsegatto.workers.dev
```

- Deploy Firestore rules only when `firebase.rules` changed or when rules need to be refreshed.
- If authentication is missing, complete the CLI login flow instead of working around it.

## Prompt

```text
Please use docs/ai-maintenance/sync-hosted-with-local.md to make the hosted version match this local workspace.

Primary objective:
Deploy the current local app to the hosted Firebase production site, including any needed Cloudflare Worker and Firestore rule updates, without committing secrets or unrelated generated files.

Please:
1. Inspect `git status --short --branch` and summarize what local source changes are about to be deployed.
2. Confirm the Firebase target is `free-writing-e29a1` with `npx firebase-tools use`.
3. Make sure dependencies are installed if needed with `npm install`.
4. Run verification:
   - `npm run test`
   - `npm run build`
5. Make sure production builds use the hosted translation endpoint by setting ignored `.env.production.local` to:
   `VITE_TRANSLATION_API_URL=https://free-writing-translation.free-writing-danielsegatto.workers.dev`
6. If `workers/translation/index.ts` changed, Worker secrets changed, or hosted English conversion is stale, deploy the Worker:
   - Ensure secrets exist when needed:
     `npx wrangler secret put GROQ_API_KEY`
     `npx wrangler secret put FIREBASE_API_KEY`
   - Deploy:
     `npx wrangler deploy`
   - If Wrangler asks for an entrypoint, use:
     `npx wrangler deploy workers/translation/index.ts --name free-writing-translation`
7. Re-run `npm run build` after confirming `.env.production.local`, because Firebase Hosting publishes `dist/`.
8. Deploy Firebase:
   - If `firebase.rules` changed, run:
     `npx firebase-tools deploy --only hosting,firestore:rules`
   - Otherwise run:
     `npx firebase-tools deploy --only hosting`
9. Verify the live app:
   - Open or fetch `https://free-writing-e29a1.web.app`.
   - Confirm the deployed page loads.
   - Confirm Google sign-in is available.
   - If possible, sign in and test one small create/edit/delete flow plus English conversion.
10. Inspect `git status --short` again and report any generated or ignored local artifacts left behind.
11. Report:
   - Verification commands and whether they passed.
   - Worker deployment status, if performed.
   - Firebase deployment command used.
   - Live URL.
   - Any manual follow-up needed, especially auth-domain, secret, or CLI-login issues.

Do not commit unless I explicitly ask for a commit.
```

## Quick Manual Command Sequence

Use this when you want to commit, push, and deploy together:

```bash
npm run ship -- "Context-rich commit message"
```

The message should make the checkpoint useful to future AI-assisted development: summarize what changed, why it matters, and what verification was performed.

Use this when you are running only the deployment yourself and already have Firebase and Cloudflare CLI auth set up:

```bash
npx firebase-tools use
npm install
npm run test
printf '%s\n' 'VITE_TRANSLATION_API_URL=https://free-writing-translation.free-writing-danielsegatto.workers.dev' > .env.production.local
npm run build
npx firebase-tools deploy --only hosting
```

Or use the checkpoint script directly:

```bash
bash scripts/commit-push-deploy.sh "Context-rich commit message"
```

If Firestore rules changed:

```bash
npx firebase-tools deploy --only hosting,firestore:rules
```

If the translation Worker changed:

```bash
npx wrangler deploy
```

If Wrangler asks for an entrypoint:

```bash
npx wrangler deploy workers/translation/index.ts --name free-writing-translation
```
