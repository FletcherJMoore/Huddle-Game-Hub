import { store, activeBoard, updateActiveBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { PLATFORMS } from "../../utils/constants.js";
import {
  canEdit,
  memberIdsOf,
  majority,
  avatarColor,
  plainName,
  displayName
} from "../boards/board-model.js";
import { initialsFor } from "../../utils/format.js";
import { emptyState } from "../../components/empty-state.js";
import { openModal, closeModal, showToast } from "../shell/shell.js";

export function countVotes(item, kind) {
  return Object.values(item.approvals ?? {}).filter((v) => v === kind).length;
}

export function approvalScore(item) {
  return countVotes(item, "up") - countVotes(item, "down");
}

// Consensus model: a majority of 👍 (outnumbering 👎) puts a game in rotation;
// a majority of 👎 rejects it; otherwise it's pending.
function consensusStatus(item, board) {
  const need = majority(board);
  const up = countVotes(item, "up");
  const down = countVotes(item, "down");
  if (up >= need && up > down) return "rotation";
  if (down >= need && down > up) return "never";
  return "maybe";
}

function gameMeta(item) {
  const parts = [];
  if (item.genre) parts.push(item.genre);
  if (item.platforms?.length) parts.push(item.platforms.join(", "));
  if (item.players) parts.push(`${item.players} players`);
  return parts.join(" · ") || "No details yet";
}

function cover(item, size) {
  const el = document.createElement("div");
  el.className = "game-cover";
  el.style.background = avatarColor(item.title);
  el.textContent = initialsFor(item.title);
  if (size) el.style.fontSize = size;
  return el;
}

function nameRow(item) {
  const row = document.createElement("div");
  row.className = "game-name-row";
  const name = document.createElement("span");
  name.className = "game-name";
  name.textContent = item.title;
  row.append(name);
  if (item.variant) {
    const v = document.createElement("span");
    v.className = "variant-chip";
    v.textContent = item.variant;
    row.append(v);
  }
  return row;
}

function voteButton(item, kind, glyph) {
  const btn = document.createElement("button");
  const mine = item.approvals?.[store.currentUser?.uid] === kind;
  btn.className = `vote-btn ${kind}${mine ? " on" : ""}`;
  btn.type = "button";
  btn.textContent = `${glyph} ${countVotes(item, kind)}`;
  if (canEdit()) btn.addEventListener("click", () => setVote(item.id, kind));
  else btn.disabled = true;
  return btn;
}

function setVote(gameId, kind) {
  updateActiveBoard((board) => {
    const game = board.games.find((g) => g.id === gameId);
    if (!game) return;
    game.approvals = game.approvals ?? {};
    const uid = store.currentUser.uid;
    if (game.approvals[uid] === kind) delete game.approvals[uid];
    else game.approvals[uid] = kind;
    game.status = consensusStatus(game, board);
  });
}

// ---------- render ----------
export function renderRoster(board) {
  const need = majority(board);
  elements.rosterSubtitle.textContent = `Majority of ${memberIdsOf(board).length} (${need} votes) moves a game into rotation.`;

  const rotation = board.games.filter((g) => g.status === "rotation");
  const pending = board.games.filter((g) => g.status === "maybe");
  const rejected = board.games.filter((g) => g.status === "never");

  elements.rotationCount.textContent = String(rotation.length);
  elements.pendingCount.textContent = String(pending.length);
  elements.rejectedCount.textContent = String(rejected.length);

  elements.rotationList.replaceChildren(
    ...(rotation.length ? rotation.map((g) => rotationCard(board, g)) : [emptyState("Nothing agreed yet")])
  );
  elements.pendingList.replaceChildren(
    ...(pending.length ? pending.map((g) => pendingCard(board, g)) : [emptyState("No games up for a vote")])
  );
  elements.rejectedList.replaceChildren(
    ...(rejected.length ? rejected.map((g) => rejectedCard(g)) : [emptyState("No hard passes")])
  );
}

function rotationCard(board, item) {
  const card = document.createElement("div");
  card.className = "game-card rotation";

  const top = document.createElement("div");
  top.className = "game-top";
  const info = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "game-meta";
  meta.textContent = gameMeta(item);
  info.append(nameRow(item), meta);
  top.append(cover(item), info);

  const foot = document.createElement("div");
  foot.className = "game-foot";
  const agreed = document.createElement("span");
  agreed.className = "agreed";
  agreed.textContent = "✓ Agreed by the crew";
  const votes = document.createElement("div");
  votes.className = "vote-row";
  votes.append(voteButton(item, "up", "▲"), voteButton(item, "down", "▼"));
  foot.append(agreed, votes);

  card.append(top, foot);
  return card;
}

function pendingCard(board, item) {
  const card = document.createElement("div");
  card.className = "game-card pending";

  const top = document.createElement("div");
  top.className = "pending-top";

  const id = document.createElement("div");
  id.className = "pending-id";
  const info = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "game-meta";
  meta.textContent = gameMeta(item);
  info.append(nameRow(item), meta);
  if (item.addedBy) {
    const prop = document.createElement("div");
    prop.className = "game-proposer";
    const av = document.createElement("span");
    av.className = "av";
    av.style.background = avatarColor(item.addedBy);
    av.textContent = initialsFor(plainName(board, item.addedBy));
    prop.append(av, document.createTextNode(`Proposed by ${plainName(board, item.addedBy)}`));
    info.append(prop);
  }
  id.append(cover(item, "20px"), info);

  const votes = document.createElement("div");
  votes.className = "vote-row";
  votes.append(voteButton(item, "up", "👍"), voteButton(item, "down", "👎"));

  top.append(id, votes);
  card.append(top);

  // progress
  const need = majority(board);
  const up = countVotes(item, "up");
  const wrap = document.createElement("div");
  wrap.className = "progress-wrap";

  const head = document.createElement("div");
  head.className = "progress-head";
  const lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = up >= need ? "Ready for rotation" : "Gathering votes";
  const req = document.createElement("span");
  req.className = "req";
  req.textContent = `${up} / ${need} needed`;
  head.append(lbl, req);

  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${Math.min(100, (up / need) * 100)}%`;
  track.append(fill);
  wrap.append(head, track);

  // waiting on
  const waiting = memberIdsOf(board).filter((uid) => item.approvals?.[uid] === undefined);
  if (waiting.length) {
    const row = document.createElement("div");
    row.className = "waiting-row";
    row.append(document.createTextNode("Still waiting on"));
    const avs = document.createElement("div");
    avs.className = "avs";
    waiting.slice(0, 4).forEach((uid) => {
      const av = document.createElement("div");
      av.className = "av";
      av.style.background = avatarColor(uid);
      av.textContent = initialsFor(plainName(board, uid));
      av.title = plainName(board, uid);
      avs.append(av);
    });
    row.append(avs);
    if (canEdit()) {
      const nudge = document.createElement("button");
      nudge.className = "nudge-btn";
      nudge.type = "button";
      nudge.textContent = "🔔 Nudge";
      nudge.addEventListener("click", () => nudgeCrew(item));
      row.append(nudge);
    }
    wrap.append(row);
  }

  card.append(wrap);
  return card;
}

function rejectedCard(item) {
  const card = document.createElement("div");
  card.className = "rejected-card";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.title;
  const down = document.createElement("span");
  down.className = "down";
  down.textContent = `👎 ${countVotes(item, "down")}`;
  card.append(name, down);
  if (canEdit()) {
    const revive = document.createElement("button");
    revive.className = "revive-btn";
    revive.type = "button";
    revive.textContent = "↺ revive";
    revive.title = "Revive — vote yes";
    revive.addEventListener("click", () => setVote(item.id, "up"));
    card.append(revive);
  }
  return card;
}

function nudgeCrew(item) {
  updateActiveBoard((board) => {
    board.messages = board.messages ?? [];
    board.messages.push({
      id: crypto.randomUUID(),
      author: "Huddle",
      authorUid: null,
      text: `🔔 ${displayName()} nudged the crew to vote on ${item.title}.`,
      createdAt: new Date().toISOString()
    });
  });
  showToast("Nudge sent to the chat");
}

// ---------- spin the wheel ----------
function spinWheel() {
  const board = activeBoard();
  const rotation = (board.games ?? []).filter((g) => g.status === "rotation");
  if (!rotation.length) {
    showToast("Nothing in rotation to spin");
    return;
  }
  const pick = rotation[Math.floor(Math.random() * rotation.length)];
  elements.wheelResult.classList.remove("hidden");
  elements.wheelResult.replaceChildren();
  const spark = document.createElement("span");
  spark.textContent = "🎡";
  spark.style.fontSize = "22px";
  const text = document.createElement("span");
  text.append(document.createTextNode("The wheel says... "));
  const b = document.createElement("b");
  b.textContent = pick.title;
  text.append(b, document.createTextNode(" tonight!"));
  elements.wheelResult.append(spark, text);
}

// ---------- propose game ----------
function selectedPlatforms() {
  return [...elements.pgPlatforms.querySelectorAll(".platform-opt.selected")].map((c) => c.dataset.platform);
}

export function openProposeGame() {
  if (!canEdit()) {
    showToast("You don't have edit access on this board");
    return;
  }
  elements.proposeGameForm.reset();
  elements.pgPlatforms.querySelectorAll(".selected").forEach((c) => c.classList.remove("selected"));
  openModal("proposeGame");
  setTimeout(() => elements.pgTitle.focus(), 50);
}

export function bindGameEvents() {
  elements.spinButton.addEventListener("click", spinWheel);
  elements.proposeGameButton.addEventListener("click", openProposeGame);

  elements.pgPlatforms.addEventListener("click", (event) => {
    const chip = event.target.closest(".platform-opt");
    if (chip) chip.classList.toggle("selected");
  });

  elements.proposeGameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    const title = elements.pgTitle.value.trim();
    if (!title) return;
    updateActiveBoard((board) => {
      board.games.push({
        id: crypto.randomUUID(),
        title,
        genre: "",
        variant: elements.pgVariant.value.trim(),
        players: elements.pgPlayers.value.trim(),
        platforms: selectedPlatforms().filter((p) => PLATFORMS.includes(p)),
        status: "maybe",
        approvals: { [store.currentUser.uid]: "up" },
        addedBy: store.currentUser.uid,
        createdAt: new Date().toISOString()
      });
    });
    closeModal();
    showToast(`${title} added to Pending`);
  });
}
