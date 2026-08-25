import { useState } from "react";

import { myVote } from "../lib/games.js";
import { inRotation, pendingApproval, everyoneOwns, upVotes, threshold } from "../lib/board-domain.js";
import { myRsvp, rsvpCounts, sortSessions, isPast, formatSessionDate, formatTimeRange } from "../lib/schedule.js";
import { roleLabel } from "../lib/social.js";
import { BOARD_EMOJI } from "./theme.jsx";
import { Cover, Avatar, SearchBox, GameTile } from "./ui.jsx";
import { Plus } from "./icons.jsx";

function nextUpcoming(schedule) {
  return sortSessions(schedule).find((s) => !isPast(s)) || null;
}

// ---- Crew → Plan ----
//
// The action home: the two decisions a crew actually makes — *when* we play
// next (schedule + RSVP) and *what* we play (vote / propose). No stat cards or
// activity feed; those were the dashboard this screen replaced.

export function BoardPlan({ board, games, schedule, user, onRsvp, onVote, onProposeGame, onSetTab }) {
  const memberCount = board.members.length;
  const pending = pendingApproval(games, memberCount);
  const next = nextUpcoming(schedule);
  const nextGame = next && games.find((g) => g.id === next.gameId);
  const nextMine = next ? myRsvp(next, user.id) : null;
  const going = next ? rsvpCounts(next).in : 0;

  return (
    <div className="plan">
      <div className="subhead-row">
        <h2>Next up</h2>
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
        <div className="hero-card empty plan-empty">
          <span className="col">
            <span className="hero-date">No game night planned yet</span>
            <span className="row-sub">Pick a night that works and rally the crew.</span>
          </span>
          <button className="primary-btn" onClick={() => onSetTab("calendar")}>
            <Plus size={14} /> Plan your next night
          </button>
        </div>
      )}

      <div className="subhead-row plan-head section-gap">
        <h2>Deciding what to play</h2>
        <button className="ghost-btn sm plan-head-action" onClick={onProposeGame}>
          <Plus size={13} /> Propose a game
        </button>
      </div>
      <div className="list-card">
        {pending.length === 0 ? (
          <div className="list-row muted">Nothing up for a vote. Propose a game to get the crew deciding.</div>
        ) : (
          pending.map((g) => {
            const yes = upVotes(g);
            const need = threshold(memberCount);
            const mine = myVote(g, user.id);
            return (
              <div key={g.id} className="list-row decide-row">
                <Cover game={g} className="decide-cover" />
                <span className="col">
                  <span className="row-name">{g.title}</span>
                  <span className="row-sub">
                    {yes} of {need} yes{(g.platforms || []).length ? ` · ${(g.platforms || []).join(", ")}` : ""}
                  </span>
                </span>
                <span className="rsvp-group">
                  <button className={`vote-btn yes${mine === "up" ? " on" : ""}`} onClick={() => onVote(g.id, "up")}>
                    Yes
                  </button>
                  <button className={`vote-btn no${mine === "down" ? " on" : ""}`} onClick={() => onVote(g.id, "down")}>
                    No
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---- Crew → Games ----

// Admin-only control to pull a game off the crew. Confirms first, since it
// affects every member.
function RemoveGameButton({ game, onRemove }) {
  return (
    <button
      className="ghost-btn sm danger"
      onClick={() => {
        if (window.confirm(`Remove ${game.title} from this crew for everyone?`)) onRemove(game.id);
      }}
    >
      Remove
    </button>
  );
}

export function BoardCatalog({ board, games, user, canManage, onVote, onRemove, onProposeGame, onSetTab }) {
  const [q, setQ] = useState("");
  const memberCount = board.members.length;
  const match = (g) => !q || g.title.toLowerCase().includes(q.toLowerCase());
  const rotation = inRotation(games, memberCount).filter(match);
  const pending = pendingApproval(games, memberCount).filter(match);
  const common = everyoneOwns(games, memberCount).filter(match);

  // Admins (owner/editor) can remove any game; anyone can remove one they added.
  const canRemove = (g) => canManage || g.addedBy === user.id;

  return (
    <div>
      <div className="action-row">
        <SearchBox placeholder="Search this crew's games" value={q} onChange={setQ} />
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
                <>
                  <button className="ghost-btn sm" onClick={() => onSetTab("calendar")}>
                    Schedule
                  </button>
                  {canRemove(g) && <RemoveGameButton game={g} onRemove={onRemove} />}
                </>
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
                      {canRemove(g) && <RemoveGameButton game={g} onRemove={onRemove} />}
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
                  <>
                    <button className="ghost-btn sm" onClick={() => onVote(g.id, "up")}>
                      Propose
                    </button>
                    {canRemove(g) && <RemoveGameButton game={g} onRemove={onRemove} />}
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Crew → People ----

// A compact role picker (editor/member). The owner row never renders one.
function RoleSelect({ value, onChange }) {
  return (
    <select className="select-input role-select" value={value === "editor" ? "editor" : "member"} onChange={(e) => onChange(e.target.value)}>
      <option value="editor">Editor</option>
      <option value="member">Member</option>
    </select>
  );
}

// Email an invite to join the crew. `onInvite(email, role)` resolves when the
// invite is created (and emailed) or throws the server's message.
function InviteMemberModal({ onClose, onInvite }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, text }

  async function submit(e) {
    e.preventDefault();
    const value = email.trim();
    if (!value || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await onInvite(value, role);
      setFeedback({ ok: true, text: `Invite sent to ${value}.` });
      setEmail("");
    } catch (err) {
      setFeedback({ ok: false, text: err.message || "Couldn't send that invite." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scrim" onClick={() => !busy && onClose()}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2>Invite to crew</h2>
        </div>
        <div className="modal-body">
          <label className="field-col">
            <span className="field-label">Their email</span>
            <input
              className="text-input"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@email.com"
            />
          </label>
          <div className="field-col">
            <span className="field-label">Role</span>
            <RoleSelect value={role} onChange={setRole} />
          </div>
          <span className="hint">
            We'll email them a link to join. They accept by signing in with this email.
          </span>
          {feedback && <span className={`add-member-feedback${feedback.ok ? " ok" : " err"}`}>{feedback.text}</span>}
        </div>
        <div className="modal-foot">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button type="submit" className="primary-btn" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function BoardPeople({ board, isAdmin, onRemoveMember, onInvite }) {
  const [q, setQ] = useState("");
  const [inviting, setInviting] = useState(false);
  const query = q.trim().toLowerCase();
  const members = board.members.filter(
    (m) => !query || m.name.toLowerCase().includes(query) || roleLabel(m.role).toLowerCase().includes(query)
  );

  return (
    <div>
      <div className="action-row">
        <SearchBox placeholder="Search members" value={q} onChange={setQ} />
        {isAdmin && (
          <button className="primary-btn" onClick={() => setInviting(true)}>
            <Plus size={14} /> Invite people
          </button>
        )}
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

      {inviting && <InviteMemberModal onClose={() => setInviting(false)} onInvite={onInvite} />}
    </div>
  );
}

// ---- Crew → Admin settings ----

export function BoardAdmin({
  board,
  invites = [],
  onRename,
  onSetEmoji,
  onDelete,
  onInvite,
  onSetRole,
  onRemoveMember,
  onResendInvite,
  onRevokeInvite
}) {
  const [name, setName] = useState(board.name);
  const [emoji, setEmoji] = useState(board.emoji || "🎮");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, text }

  async function sendInvite() {
    const value = email.trim();
    if (!value || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const { emailed } = await onInvite(value, role);
      setFeedback({ ok: true, text: emailed ? `Invite emailed to ${value}.` : `Invite created for ${value}.` });
      setEmail("");
    } catch (err) {
      setFeedback({ ok: false, text: err.message || "Couldn't send that invite." });
    } finally {
      setSending(false);
    }
  }

  const pending = invites.filter((i) => i.status === "pending");

  return (
    <div className="narrow-col">
      <p className="lead">You're an admin on this crew. These settings apply to everyone.</p>
      <div className="admin-card">
        <label className="field-col">
          <span className="field-label">Crew name</span>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && onRename(name.trim())}
          />
        </label>
        <div className="field-col">
          <span className="field-label">Crew icon</span>
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
          <span className="hint">Pick an emoji for the crew badge.</span>
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
            onKeyDown={(e) => e.key === "Enter" && sendInvite()}
            placeholder="teammate@email.com"
          />
          <RoleSelect value={role} onChange={setRole} />
          <button className="primary-btn" onClick={sendInvite} disabled={sending || !email.trim()}>
            {sending ? "Sending…" : "Send invite"}
          </button>
        </div>
        <span className="hint">We'll email them a link to join. They accept by signing in with this email.</span>
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
            {m.role === "owner" ? (
              <span className="row-sub">Owner</span>
            ) : (
              <span className="rsvp-group">
                <RoleSelect value={m.role} onChange={(role) => onSetRole(m.userId, role)} />
                <button className="danger-btn" onClick={() => onRemoveMember(m.userId)}>
                  Remove
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="section-gap">
          <div className="subhead-row">
            <h2>Pending invites</h2>
            <span className="subhead-note">Waiting to be accepted</span>
          </div>
          <div className="list-card">
            {pending.map((inv) => (
              <div key={inv.id} className="list-row">
                <span className="invite-avatar">✉️</span>
                <span className="col">
                  <span className="row-name">{inv.email}</span>
                  <span className="row-sub">
                    <span className="invite-status pending">Pending</span> · {inv.role === "editor" ? "Editor" : "Member"}
                  </span>
                </span>
                <span className="rsvp-group">
                  <button className="ghost-btn sm" onClick={() => onResendInvite(inv.id)}>
                    Resend
                  </button>
                  <button className="danger-btn" onClick={() => onRevokeInvite(inv.id)}>
                    Revoke
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="danger-row">
        <span className="col">
          <span className="field-label">Delete this crew</span>
          <span className="hint">Removes the crew, its games, and its schedule for everyone.</span>
        </span>
        <button className="danger-btn" onClick={onDelete}>
          Delete crew
        </button>
      </div>
    </div>
  );
}
