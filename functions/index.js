// Huddle Cloud Functions.
//
// getPendingInvites: returns boards the caller has been invited to without
//   joining them. Used to populate the in-app notification bell.
//
// acceptInvite: called when the user explicitly accepts one invite (in-app
//   bell or email link). Grants membership via Admin SDK and clears the invite.
//
// sendInviteEmail: DB trigger — fires when an admin writes a new invite record
//   and sends an email via Resend so the invitee knows they were invited.

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onValueCreated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const crypto = require("crypto");

admin.initializeApp();

// Keep identical to src/utils/invite.js so client keys match server reads.
function emailKey(email) {
  return String(email)
    .trim()
    .toLowerCase()
    .replace(/[.#$/[\]]/g, (char) => "%" + char.charCodeAt(0).toString(16));
}

async function grantMembership(boardId, uid, profile, role) {
  await admin
    .database()
    .ref()
    .update({
      [`boards/${boardId}/members/${uid}`]: role,
      [`boards/${boardId}/memberProfiles/${uid}`]: profile,
      [`userBoards/${uid}/${boardId}`]: true
    });
}

async function clearInvite(boardId, key) {
  await admin
    .database()
    .ref()
    .update({
      [`invites/${boardId}/${key}`]: null,
      [`emailInvites/${key}/${boardId}`]: null
    });
}

// Returns all boards the caller has a pending invite to (no side effects).
exports.getPendingInvites = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in to view invites.");

  const email = auth.token.email;
  if (!email || !auth.token.email_verified) {
    throw new HttpsError("failed-precondition", "Verify your email to view invites.");
  }

  const key = emailKey(email);
  const snapshot = await admin.database().ref(`emailInvites/${key}`).get();
  const invites = snapshot.val() || {};

  const pending = [];
  for (const [boardId, info] of Object.entries(invites)) {
    const members = await admin.database().ref(`boards/${boardId}/members`).get();
    if (!members.exists()) {
      await admin.database().ref(`emailInvites/${key}/${boardId}`).remove();
      continue;
    }
    pending.push({
      boardId,
      boardName: info.boardName || "a board",
      invitedByName: info.invitedByName || "Someone",
      role: info.role || "editor"
    });
  }

  return { pending };
});

// Grants membership for a single board the caller was invited to.
exports.acceptInvite = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in to accept invites.");

  const email = auth.token.email;
  if (!email || !auth.token.email_verified) {
    throw new HttpsError("failed-precondition", "Verify your email before joining boards.");
  }

  const { boardId } = request.data;
  if (!boardId) throw new HttpsError("invalid-argument", "boardId is required.");

  const key = emailKey(email);
  const inviteSnap = await admin.database().ref(`emailInvites/${key}/${boardId}`).get();
  if (!inviteSnap.exists()) {
    throw new HttpsError("not-found", "Invite not found or already claimed.");
  }

  const info = inviteSnap.val();
  await grantMembership(
    boardId,
    auth.uid,
    { name: auth.token.name || email.split("@")[0], email },
    info.role || "editor"
  );
  await clearInvite(boardId, key);

  return { boardId, boardName: info.boardName || "the board" };
});

// Sends an invite email when a new invite record is created.
exports.sendInviteEmail = onValueCreated(
  {
    ref: "/invites/{boardId}/{emailKey}",
    region: "us-central1",
    secrets: ["RESEND_API_KEY"]
  },
  async (event) => {
    const invite = event.data.val();
    if (!invite || !invite.email) return;

    const boardId = event.params.boardId;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.APP_URL || "https://huddle-b73f3.web.app/";
    const fromEmail = process.env.INVITE_FROM_EMAIL || "noreply@huddlegames.org";

    const inviterName = invite.invitedByName || "Someone";
    const boardName = invite.boardName || "a Huddle board";
    const acceptUrl = `${appUrl}?acceptInvite=${boardId}`;

    await resend.emails.send({
      from: `Huddle <${fromEmail}>`,
      to: invite.email,
      subject: `${inviterName} invited you to ${boardName} on Huddle`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#1a1b2e;color:#e2e4f0;border-radius:12px;">
          <h1 style="font-size:24px;margin:0 0 8px;">You're invited to Huddle</h1>
          <p style="margin:0 0 24px;color:#a0a3b8;">
            <strong>${inviterName}</strong> invited you to join <strong>${boardName}</strong>.
          </p>
          <a href="${acceptUrl}"
             style="display:inline-block;padding:12px 28px;background:#7c6af7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
            Accept Invite
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#6b6e8a;">
            Sign in or create an account with this email address and the board will appear automatically.
          </p>
        </div>
      `
    });
  }
);

// ---------- Steam (Sign in through Steam + owned-games comparison) ----------

const STEAM_OPENID = "https://steamcommunity.com/openid/login";

function steamReturnUrl() {
  const project =
    process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "huddle-b73f3";
  return `https://us-central1-${project}.cloudfunctions.net/steamReturn`;
}

// Authenticated user asks for a Steam login URL. We mint a one-time nonce tied to
// their uid so the (unauthenticated) return handler can identify them.
exports.steamLoginUrl = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.");

  const nonce = crypto.randomUUID();
  await admin.database().ref(`steamNonces/${nonce}`).set({ uid: auth.uid, createdAt: Date.now() });

  const ret = `${steamReturnUrl()}?nonce=${nonce}`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": ret,
    "openid.realm": steamReturnUrl(),
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
  });
  return { url: `${STEAM_OPENID}?${params.toString()}` };
});

