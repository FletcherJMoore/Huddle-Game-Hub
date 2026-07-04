// Huddle Game Hub Cloud Functions.
//
// getPendingInvites: returns boards the caller has been invited to without
//   joining them. Used to populate the in-app notification bell.
//
// acceptInvite: called when the user explicitly accepts one invite (in-app
//   bell or email link). Grants membership via Admin SDK and clears the invite.
//
// sendInviteEmail: DB trigger — fires when an admin writes a new invite record.
//   Only sends the email; it never grants membership itself, so every invite
//   — new account or existing — is only ever joined via acceptInvite.
//
// searchCatalogGames: proxies a title search to the RAWG games database for
//   the propose-game modal. Keeps the RAWG_API_KEY server-side.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onValueCreated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
const { Resend } = require("resend");

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

    // Membership is never granted here — only ever via the explicit acceptInvite
    // call (email link or the next-sign-in auto-accept in main.js), regardless of
    // whether the invitee already has an account. Just send the email.
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.APP_URL || "https://huddle-b73f3.web.app/";
    const fromEmail = process.env.INVITE_FROM_EMAIL || "noreply@huddlegames.org";

    const inviterName = invite.invitedByName || "Someone";
    const boardName = invite.boardName || "a Huddle Game Hub board";
    const acceptUrl = `${appUrl}?acceptInvite=${boardId}`;

    await resend.emails.send({
      from: `Huddle Game Hub <${fromEmail}>`,
      to: invite.email,
      subject: `${inviterName} invited you to ${boardName} on Huddle Game Hub`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#1a1b2e;color:#e2e4f0;border-radius:12px;">
          <h1 style="font-size:24px;margin:0 0 8px;">You're invited to Huddle Game Hub</h1>
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

// ---------- Games catalog search (RAWG) ----------
// Lets proposing a game search a general games database instead of requiring
// any platform account to be linked. Keeps the API key and RAWG's raw
// response shape server-side — the client only ever sees fields it already
// understands (its own PLATFORMS list, not RAWG's finer-grained platform ids).

const RAWG_PLATFORM_MAP = [
  { match: /playstation 5/i, value: "PS5" },
  { match: /xbox/i, value: "Xbox" },
  { match: /nintendo switch/i, value: "Switch" },
  { match: /^pc$/i, value: "PC" },
  { match: /ios|android/i, value: "Mobile" }
];

function mapRawgPlatforms(rawgPlatforms) {
  const mapped = new Set();
  (rawgPlatforms || []).forEach(({ platform }) => {
    const hit = RAWG_PLATFORM_MAP.find((p) => p.match.test(platform?.name || ""));
    if (hit) mapped.add(hit.value);
  });
  return [...mapped];
}

exports.searchCatalogGames = onCall({ secrets: ["RAWG_API_KEY"] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");

  const query = String(request.data?.query || "").trim();
  if (!query) return { results: [] };

  const params = new URLSearchParams({
    key: process.env.RAWG_API_KEY,
    search: query,
    page_size: "6"
  });

  const resp = await fetch(`https://api.rawg.io/api/games?${params.toString()}`);
  if (!resp.ok) throw new HttpsError("unavailable", "Games catalog search is unavailable right now.");
  const data = await resp.json();

  const results = (data.results || []).map((g) => ({
    id: g.id,
    name: g.name,
    coverImageUrl: g.background_image || null,
    genre: g.genres?.[0]?.name || "",
    platforms: mapRawgPlatforms(g.platforms)
  }));

  return { results };
});
