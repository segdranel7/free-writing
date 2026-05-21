# Repeatable Security Check

Use when the user says `security check`, `run security audit`, or asks to verify that their writing and attachments cannot be accessed by anyone outside their own account.

## Privacy boundary

The default privacy guarantee is:

- Firebase/Firestore cloud storage is allowed.
- Explicit AI features are allowed to send selected text or conversation block text through the configured server proxy to Groq.
- No other signed-in app user, unauthenticated visitor, or public storage URL should be able to read or modify another user's writing or attachments.
- Local browser persistence is acceptable, but cached data can remain on a signed-in device/browser profile until site data is cleared.

If the user asks for `no AI egress` or `local-only`, stop and clarify the broader product change before auditing against those stronger guarantees.

## Operating rules

- Do not deploy, commit, push, or intentionally mutate repo-tracked files during a security check.
- Start with findings, ordered by severity, and include concrete file references.
- Separate actual exposure risks from defense-in-depth improvements and accepted privacy tradeoffs.
- Treat legacy server code as security-relevant unless it is confirmed not to be deployed.
- If fixes are requested, make them in a separate implementation pass after the audit findings are clear.

## Audit checklist

Inspect these areas every time:

- Firestore rules: `firebase.rules` must scope all reads and writes to `request.auth.uid == userId`.
- Data paths: conversations, messages, attachments, references, tags, search text, and generated index entries must stay under `users/{userId}`.
- Attachments: image attachments should remain compressed inline Firestore data URLs, not public Firebase Storage or other public object URLs.
- AI egress: English conversion and conversation-index synthesis may send user text only through authenticated server-side endpoints with Firebase ID tokens.
- Auth and CORS: browser requests must require a current Firebase user; server proxies must reject missing/invalid tokens and unapproved origins where applicable.
- Secrets: `.env`, `.env.*.local`, `.dev.vars`, Groq keys, Firebase API secrets, and Worker secrets must not be tracked or exposed through `VITE_...` variables.
- Rendering and clipboard: user text, attachment names, HTML clipboard output, image URLs, and AI output must not create XSS or script injection paths.
- Deployment config: Firebase Hosting rewrites, Cloudflare Worker config, and Firebase rules deployment docs must not introduce public data access.
- Dependencies: review `npm audit` output and any package/config changes.

## Commands

Run the automated local check:

```bash
npm run security:check
```

That command runs the unit test suite, production build, and dependency audit. It does not deploy.

When useful, add targeted read-only inspection commands such as:

```bash
git status --short
git diff -- firebase.rules src workers functions vite.config.ts firebase.json wrangler.jsonc package.json package-lock.json
git ls-files .env .env.local .env.production.local .dev.vars
rg -n "(dangerouslySetInnerHTML|innerHTML|fetch\\(|Authorization|Bearer|localStorage|sessionStorage|indexedDB|firebase|firestore|storage|Groq|GROQ|cors|Access-Control|clipboard)" src workers functions vite.config.ts firebase.rules firebase.json wrangler.jsonc
```

For Firestore rule changes, add or run Firebase rules tests before deployment.

## Report format

Use this shape:

```text
Findings
- Critical/High/Medium/Low: file:line - issue, impact, and concrete fix.

Accepted privacy tradeoffs
- Cloud Firestore stores user content.
- Explicit AI features send selected text or conversation block text to Groq through the server proxy.
- Browser offline persistence can retain cached user data on the device.

Verification
- Commands run and results.
- Any checks that could not be run.
```
