// Board REST API. Access control replaces the old Firebase database.rules:
// membership is a row in board_members, and every route checks it. The board's
// free-form content (games, schedule, reads, …) lives in boards.content JSONB;
// only board identity/membership are relational.

import { randomUUID } from "node:crypto";

import express from "express";

import { pool, query } from "./db.js";
import { requireAuth } from "./auth.js";

export const boardsRouter = express.Router();
boardsRouter.use(requireAuth);

// The caller's role on a board ('owner' | 'editor' | 'member'), or null if not
// a member. Non-membership is reported as 404 so board ids aren't enumerable.
async function roleOf(boardId, userId) {
  const { rows } = await query(
    "select role from board_members where board_id = $1 and user_id = $2",
    [boardId, userId]
  );
  return rows[0]?.role ?? null;
}

const canManage = (role) => role === "owner" || role === "editor";

// Read-modify-write of a board's content JSONB inside a transaction, locking the
// row (FOR UPDATE) so concurrent mutations (e.g. two people voting at once)
// serialize instead of clobbering each other. `mutate(content)` edits in place.
async function mutateContent(boardId, mutate) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query("select content from boards where id = $1 for update", [boardId]);
    if (!rows.length) {
      await client.query("rollback");
      return null;
    }
    const content = rows[0].content ?? {};
    mutate(content);
    await client.query("update boards set content = $1, updated_at = now() where id = $2", [content, boardId]);
    await client.query("commit");
    return content;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/boards — summaries of the boards the caller belongs to.
boardsRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `select b.id, b.name, b.emoji, b.accent, b.icon_url as "iconUrl",
              b.updated_at as "updatedAt", m.role,
              (select count(*)::int from board_members bm where bm.board_id = b.id) as "memberCount"
         from boards b
         join board_members m on m.board_id = b.id and m.user_id = $1
        order by b.updated_at desc`,
      [req.user.id]
    );
    res.json({ boards: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/boards — create a board; the caller becomes its owner.
boardsRouter.post("/", async (req, res, next) => {
  const name = String(req.body?.name ?? "").trim();
  const emoji = String(req.body?.emoji ?? "🎮").slice(0, 8);
  if (!name) return res.status(400).json({ error: "A board name is required." });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `insert into boards (name, emoji, content) values ($1, $2, '{}'::jsonb)
       returning id, name, emoji, accent, icon_url as "iconUrl", updated_at as "updatedAt"`,
      [name, emoji]
    );
    const board = rows[0];
    await client.query(
      "insert into board_members (board_id, user_id, role) values ($1, $2, 'owner')",
      [board.id, req.user.id]
    );
    await client.query("commit");
    res.status(201).json({ board: { ...board, role: "owner", memberCount: 1 } });
  } catch (err) {
    await client.query("rollback");
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/boards/:id — the full board, including its members (caller must be one).
boardsRouter.get("/:id", async (req, res, next) => {
  try {
    const role = await roleOf(req.params.id, req.user.id);
    if (!role) return res.status(404).json({ error: "Board not found." });

    const { rows } = await query(
      `select id, name, emoji, accent, icon_url as "iconUrl",
              content, created_at as "createdAt", updated_at as "updatedAt"
         from boards where id = $1`,
      [req.params.id]
    );
    const board = rows[0];
    if (!board) return res.status(404).json({ error: "Board not found." });

    const { rows: members } = await query(
      `select u.id as "userId", u.name, u.email, u.photo_url as "photoUrl", m.role
         from board_members m join users u on u.id = m.user_id
        where m.board_id = $1
        order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, u.name`,
      [req.params.id]
    );

    res.json({ board: { ...board, role, members } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/boards/:id — meta (name/emoji/accent) needs owner/editor; content
// (games, schedule, …) any member may update.
boardsRouter.patch("/:id", async (req, res, next) => {
  try {
    const role = await roleOf(req.params.id, req.user.id);
    if (!role) return res.status(404).json({ error: "Board not found." });

    const { name, emoji, accent, content } = req.body ?? {};
    const changesMeta = name !== undefined || emoji !== undefined || accent !== undefined;
    if (changesMeta && !canManage(role)) {
      return res.status(403).json({ error: "Only the owner or editors can change board settings." });
    }

    const sets = [];
    const values = [];
    let i = 1;
    if (name !== undefined) sets.push(`name = $${i++}`), values.push(String(name).trim());
    if (emoji !== undefined) sets.push(`emoji = $${i++}`), values.push(String(emoji).slice(0, 8));
    if (accent !== undefined) sets.push(`accent = $${i++}`), values.push(accent);
    if (content !== undefined) sets.push(`content = $${i++}`), values.push(content);
    if (!sets.length) return res.status(400).json({ error: "Nothing to update." });

    sets.push("updated_at = now()");
    values.push(req.params.id);
    await query(`update boards set ${sets.join(", ")} where id = $${i}`, values);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/boards/:id — owner only (cascades to members/messages).
boardsRouter.delete("/:id", async (req, res, next) => {
  try {
    const role = await roleOf(req.params.id, req.user.id);
    if (!role) return res.status(404).json({ error: "Board not found." });
    if (role !== "owner") return res.status(403).json({ error: "Only the owner can delete a board." });
    await query("delete from boards where id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Games (stored in boards.content.games) ----

// POST /api/boards/:id/games — propose a game (any member).
boardsRouter.post("/:id/games", async (req, res, next) => {
  try {
    const role = await roleOf(req.params.id, req.user.id);
    if (!role) return res.status(404).json({ error: "Board not found." });

    const b = req.body ?? {};
    const title = String(b.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "A game title is required." });

    const game = {
      id: randomUUID(),
      title: title.slice(0, 120),
      kind: b.kind === "party" ? "party" : "video",
      genre: String(b.genre ?? "").slice(0, 80),
      players: String(b.players ?? "").slice(0, 40),
      platforms: Array.isArray(b.platforms) ? b.platforms.slice(0, 8).map(String) : [],
      coverImageUrl: b.coverImageUrl ? String(b.coverImageUrl) : null,
      catalogId: b.catalogId ?? null,
      approvals: {},
      addedBy: req.user.id,
      createdAt: new Date().toISOString()
    };

    const content = await mutateContent(req.params.id, (c) => {
      c.games = Array.isArray(c.games) ? c.games : [];
      c.games.push(game);
    });
    if (!content) return res.status(404).json({ error: "Board not found." });
    res.status(201).json({ game, games: content.games });
  } catch (err) {
    next(err);
  }
});

// POST /api/boards/:id/games/:gameId/vote — set the caller's vote (any member).
boardsRouter.post("/:id/games/:gameId/vote", async (req, res, next) => {
  try {
    const role = await roleOf(req.params.id, req.user.id);
    if (!role) return res.status(404).json({ error: "Board not found." });

    const vote = req.body?.vote ?? null;
    if (!["up", "down", null].includes(vote)) {
      return res.status(400).json({ error: "vote must be 'up', 'down', or null." });
    }

    let found = false;
    const content = await mutateContent(req.params.id, (c) => {
      const game = (c.games ?? []).find((g) => g.id === req.params.gameId);
      if (!game) return;
      found = true;
      game.approvals = game.approvals ?? {};
      if (vote === null) delete game.approvals[req.user.id];
      else game.approvals[req.user.id] = vote;
    });
    if (!content) return res.status(404).json({ error: "Board not found." });
    if (!found) return res.status(404).json({ error: "Game not found." });
    res.json({ games: content.games });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/boards/:id/games/:gameId — remove (adder, or owner/editor).
boardsRouter.delete("/:id/games/:gameId", async (req, res, next) => {
  try {
    const role = await roleOf(req.params.id, req.user.id);
    if (!role) return res.status(404).json({ error: "Board not found." });

    let found = false;
    let denied = false;
    const content = await mutateContent(req.params.id, (c) => {
      const games = c.games ?? [];
      const game = games.find((g) => g.id === req.params.gameId);
      if (!game) return;
      found = true;
      if (game.addedBy !== req.user.id && !canManage(role)) {
        denied = true;
        return;
      }
      c.games = games.filter((g) => g.id !== req.params.gameId);
    });
    if (!content) return res.status(404).json({ error: "Board not found." });
    if (!found) return res.status(404).json({ error: "Game not found." });
    if (denied) return res.status(403).json({ error: "You can only remove games you added." });
    res.json({ games: content.games });
  } catch (err) {
    next(err);
  }
});
