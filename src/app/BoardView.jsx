import { useEffect, useState } from "react";

import { useAuth } from "../auth/AuthProvider.jsx";
import {
  getBoard,
  voteGame,
  rsvpSession,
  createSession,
  updateBoard,
  deleteBoard,
  MOCK
} from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { myVote } from "../lib/games.js";
import { myRsvp } from "../lib/schedule.js";
import { BoardOverview, BoardCatalog, BoardPeople, BoardAdmin } from "./BoardScreens.jsx";
import Calendar from "./Calendar.jsx";
import ProposeGameModal from "./ProposeGameModal.jsx";

export default function BoardView({ boardId, boardTab, onExit, onMetaChange, onSetTab }) {
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [games, setGames] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [error, setError] = useState("");
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    let alive = true;
    setBoard(null);
    setError("");
    getBoard(boardId)
      .then((b) => {
        if (!alive) return;
        setBoard(b);
        setGames(b.content?.games ?? []);
        setSchedule(b.content?.schedule ?? []);
      })
      .catch((err) => alive && setError(err.message || "Couldn't load this board."));

    if (MOCK) return () => {
      alive = false;
    };

    // Join the board's socket room so votes/RSVPs from other members land live.
    const socket = getSocket();
    socket.emit("join", boardId);
    const onContent = (c) => {
      setGames(c.games ?? []);
      setSchedule(c.schedule ?? []);
    };
    socket.on("board:content", onContent);

    return () => {
      alive = false;
      socket.emit("leave", boardId);
      socket.off("board:content", onContent);
    };
  }, [boardId]);

  const isAdmin = board?.role === "owner" || board?.role === "editor";

  async function handleVote(gameId, vote) {
    const game = games.find((g) => g.id === gameId);
    const next = myVote(game, user.id) === vote ? null : vote;
    setGames((gs) =>
      gs.map((g) => {
        if (g.id !== gameId) return g;
        const approvals = { ...(g.approvals ?? {}) };
        if (next === null) delete approvals[user.id];
        else approvals[user.id] = next;
        return { ...g, approvals };
      })
    );
    try {
      setGames(await voteGame(boardId, gameId, next));
    } catch {
      /* keep optimistic */
    }
  }

  async function handleRsvp(sessionId, rsvp) {
    const s = schedule.find((x) => x.id === sessionId);
    const next = myRsvp(s, user.id) === rsvp ? null : rsvp;
    setSchedule((prev) =>
      prev.map((x) => {
        if (x.id !== sessionId) return x;
        const rsvps = { ...(x.rsvps ?? {}) };
        if (next === null) delete rsvps[user.id];
        else rsvps[user.id] = next;
        return { ...x, rsvps };
      })
    );
    try {
      setSchedule(await rsvpSession(boardId, sessionId, next));
    } catch {
      /* keep optimistic */
    }
  }

  async function handleCreate(session) {
    try {
      setSchedule(await createSession(boardId, session));
    } catch {
      /* ignore */
    }
  }

  function handleMeta(patch) {
    setBoard((b) => ({ ...b, ...patch }));
    onMetaChange?.(boardId, patch);
    updateBoard(boardId, patch).catch(() => {});
  }

  async function handleDelete() {
    if (!window.confirm("Delete this board for everyone? This can't be undone.")) return;
    try {
      await deleteBoard(boardId);
    } catch {
      /* ignore */
    }
    onExit();
  }

  function handleRemoveMember(userId) {
    setBoard((b) => ({ ...b, members: b.members.filter((m) => m.userId !== userId) }));
  }

  if (error) {
    return (
      <div className="board-error">
        <button className="ghost-btn" onClick={onExit}>
          ← Overview
        </button>
        <p className="form-error">{error}</p>
      </div>
    );
  }
  if (!board) return <p className="muted">Loading…</p>;

  return (
    <>
      {boardTab === "overview" && (
        <BoardOverview board={board} games={games} schedule={schedule} user={user} onRsvp={handleRsvp} onSetTab={onSetTab} />
      )}
      {boardTab === "catalog" && (
        <BoardCatalog
          board={board}
          games={games}
          user={user}
          onVote={handleVote}
          onProposeGame={() => setProposing(true)}
          onSetTab={onSetTab}
        />
      )}
      {boardTab === "people" && <BoardPeople board={board} isAdmin={isAdmin} onRemoveMember={handleRemoveMember} />}
      {boardTab === "calendar" && (
        <Calendar board={board} games={games} schedule={schedule} user={user} onCreate={handleCreate} onRsvp={handleRsvp} />
      )}
      {boardTab === "admin" && (
        <BoardAdmin
          board={board}
          onRename={(name) => handleMeta({ name })}
          onSetEmoji={(emoji) => handleMeta({ emoji })}
          onDelete={handleDelete}
          onRemoveMember={handleRemoveMember}
        />
      )}

      {proposing && (
        <ProposeGameModal
          boardId={boardId}
          onClose={() => setProposing(false)}
          onAdded={(updated) => {
            setGames(updated);
            setProposing(false);
          }}
        />
      )}
    </>
  );
}
