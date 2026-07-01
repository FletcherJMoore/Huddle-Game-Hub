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

// ---------- Owner-only member management (server-authoritative) ----------

// Throws unless `uid` is the owner of `boardId` (accepts legacy admin/true).
async function requireOwner(uid, boardId) {
  const snap = await admin.database().ref(`boards/${boardId}/members/${uid}`).get();
  const role = snap.val();
  if (role !== "owner" && role !== "admin" && role !== true) {
    throw new HttpsError("permission-denied", "Only the board owner can manage members.");
  }
}

async function requireMember(boardId, targetUid) {
  const snap = await admin.database().ref(`boards/${boardId}/members/${targetUid}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "That person isn't a member of this board.");
}

// Owner sets a member's role to editor or member.
exports.setMemberRole = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { boardId, targetUid, role } = request.data || {};
  if (!boardId || !targetUid || !["editor", "member"].includes(role)) {
    throw new HttpsError("invalid-argument", "boardId, targetUid, and a valid role are required.");
  }
  await requireOwner(request.auth.uid, boardId);
  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "You can't change your own role.");
  }
  await requireMember(boardId, targetUid);
  await admin.database().ref(`boards/${boardId}/members/${targetUid}`).set(role);
  return { ok: true };
});

// Owner hands ownership to another member and becomes an editor.
exports.transferOwnership = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { boardId, targetUid } = request.data || {};
  if (!boardId || !targetUid) throw new HttpsError("invalid-argument", "boardId and targetUid are required.");
  await requireOwner(request.auth.uid, boardId);
  if (targetUid === request.auth.uid) throw new HttpsError("failed-precondition", "You're already the owner.");
  await requireMember(boardId, targetUid);
  await admin.database().ref().update({
    [`boards/${boardId}/members/${request.auth.uid}`]: "editor",
    [`boards/${boardId}/members/${targetUid}`]: "owner"
  });
  return { ok: true };
});

// Owner removes a member and cleans up their profile, reads, and board pointer.
exports.removeMember = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { boardId, targetUid } = request.data || {};
  if (!boardId || !targetUid) throw new HttpsError("invalid-argument", "boardId and targetUid are required.");
  await requireOwner(request.auth.uid, boardId);
  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "Transfer ownership before leaving, or delete the board.");
  }
  await admin.database().ref().update({
    [`boards/${boardId}/members/${targetUid}`]: null,
    [`boards/${boardId}/memberProfiles/${targetUid}`]: null,
    [`boards/${boardId}/reads/${targetUid}`]: null,
    [`userBoards/${targetUid}/${boardId}`]: null
  });
  return { ok: true };
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

// Web push: when a chat message is posted, notify the board's other members on
// any devices they've enrolled (fcmTokens/{uid}/{token}). Data-only payload —
// the service worker renders the notification. Skips system messages.
exports.notifyNewMessage = onValueCreated(
  { ref: "/boards/{boardId}/messages/{messageId}", region: "us-central1" },
  async (event) => {
    const msg = event.data.val();
    if (!msg || !msg.authorUid || !msg.text) return;

    const boardId = event.params.boardId;
    const db = admin.database();
    const boardSnap = await db.ref(`boards/${boardId}`).get();
    const board = boardSnap.val();
    if (!board) return;

    const recipients = Object.keys(board.members || {}).filter((uid) => uid !== msg.authorUid);
    if (!recipients.length) return;

    // Gather every recipient device token (tracking uid so we can prune bad ones).
    const entries = [];
    await Promise.all(
      recipients.map(async (uid) => {
        const snap = await db.ref(`fcmTokens/${uid}`).get();
        Object.keys(snap.val() || {}).forEach((token) => entries.push({ uid, token }));
      })
    );
    if (!entries.length) return;

    const authorName = board.memberProfiles?.[msg.authorUid]?.name || msg.author || "Someone";
    const body = msg.text.length > 120 ? `${msg.text.slice(0, 117)}…` : msg.text;

    const response = await admin.messaging().sendEachForMulticast({
      tokens: entries.map((e) => e.token),
      data: {
        title: `${authorName} · ${board.name || "your huddle"}`,
        body,
        boardId,
        url: process.env.APP_URL || "https://huddle-b73f3.web.app/"
      }
    });

    // Remove tokens FCM reports as dead so they don't accumulate.
    const removals = {};
    response.responses.forEach((res, i) => {
      if (res.success) return;
      const code = res.error?.code || "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument") ||
        code.includes("invalid-registration-token")
      ) {
        removals[`fcmTokens/${entries[i].uid}/${entries[i].token}`] = null;
      }
    });
    if (Object.keys(removals).length) await db.ref().update(removals);
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