// Steam redirects here after the user approves. Verify the assertion, read the
// SteamID, fetch their owned games, and store each member's library under
// boardSteam/{boardId}/{uid} for every board they belong to.
exports.steamReturn = onRequest({ region: "us-central1", secrets: ["STEAM_API_KEY"] }, async (req, res) => {
  const appUrl = process.env.APP_URL || "https://huddle-b73f3.web.app/";
  try {
    const q = req.query;

    // 1. Verify the OpenID assertion by echoing it back with mode=check_authentication.
    const verifyParams = new URLSearchParams();
    Object.keys(q).forEach((k) => {
      if (k.startsWith("openid.")) verifyParams.append(k, q[k]);
    });
    verifyParams.set("openid.mode", "check_authentication");
    const verifyResp = await fetch(STEAM_OPENID, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyParams.toString()
    });
    const verifyText = await verifyResp.text();
    if (!/is_valid\s*:\s*true/.test(verifyText)) {
      res.redirect(`${appUrl}?steam=error`);
      return;
    }

    // 2. Extract the SteamID from the claimed id.
    const claimed = String(q["openid.claimed_id"] || "");
    const steamId = (claimed.match(/\/id\/(\d+)\/?$/) || [])[1];
    if (!steamId) {
      res.redirect(`${appUrl}?steam=error`);
      return;
    }

    // 3. Resolve the nonce -> uid (one-time use).
    const nonce = q.nonce;
    if (!nonce) {
      res.redirect(`${appUrl}?steam=error`);
      return;
    }
    const nonceSnap = await admin.database().ref(`steamNonces/${nonce}`).get();
    const nonceData = nonceSnap.val();
    await admin.database().ref(`steamNonces/${nonce}`).remove();
    if (!nonceData) {
      res.redirect(`${appUrl}?steam=error`);
      return;
    }
    const uid = nonceData.uid;
    const key = process.env.STEAM_API_KEY;

    // 4. Fetch persona + owned games (owned games require a public profile).
    let persona = "";
    try {
      const sum = await (
        await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`)
      ).json();
      persona = sum?.response?.players?.[0]?.personaname || "";
    } catch (e) {
      console.error("Steam summary failed", e.message);
    }

    const games = {};
    try {
      const owned = await (
        await fetch(
          `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`
        )
      ).json();
      (owned?.response?.games || []).forEach((g) => {
        games[g.appid] = g.name || String(g.appid);
      });
    } catch (e) {
      console.error("Steam owned games failed", e.message);
    }

    // 5. Write the library to every board the user belongs to.
    const boardsSnap = await admin.database().ref(`userBoards/${uid}`).get();
    const payload = { steamId, persona, games, updatedAt: Date.now() };
    const updates = { [`steamUsers/${uid}`]: { steamId, persona, updatedAt: Date.now() } };
    Object.keys(boardsSnap.val() || {}).forEach((bid) => {
      updates[`boardSteam/${bid}/${uid}`] = payload;
    });
    await admin.database().ref().update(updates);

    res.redirect(`${appUrl}?steam=linked`);
  } catch (error) {
    console.error("steamReturn error", error);
    res.redirect(`${appUrl}?steam=error`);
  }
});
