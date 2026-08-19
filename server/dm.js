// Direct messages — 1:1 chat between two users, mirroring the board-chat layer
// but keyed on a user pair instead of a board. Delivery rides the same socket:
// each user has a personal room (user:<id>) that all their devices join.

import express from "express";

import { requireAuth } from "./auth.js";
import { query } from "./db.js";
import { emitToUser } from "./realtime.js";

export const dmRouter = express.Router();
dmRouter.use(requireAuth);

// You may DM someone you share a board with, or anyone you already have a
// thread with (so a conversation survives leaving a shared board).
async function canDm(meId, otherId) {
  if (meId === otherId) return false;
  const { rows } = await query(
    `select 1
       from board_members m1
       join board_members m2 on m2.board_id = m1.board_id and m2.user_id = $2
      where m1.user_id = $1
      union all
      select 1 from direct_messages
       where (sender_id = $1 and recipient_id = $2) or (sender_id = $2 and recipient_id = $1)
      limit 1`,
    [meId, otherId]
  );
  return rows.length > 0;
}

function shapeMessage(row, self) {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.createdAt,
    author: { id: row.senderId, name: row.senderName ?? self.name, photoUrl: row.senderPhotoUrl ?? self.photo_url }
  };
}

// GET /api/dm — the caller's conversation list: one row per partner with the
// most recent message.
dmRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select distinct on (partner)
              partner as "userId", u.name, u.photo_url as "photoUrl",
              d.text, d.created_at as "createdAt", d.sender_id as "lastSenderId"
         from (
           select case when sender_id = $1 then recipient_id else sender_id end as partner,
                  text, created_at, sender_id
             from direct_messages
            where sender_id = $1 or recipient_id = $1
         ) d
         join users u on u.id = d.partner
        order by partner, d.created_at desc`,
      [req.user.id]
    );

    const conversations = rows
      .map((r) => ({
        userId: r.userId,
        name: r.name,
        photoUrl: r.photoUrl,
        lastMessage: r.text,
        lastAt: r.createdAt,
        lastFromMe: r.lastSenderId === req.user.id
      }))
      .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

// GET /api/dm/contacts — people the caller can start a DM with (board co-members).
dmRouter.get("/contacts", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select distinct u.id as "userId", u.name, u.photo_url as "photoUrl"
         from board_members m1
         join board_members m2 on m2.board_id = m1.board_id and m2.user_id <> m1.user_id
         join users u on u.id = m2.user_id
        where m1.user_id = $1
        order by u.name`,
      [req.user.id]
    );
    res.json({ contacts: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dm/:userId — recent history of the thread with :userId.
dmRouter.get("/:userId", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select d.id, d.sender_id as "senderId", d.text, d.created_at as "createdAt",
              u.name as "senderName", u.photo_url as "senderPhotoUrl"
         from direct_messages d
         left join users u on u.id = d.sender_id
        where (d.sender_id = $1 and d.recipient_id = $2)
           or (d.sender_id = $2 and d.recipient_id = $1)
        order by d.created_at desc
        limit 100`,
      [req.user.id, req.params.userId]
    );
    const messages = rows.map((r) => shapeMessage(r, req.user)).reverse();
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// POST /api/dm/:userId — send a message; delivered live to both users.
dmRouter.post("/:userId", async (req, res, next) => {
  try {
    const recipientId = req.params.userId;
    if (!(await canDm(req.user.id, recipientId))) {
      return res.status(403).json({ error: "You can only message people you share a board with." });
    }

    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "Message can't be empty." });

    const { rows } = await query(
      `insert into direct_messages (sender_id, recipient_id, text) values ($1, $2, $3)
       returning id, created_at as "createdAt"`,
      [req.user.id, recipientId, text.slice(0, 2000)]
    );

    const message = {
      id: rows[0].id,
      text: text.slice(0, 2000),
      createdAt: rows[0].createdAt,
      author: { id: req.user.id, name: req.user.name, photoUrl: req.user.photo_url }
    };

    const payload = { from: req.user.id, to: recipientId, message };
    emitToUser(recipientId, "dm:message", payload);
    emitToUser(req.user.id, "dm:message", payload);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/dm/:userId/:messageId — unsend one of your own messages.
dmRouter.delete("/:userId/:messageId", async (req, res, next) => {
  try {
    const { rows } = await query(
      "delete from direct_messages where id = $1 and sender_id = $2 returning id",
      [req.params.messageId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Message not found." });

    const payload = { from: req.user.id, to: req.params.userId, id: req.params.messageId };
    emitToUser(req.params.userId, "dm:message:delete", payload);
    emitToUser(req.user.id, "dm:message:delete", payload);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
