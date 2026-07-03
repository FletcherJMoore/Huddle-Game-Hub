# Huddle Game Hub

A simple shared planning board for scheduling times, collecting activity ideas, tracking people, and chatting around a plan.

## Local Preview

```sh
npm install
npm run dev
```

Then open the local URL printed in the terminal.

## Environment

Create a `.env` file from `.env.example` and paste in the Firebase web app values:

```sh
cp .env.example .env
```

The app expects:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Firebase

This app is prepared for Firebase Hosting, Authentication, and Realtime Database.

1. Re-authenticate Firebase CLI if needed:

```sh
firebase login --reauth
```

2. Pin the local app to your Firebase project:

```sh
firebase use --add
```

3. Copy your Firebase web app config into `.env`.

4. Make sure these providers are enabled in Firebase Authentication:

- Email/password
- Google

5. Build and deploy hosting plus database rules:

```sh
npm run build
firebase deploy
```

## Invites (Cloud Functions)

Boards are invite-only by email — no actual email is sent. An admin enters a
teammate's email in the Crew panel, and that person is added to the board
automatically the next time they sign in to Huddle Game Hub with that address. A small
`claimMyInvites` Cloud Function does the join server-side so the database rules
can stay strict (no client-side self-join).

One-time setup:

1. **Upgrade the Firebase project to the Blaze (pay-as-you-go) plan.** Cloud
   Functions require it. The free tier covers light use.

2. **Install function dependencies and deploy:**

   ```sh
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```

3. **Deploy the updated database rules** (they block client-side self-join and
   gate invites to board admins):

   ```sh
   firebase deploy --only database
   ```
