# My Messages

A private, Firebase-backed messaging-style PWA for saving and organizing your own text conversations across devices.

## Setup

1. Create a Firebase project.
2. Enable **Authentication > Google**.
3. Create a Firestore database.
4. Copy `.env.example` to `.env` and fill in your Firebase web app config.
5. Install dependencies and run the app:

```bash
npm install
npm run dev
```

## Firebase rules

Deploy `firebase.rules` so each signed-in user can only access their own path:

```bash
firebase deploy --only firestore:rules
```

## Scripts

- `npm run dev` starts the local Vite server.
- `npm run build` type-checks and builds the PWA.
- `npm run preview` serves the production build locally.
