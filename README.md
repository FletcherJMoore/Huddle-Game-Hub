# Huddle Game Hub

A shared planning hub for game nights. Create boards with your crew, vote games
into rotation, schedule sessions on a calendar, chat in real time, and pull in
the games you own on Steam.

## Features

- **Boards** — shared spaces with members and roles (owner / editor / member).
- **Game catalog & voting** — propose games; the crew votes them into rotation.
- **Scheduling** — a Google-Calendar-style day/week/month view with RSVPs.
- **Realtime chat** — per-board chat over Socket.IO, with reactions and unsend.
- **Steam library** — link your Steam account (OpenID) to bring your owned games
  into the catalog and add them to a board.
- **Runtime theming** — light/dark, accent color, and background, per user.

## Tech stack

- **Frontend** — Vite + React 18 single-page app (`src/`).
- **Backend** — Node + Express (`server/`) with PostgreSQL, Socket.IO for
  realtime, and Passport for auth (Google OAuth + Steam OpenID).
- **Hosting** — Railway. One backend service serves the built SPA and the API on
  the same origin, backed by a Railway Postgres plugin.

## Quick preview (no backend)

To explore the UI without a database or API, run the app against in-memory mock
data (a fake signed-in user and sample boards/games/chat):

```sh
npm install
npm run dev:mock
```

Open the printed local URL. Nothing else is required.

## Local development (full stack)

**Prerequisites:** Node ≥ 20 and a PostgreSQL database (local, or a Railway
Postgres public URL).

1. Copy the environment template and fill it in (see [Environment](#environment)):

   ```sh
   cp .env.example .env
   ```

   At minimum set `DATABASE_URL`, `AUTH_SECRET`, and `APP_URL`. Add the Google
   OAuth credentials for real sign-in.

2. Install dependencies and apply the database schema:

   ```sh
   npm install
   npm run migrate
   ```

3. Run the API and the SPA in two terminals:

   ```sh
   npm run server   # Express API on :3000 (watches for changes)
   npm run dev      # Vite SPA on :5173, proxying /api and /socket.io to :3000
   ```

Open http://localhost:5173.

> Without Google credentials the auth routes return `503` and you'll stay on the
> login screen. Use `npm run dev:mock` to preview the signed-in UI, or add the
> credentials below.

## Environment

Backend variables (set in `.env` locally, or on the Railway backend service):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string. On Railway, set to `${{Postgres.DATABASE_URL}}`. |
| `AUTH_SECRET` | ✅ | Secret for signing the session cookie. |
| `APP_URL` | ✅ | The app's public origin (e.g. `https://…up.railway.app`). Used for OAuth callback and Steam realm URLs. Defaults to `http://localhost:5173`. |
| `GOOGLE_CLIENT_ID` | ✅¹ | Google OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | ✅¹ | Google OAuth client secret. |
| `STEAM_API_KEY` | optional | Enables the Steam library (owned games). Get one at steamcommunity.com/dev/apikey. |
| `BGG_API_TOKEN` | optional | Bearer token for the BoardGameGeek / VideoGameGeek catalog search. |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | optional | IGDB video-game cover art (via a Twitch dev app). Falls back to VGG covers if unset. |
| `PGSSLMODE` | optional | Set to `disable` to turn off TLS for a local Postgres. |
| `PORT` | — | Set automatically by Railway; defaults to `3000`. |

¹ Auth is optional to boot: if the Google/`AUTH_SECRET` vars are missing the app
still serves, but `/api/auth/*` returns `503` until they're configured.

The `VITE_FIREBASE_*` entries in `.env.example` are leftovers from the previous
Firebase stack and are no longer used (see [Migration note](#migration-note)).

## Database & migrations

Schema lives in `server/migrations/*.sql` and is applied by a small forward-only
runner (`server/migrate.js`) that records applied files in `schema_migrations`.

- Locally: `npm run migrate`.
- On deploy: migrations run automatically — `npm start` runs the migrator, then
  the server.

## Deploying on Railway

1. Add a **PostgreSQL** plugin to the project.
2. On the **backend service**, set the environment variables above — most
   importantly `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `AUTH_SECRET`,
   `APP_URL` (the service's public URL), and the Google OAuth credentials.
3. Railway builds with `npm run build` (Vite → `dist/`) and starts with
   `npm start` (migrate, then serve). The Node server serves `dist/` and the API
   from one origin.

**Google OAuth:** in the Google Cloud console, add
`${APP_URL}/api/auth/google/callback` as an authorized redirect URI.
**Steam** (optional) returns to `${APP_URL}/api/auth/steam/return`; the user's
Steam profile game details must be public for their library to load.

## Project structure

```
src/                 React SPA
  app/               shell (rail, top bar, screens, chat, calendar, theming)
  lib/               API client + domain helpers
  auth/              auth context + login
server/              Express API + Socket.IO realtime
  index.js           entry — mounts routers, serves the SPA
  auth.js            Google OAuth + Steam OpenID (Passport)
  boards.js          boards, games, sessions, chat
  steam.js           Steam library (owned games, cover resolution)
  catalog.js         BGG/VGG catalog search
  realtime.js        Socket.IO rooms + broadcasts
  db.js              Postgres pool
  migrations/        forward-only SQL migrations
```

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server (expects the API running). |
| `npm run dev:mock` | Vite with in-memory mock data — no backend needed. |
| `npm run server` | Node API with file watching. |
| `npm run migrate` | Apply pending database migrations. |
| `npm run build` | Build the SPA to `dist/`. |
| `npm start` | Migrate, then serve (production). |

## Migration note

This project moved off Firebase to Railway + Postgres. Some Firebase artifacts
still live in the repo (`functions/`, `firebase.json`, `.firebaserc`,
`src/config/firebase-config.js`, the `VITE_FIREBASE_*` env vars) but are no
longer used by the running app; they'll be removed as the migration wraps up.
