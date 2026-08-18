import { useEffect, useState } from "react";

import { myVote } from "../lib/games.js";
import { inRotation, pendingApproval, everyoneOwns, upVotes, threshold } from "../lib/board-domain.js";
import { myRsvp, rsvpCounts, sortSessions, isPast, formatSessionDate, formatTimeRange } from "../lib/schedule.js";
import { roleLabel } from "../lib/social.js";
import { BOARD_EMOJI } from "./theme.jsx";
import { Cover, Avatar, SearchBox, GameTile } from "./ui.jsx";
import { ChevronLeft, ChevronRight, Plus } from "./icons.jsx";

// ---- Rolodex: rotation games as cards hinged at the top ----

function Rolodex({ games, memberCount }) {
  const [idx, setIdx] = useState(0);
  const n = Math.max(1, games.length);

  useEffect(() => {
    if (games.length < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 3400);
    return () => clearInterval(t);
  }, [games.length, n]);

  const cur = idx % n;

  return (
    <div className="rolodex-panel">
      <div className="rolodex-stage">
        {games.map((g, i) => {
          const off = (i - cur + n) % n;
          let cls = "far";
          if (off === 0) cls = "cur";
          else if (off === n - 1) cls = "out";
          else if (off === 1) cls = "next";
          else if (off === 2) cls = "next2";
          const owned = upVotes(g) < threshold(memberCount) && g.approvals && Object.keys(g.approvals).length > 0;
          return (
            <div key={g.id} className={`rolodex-card ${cls}`}>
              <Cover game={g} className="rolodex-cover" />
              <span className="rolodex-text">
                <span className="rolodex-title">{g.title}</span>
                <span className="rolodex-meta">
                  {(g.platforms || []).join(", ")} · {g.players} players
                </span>
                <span className="rolodex-votes">
                  {owned
                    ? `Approved by vote · ${upVotes(g)} of ${memberCount} said yes`
                    : `${g.owners ?? upVotes(g)} of ${memberCount} members own it`}
                </span>
              </span>
            </div>
          );
        })}
        {games.length === 0 && <div className="rolodex-empty muted">No games in rotation yet — vote some up.</div>}
      </div>
      {games.length > 1 && (
        <div className="rolodex-controls">
          <button className="icon-btn" onClick={() => setIdx((i) => (i - 1 + n) % n)} aria-label="Previous">
            <ChevronLeft size={15} />
          </button>
          <div className="rolodex-dots">
            {games.map((g, i) => (
              <span key={g.id} className={`rolodex-dot${i === cur ? " on" : ""}`} />
            ))}
          </div>
          <button className="icon-btn" onClick={() => setIdx((i) => (i + 1) % n)} aria-label="Next">
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function nextUpcoming(schedule) {
  return sortSessions(schedule).find((s) => !isPast(s)) || null;
}

// ---- Board → Overview ----

export function BoardOverview({ board, games, schedule, user, onRsvp, onSetTab }) {
  const memberCount = board.members.length;
  const rotation = inRotation(games, memberCount);
  const pending = pendingApproval(games, memberCount);
  const next = nextUpcoming(schedule);
  const nextGame = next && games.find((g) => g.id === next.gameId);
  const nextMine = next ? myRsvp(next, user.id) : null;
  const going = next ? rsvpCounts(next).in : 0;

  const unRsvpd = schedule.filter((s) => !isPast(s) && !myRsvp(s, user.id)).length;
  const needs = [
    { id: "votes", count: pending.length, title: "Games waiting on your vote", sub: "Approve or pass in Game Catalog", tab: "catalog" },
    { id: "rsvp", count: unRsvpd, title: "Sessions without your RSVP", sub: "Let the crew know if you're in", tab: "calendar" }
  ].filter((n) => n.count > 0);

  const activity = [
    { who: "Morgan Lee", text: "Morgan voted yes on Among Us", time: "1h ago" },
    { who: "Jordan Reyes", text: "Jordan proposed Catan for the rotation", time: "Yesterday" },
    { who: "Riley Chen", text: "Riley RSVP'd to Friday, 8:00pm", time: "Yesterday" },
    { who: "Casey Kim", text: "Casey joined the board", time: "Apr 21" }
  ];

  return (
    <div>
      <div className="full-col">
        <div className="subhead-row">
          <h2>In rotation</h2>
        </div>
        <Rolodex games={rotation} memberCount={memberCount} />
      </div>

      <div className="two-col">
        <div>
          <div className="subhead-row">
            <h2>Next session</h2>
          </div>
          {next ? (
            <div className="hero-card">
              {nextGame ? <Cover game={nextGame} className="hero-art" /> : <span className="hero-art placeholder">—</span>}
              <div className="hero-text">
                <span className="hero-date">{formatSessionDate(next.date)}</span>
                <span className="hero-time">{next.start ? formatTimeRange(next.start, next.end) : ""}</span>
                <span className="hero-game">{next.activity || nextGame?.title || "Game night"}</span>
                <span className="hero-going">
                  <span className="stack">
                    {board.members.slice(0, Math.max(1, Math.min(going, 5))).map((m) => (
                      <Avatar key={m.userId} name={m.name} className="xs stacked" />
                    ))}
                  </span>
                  <span className="row-sub">
                    {going} of {memberCount} going
                  </span>
                </span>
                <span className="rsvp-group">
                  <button className={`rsvp-btn in${nextMine === "in" ? " active" : ""}`} onClick={() => onRsvp(next.id, "in")}>
                    I'm in
                  </button>
                  <button className={`rsvp-btn out${nextMine === "out" ? " active" : ""}`} onClick={() => onRsvp(next.id, "out")}>
                    Can't make it
                  </button>
                </span>
              </div>
            </div>
          ) : (
            <div className="hero-card empty muted">Nothing scheduled yet.</div>
          )}
        </div>

        <div>
          <div className="subhead-row">
            <h2>Needs you</h2>
          </div>
          <div className="list-card">
            {needs.length === 0 && <div className="list-row muted">You're all caught up 🎉</div>}
            {needs.map((n) => (
              <button key={n.id} className="needs-row" onClick={() => onSetTab(n.tab)}>
                <span className="needs-badge">{n.count}</span>
                <span className="col">
                  <span className="row-name">{n.title}</span>
                  <span className="row-sub">{n.sub}</span>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="subhead-row">
            <h2>Recent activity</h2>
          </div>
          <div className="list-card">
            {activity.map((a, i) => (
              <div key={i} className="activity-row">
                <Avatar name={a.who} className="sm grad" />
                <span className="col">
                  <span className="activity-text">{a.text}</span>
                  <span className="notif-time">{a.time}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="subhead-row">
            <h2>Board pulse</h2>
          </div>
          <div className="pulse-grid">
            <div className="stat-card">
              <span className="stat-num">{schedule.length}</span>
              <span className="stat-label">Sessions planned</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{rotation[0]?.title?.split(" ")[0] || "—"}</span>
              <span className="stat-label">Top game</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{memberCount}</span>
              <span className="stat-label">Members</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{rotation.length}</span>
              <span className="stat-label">Games in rotation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Board → Game Catalog ----

export function BoardCatalog({ board, games, user, onVote, onProposeGame, onSetTab }) {
  const [q, setQ] = useState("");
  const memberCount = board.members.length;
  const match = (g) => !q || g.title.toLowerCase().includes(q.toLowerCase());
  const rotation = inRotation(games, memberCount).filter(match);
  const pending = pendingApproval(games, memberCount).filter(match);
  const common = everyoneOwns(games, memberCount).filter(match);

  return (
    <div>
      <div className="action-row">
        <SearchBox placeholder="Search this board's games" value={q} onChange={setQ} />
        <button className="primary-btn" onClick={onProposeGame}>
          <Plus size={14} /> Propose a game
        </button>
      </div>

      <div className="subhead-row">
        <h2>In rotation</h2>
      </div>
      {rotation.length === 0 ? (
        <p className="muted catalog-empty">Nothing in rotation yet.</p>
      ) : (
        <div className="launcher-grid">
          {rotation.map((g) => (
            <GameTile
              key={g.id}
              game={g}
              badge="In rotation"
              action={
                <button className="ghost-btn sm" onClick={() => onSetTab("calendar")}>
                  Schedule
                </button>
              }
            />
          ))}
        </div>
      )}

      <div className="section-gap">
        <div className="subhead-row">
          <h2>Pending approval</h2>
        </div>
        {pending.length === 0 ? (
          <p className="muted catalog-empty">No games awaiting votes.</p>
        ) : (
          <div className="launcher-grid">
            {pending.map((g) => {
              const yes = upVotes(g);
              const need = threshold(memberCount);
              const mine = myVote(g, user.id);
              return (
                <GameTile
                  key={g.id}
                  game={g}
                  badge={`${yes}/${need} yes`}
                  action={
                    <>
                      <button className={`vote-btn yes${mine === "up" ? " on" : ""}`} onClick={() => onVote(g.id, "up")}>
                        Yes
                      </button>
                      <button className={`vote-btn no${mine === "down" ? " on" : ""}`} onClick={() => onVote(g.id, "down")}>
                        No
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {common.length > 0 && (
        <div className="section-gap">
          <div className="subhead-row">
            <h2>Everyone owns these</h2>
            <span className="subhead-note">From each member's personal catalog</span>
          </div>
          <div className="launcher-grid">
            {common.map((g) => (
              <GameTile
                key={g.id}
                game={g}
                badge={`${g.owners}/${memberCount} own`}
                action={
                  <button className="ghost-btn sm" onClick={() => onVote(g.id, "up")}>
                    Propose
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Board → People ----

export function BoardPeople({ board, isAdmin, onRemoveMember }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const members = board.members.filter(
    (m) => !query || m.name.toLowerCase().includes(query) || roleLabel(m.role).toLowerCase().includes(query)
  );

  return (
    <div>
      <div className="action-row">
        <SearchBox placeholder="Search members" value={q} onChange={setQ} />
        <button className="primary-btn">Invite people</button>
      </div>
      <div className="list-card">
        {members.map((m) => (
          <div key={m.userId} className="list-row">
            <Avatar name={m.name} photoUrl={m.photoUrl} online={m.online} className="lg" />
            <span className="col">
              <span className="member-name-row">
                <span className="row-name">{m.name}</span>
                <span className={`role-badge role-${roleLabel(m.role).toLowerCase()}`}>{roleLabel(m.role)}</span>
              </span>
              <span className="row-sub">
                {m.since ? `Member since ${m.since}` : "Member"} · {m.online ? "Online" : "Offline"}
              </span>
            </span>
            {isAdmin && m.role !== "owner" && (
              <button className="danger-btn" onClick={() => onRemoveMember(m.userId)}>
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Board → Admin settings ----

export function BoardAdmin({ board, onRename, onSetEmoji, onDelete, onAddMember, onRemoveMember }) {
  const [name, setName] = useState(board.name);
  const [emoji, setEmoji] = useState(board.emoji || "🎮");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, text }

  async function addMember() {
    const value = email.trim();
    if (!value || adding) return;
    setAdding(true);
    setFeedback(null);
    try {
      await onAddMember(value);
      setFeedback({ ok: true, text: `Added ${value} to the board.` });
      setEmail("");
    } catch (err) {
      setFeedback({ ok: false, text: err.message || "Couldn't add that user." });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="narrow-col">
      <p className="lead">You're an admin on this board. These settings apply to everyone.</p>
      <div className="admin-card">
        <label className="field-col">
          <span className="field-label">Board name</span>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && onRename(name.trim())}
          />
        </label>
        <div className="field-col">
          <span className="field-label">Board icon</span>
          <div className="emoji-row">
            {BOARD_EMOJI.map((e) => (
              <button
                key={e}
                className={`emoji-chip${e === emoji ? " selected" : ""}`}
                onClick={() => {
                  setEmoji(e);
                  onSetEmoji(e);
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <span className="hint">Pick an emoji for the board badge.</span>
        </div>
      </div>

      <div className="subhead-row">
        <h2>Members &amp; roles</h2>
      </div>
      <div className="add-member-card">
        <div className="add-member-row">
          <input
            className="text-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            placeholder="teammate@email.com"
          />
          <button className="primary-btn" onClick={addMember} disabled={adding || !email.trim()}>
            {adding ? "Adding…" : "Add to board"}
          </button>
        </div>
        <span className="hint">
          Adds an existing Huddle user right away — no invite email. They'll need to have signed in once.
        </span>
        {feedback && <span className={`add-member-feedback${feedback.ok ? " ok" : " err"}`}>{feedback.text}</span>}
      </div>
      <div className="list-card">
        {board.members.map((m) => (
          <div key={m.userId} className="list-row">
            <Avatar name={m.name} photoUrl={m.photoUrl} online={m.online} className="lg" />
            <span className="col">
              <span className="member-name-row">
                <span className="row-name">{m.name}</span>
                <span className={`role-badge role-${roleLabel(m.role).toLowerCase()}`}>{roleLabel(m.role)}</span>
              </span>
              <span className="row-sub">{m.since ? `Member since ${m.since}` : "Member"}</span>
            </span>
            <span className="rsvp-group">
              <button className="ghost-btn">Change role</button>
              {m.role !== "owner" && (
                <button className="danger-btn" onClick={() => onRemoveMember(m.userId)}>
                  Remove
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="danger-row">
        <span className="col">
          <span className="field-label">Delete this board</span>
          <span className="hint">Removes the board, its games, and its schedule for everyone.</span>
        </span>
        <button className="danger-btn" onClick={onDelete}>
          Delete board
        </button>
      </div>
    </div>
  );
}
