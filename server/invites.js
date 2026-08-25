// Token-based invite endpoints (mounted at /api/invites): a public preview for
// the accept landing page, and the authenticated accept itself. Board-scoped
// invite management (create/list/resend/revoke) lives in boards.js and reuses
// the helpers exported here.

import express from "express";

import { pool, query } from "./db.js";
import { requireAuth } from "./auth.js";

const APP_URL = process.env.APP_URL || "http://localhost:5173";

// The link that lands the invitee on the accept page in the SPA.
export const acceptUrl = (token) => `${APP_URL}/invite/${token}`;

// Derived status for an invite row (expiry is schema-ready but unused for now).
export function inviteStatus(row) {
  if (row.acceptedAt) return "accepted";
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return "expired";
  return "pending";
}

export const invitesRouter = express.Router();

// GET /api/invites/:token — public preview so the landing page can render
// before sign-in. Never echoes the token or anything sensitive.
invitesRouter.get("/:token", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select i.email, i.role, i.accepted_at as "acceptedAt", i.expires_at as "expiresAt",
              b.name as "crewName", b.emoji as "crewEmoji", u.name as "inviterName"
         from invites i
         join boards b on b.id = i.board_id
         left join users u on u.id = i.invited_by
        where i.token = $1`,
      [req.params.token]
    );
    const row = rows[0];
    if (!row) return res.json({ status: "not_found" });
    res.json({
      status: inviteStatus(row),
      email: row.email,
      role: row.role,
      crew: { name: row.crewName, emoji: row.crewEmoji },
      inviterName: row.inviterName
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/invites/:token/accept — join the crew. Must be signed in, and the
// signed-in Google email must match the invited email.
invitesRouter.post("/:token/accept", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `select id, board_id as "boardId", email, role,
              accepted_at as "acceptedAt", expires_at as "expiresAt"
         from invites where token = $1 for update`,
      [req.params.token]
    );
    const invite = rows[0];
    if (!invite) {
      await client.query("rollback");
      return res.status(404).json({ error: "This invite is no longer valid." });
    }
    if (invite.acceptedAt) {
      await client.query("rollback");
      return res.status(409).json({ error: "This invite was already accepted." });
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await client.query("rollback");
      return res.status(410).json({ error: "This invite has expired." });
    }
    if (invite.email.toLowerCase() !== (req.user.email || "").toLowerCase()) {
      await client.query("rollback");
      return res.status(403).json({
        error: `This invite was sent to ${invite.email}. You're signed in as ${req.user.email}.`
      });
    }

    await client.query(
      "insert into board_members (board_id, user_id, role) values ($1, $2, $3) on conflict do nothing",
      [invite.boardId, req.user.id, invite.role]
    );
    await client.query("update invites set accepted_at = now(), accepted_by = $1 where id = $2", [
      req.user.id,
      invite.id
    ]);
    await client.query("commit");
    res.json({ boardId: invite.boardId });
  } catch (err) {
    await client.query("rollback");
    next(err);
  } finally {
    client.release();
  }
});
