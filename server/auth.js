// Google-only authentication. Replaces Firebase Auth with the OAuth 2.0
// Authorization Code flow (via Passport) and a Postgres-backed session cookie:
//
//   GET  /api/auth/google           → redirect to Google's consent screen
//   GET  /api/auth/google/callback  → Google returns here; upsert user, set cookie
//   GET  /api/auth/me               → current user, or 401
//   POST /api/auth/logout           → destroy the session
//
// Auth is *optional to boot*: if its env vars aren't configured, the server
// still serves /api/health and the SPA, logs exactly what's missing, and only
// /api/auth/* is disabled (503). A config slip should never black out the app.
// So the status ladder for /api/auth/me is:
//   404 → this build isn't deployed   503 → deployed, auth not configured
//   401 → configured, not signed in    200 → signed in

import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as SteamStrategy } from "passport-steam";

import { pool, query } from "./db.js";

const APP_URL = process.env.APP_URL || "http://localhost:5173";
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, STEAM_API_KEY } = process.env;

const missingEnv = [
  ["GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID],
  ["GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET],
  ["AUTH_SECRET", AUTH_SECRET]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const authConfigured = missingEnv.length === 0;

// Steam linking is optional and rides on top of auth being configured.
const steamConfigured = authConfigured && Boolean(STEAM_API_KEY);

if (!authConfigured) {
  console.warn(
    `[auth] DISABLED — missing env on this service: ${missingEnv.join(", ")}. ` +
      "The app will run, but /api/auth/* returns 503 until these are set."
  );
}

// Insert the Google account on first sign-in, or refresh its profile on return.
// google_sub (Google's stable account id) is the identity key.
async function upsertGoogleUser(profile) {
  const email = profile.emails?.[0]?.value?.toLowerCase() ?? null;
  const name = profile.displayName || (email ? email.split("@")[0] : "User");
  const photoUrl = profile.photos?.[0]?.value ?? null;

  const { rows } = await query(
    `insert into users (google_sub, email, name, photo_url)
       values ($1, $2, $3, $4)
     on conflict (google_sub) do update
       set email = excluded.email,
           name = excluded.name,
           photo_url = excluded.photo_url
     returning id, email, name, photo_url`,
    [profile.id, email, name, photoUrl]
  );
  return rows[0];
}

if (authConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${APP_URL}/api/auth/google/callback`
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          done(null, await upsertGoogleUser(profile));
        } catch (err) {
          done(err);
        }
      }
    )
  );

  // Link Steam to the *currently signed-in* user rather than logging in as the
  // Steam identity: passReqToCallback gives us req.user (the Google session),
  // and we stamp their steam_id onto that row.
  if (steamConfigured) {
    passport.use(
      new SteamStrategy(
        {
          returnURL: `${APP_URL}/api/auth/steam/return`,
          realm: APP_URL,
          apiKey: STEAM_API_KEY,
          passReqToCallback: true
        },
        async (req, _identifier, profile, done) => {
          try {
            if (!req.user) return done(null, false); // must be signed in to link
            const persona = profile.displayName || null;
            await query("update users set steam_id = $1, steam_persona = $2 where id = $3", [
              profile.id,
              persona,
              req.user.id
            ]);
            done(null, { ...req.user, steam_id: profile.id, steam_persona: persona });
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  // Only the user id rides in the session; the row is re-read on each request.
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const { rows } = await query(
        `select id, email, name, photo_url, steam_id as "steamId", steam_persona as "steamPersona"
           from users where id = $1`,
        [id]
      );
      done(null, rows[0] ?? false);
    } catch (err) {
      done(err);
    }
  });
}

// One session middleware instance, shared by Express and Socket.IO so a socket
// handshake resolves to the same logged-in user.
export const sessionMiddleware = authConfigured
  ? session({
      store: new (connectPgSimple(session))({ pool, createTableIfMissing: true }),
      secret: AUTH_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax", // sent on the top-level redirect back from Google
        secure: APP_URL.startsWith("https://"), // Railway serves over TLS
        maxAge: 24 * 60 * 60 * 1000
      }
    })
  : (_req, _res, next) => next();

// Session + Passport middleware, mounted before any route that needs req.user.
export function authMiddleware() {
  if (!authConfigured) return [(_req, _res, next) => next()];
  return [sessionMiddleware, passport.initialize(), passport.session()];
}

export const authRouter = express.Router();

if (authConfigured) {
  authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  authRouter.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/?authError=1" }),
    (_req, res) => res.redirect("/")
  );

  if (steamConfigured) {
    // Link Steam: bounce to Steam (only when already signed in), then stamp the
    // returned SteamID onto the current user and return to the app.
    authRouter.get("/steam", (req, res, next) => {
      if (!req.user) return res.redirect("/");
      passport.authenticate("steam")(req, res, next);
    });
    authRouter.get(
      "/steam/return",
      passport.authenticate("steam", { failureRedirect: "/?steamError=1" }),
      (_req, res) => res.redirect("/?steam=linked")
    );
  }

  authRouter.get("/me", (req, res) => {
    if (!req.user) return res.status(401).json({ user: null });
    res.json({ user: req.user });
  });

  authRouter.post("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ ok: true });
      });
    });
  });
} else {
  authRouter.use((_req, res) =>
    res.status(503).json({ error: "Authentication is not configured on the server." })
  );
}

// Guard for routes that require a signed-in user (used from Phase 3 onward).
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in required." });
  next();
}
