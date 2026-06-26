// Huddle Cloud Functions.
//
// claimMyInvites: a callable the web app runs after sign-in. It joins the caller
// to any boards they were invited to by their (verified) email address. The
// membership write goes through the Admin SDK, which bypasses the database
// rules, so the rules can stay strict (no client-side self-join).

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// Keep this identical to src/utils/invite.js so client keys match server reads.
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

exports.claimMyInvites = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in to claim invites.");

  const email = auth.token.email;
  if (!email || !auth.token.email_verified) {
    throw new HttpsError("failed-precondition", "Verify your email before joining boards.");
  }

  const key = emailKey(email);
  const snapshot = await admin.database().ref(`emailInvites/${key}`).get();
  const invites = snapshot.val() || {};

  const joined = [];
  for (const [boardId, info] of Object.entries(invites)) {
    const members = await admin.database().ref(`boards/${boardId}/members`).get();
    if (!members.exists()) {
      // Board was deleted before the invite was claimed — drop the dangling pointer.
      await admin.database().ref(`emailInvites/${key}/${boardId}`).remove();
      continue;
    }

    await grantMembership(
      boardId,
      auth.uid,
      { name: auth.token.name || email.split("@")[0], email },
      info.role || "editor"
    );
    await clearInvite(boardId, key);
    joined.push({ boardId, boardName: info.boardName });
  }

  return { joined };
});
