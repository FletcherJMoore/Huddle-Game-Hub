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

// Cover: gradient + initials mark (roster games have no art source).
function coverInner(item, markSize) {
  const el = document.createElement("div");
  el.style.cssText = `width:100%;height:100%;background:linear-gradient(135deg,${avatarColor(item.title)},#0b0c12);display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk';font-weight:700;font-size:${markSize};color:#ffffffd0;`;
  el.textContent = initialsFor(item.title);
  return el;
}

function variantChip(item, size) {
  if (!item.variant) return null;
  const v = document.createElement("span");
  v.style.cssText = `font-family:'JetBrains Mono';font-size:${size};font-weight:600;color:var(--accent,#7c5cff);background:#7c5cff1a;padding:2px 6px;border-radius:5px;`;
  v.textContent = item.variant;
  return v;
}

function voteButton(item, kind, glyph, big) {
  const btn = document.createElement("button");
  btn.type = "button";
  const mine = item.approvals?.[store.currentUser?.uid] === kind;
  const tone = kind === "up" ? "#56d364" : "#ff5c7c";
  const on = mine
    ? `background:${tone}22;border:1px solid ${tone}55;color:${tone};`
    : "background:#15161f;border:1px solid #2a2c3d;color:#8b8da3;";
  const pad = big ? "7px 13px" : "5px 9px";
  const fs = big ? "13px" : "12px";
  btn.style.cssText = `display:flex;align-items:center;gap:5px;border-radius:${big ? "9px" : "8px"};padding:${pad};font-size:${fs};font-weight:700;cursor:pointer;${on}`;
  btn.textContent = `${glyph} ${countVotes(item, kind)}`;
  if (canEdit()) btn.addEventListener("click", () => setVote(item.id, kind));
  else btn.disabled = true;
  return btn;
}

function miniBtn(glyph, title, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.style.cssText =
    "background:none;border:none;color:#5a5c72;font-size:13px;cursor:pointer;padding:2px 4px;";
  b.textContent = glyph;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
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
    ...(rotation.length ? rotation.map((g) => rotationCard(g)) : [emptyState("Nothing agreed yet")])
  );
  elements.pendingList.replaceChildren(
    ...(pending.length ? pending.map((g) => pendingCard(board, g)) : [emptyState("No games up for a vote")])
  );
  elements.rejectedList.replaceChildren(
    ...(rejected.length ? rejected.map((g) => rejectedCard(g)) : [emptyState("No hard passes")])
  );
}

function rotationCard(item) {
  const card = document.createElement("div");
  card.style.cssText = "background:#13141d;border:1px solid #56d36426;border-radius:14px;overflow:hidden;";

  const coverWrap = document.createElement("div");
  coverWrap.style.cssText = "position:relative;height:106px;background:#0b0c12;";
  coverWrap.append(coverInner(item, "36px"));
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;inset:0;background:linear-gradient(180deg,rgba(19,20,29,0) 45%,#13141d 100%);";
  coverWrap.append(overlay);

  const body = document.createElement("div");
  body.style.cssText = "padding:12px 14px 13px;";

  const titleRow = document.createElement("div");
  titleRow.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;";
  const name = document.createElement("span");
  name.style.cssText = "font-weight:700;font-size:14.5px;";
  name.textContent = item.title;
  titleRow.append(name);
  const chip = variantChip(item, "10px");
  if (chip) titleRow.append(chip);

  const meta = document.createElement("div");
  meta.style.cssText = "font-size:11.5px;color:#6b6d85;margin-top:3px;margin-bottom:12px;";
  meta.textContent = gameMeta(item);

  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
  const agreed = document.createElement("span");
  agreed.style.cssText = "font-size:11.5px;color:#56d364;font-weight:600;";
  agreed.textContent = "✓ Agreed by the crew";
  const votes = document.createElement("div");
  votes.style.cssText = "display:flex;gap:6px;align-items:center;";
  votes.append(voteButton(item, "up", "▲", false), voteButton(item, "down", "▼", false));
  if (canEdit()) {
    votes.append(miniBtn("✎", "Edit game", () => openEditGame(item)), miniBtn("✕", "Delete game", () => deleteGame(item.id)));
  }
  foot.append(agreed, votes);

  body.append(titleRow, meta, foot);
  card.append(coverWrap, body);
  return card;
}

function pendingCard(board, item) {
  const card = document.createElement("div");
  card.style.cssText = "background:#13141d;border:1px solid #ffb13d2e;border-radius:14px;padding:16px;";

  const top = document.createElement("div");
  top.style.cssText = "display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;";

  const left = document.createElement("div");
  left.style.cssText = "display:flex;gap:13px;flex:1;min-width:230px;";
  const cover = document.createElement("div");
  cover.style.cssText = "width:92px;height:54px;border-radius:9px;overflow:hidden;flex-shrink:0;background:#0b0c12;";
  cover.append(coverInner(item, "22px"));
  const info = document.createElement("div");
  info.style.cssText = "min-width:0;";
  const titleRow = document.createElement("div");
  titleRow.style.cssText = "display:flex;align-items:center;gap:7px;flex-wrap:wrap;";
  const name = document.createElement("span");
  name.style.cssText = "font-weight:700;font-size:15.5px;";
  name.textContent = item.title;
  titleRow.append(name);
  const chip = variantChip(item, "10.5px");
  if (chip) titleRow.append(chip);
  const meta = document.createElement("div");
  meta.style.cssText = "font-size:12px;color:#8b8da3;margin-top:4px;";
  meta.textContent = gameMeta(item);
  info.append(titleRow, meta);
  if (item.addedBy) {
    const prop = document.createElement("div");
    prop.style.cssText = "font-size:11.5px;color:#6b6d85;margin-top:6px;display:flex;align-items:center;gap:6px;";
    const av = document.createElement("div");
    av.style.cssText = `width:18px;height:18px;border-radius:50%;background:${avatarColor(item.addedBy)};display:inline-flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:700;color:#0b0c12;`;
    av.textContent = initialsFor(plainName(board, item.addedBy));
    prop.append(av, document.createTextNode(`Proposed by ${plainName(board, item.addedBy)}`));
    info.append(prop);
  }
  left.append(cover, info);

  const right = document.createElement("div");
  right.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;gap:9px;min-width:150px;";
  const voteRow = document.createElement("div");
  voteRow.style.cssText = "display:flex;gap:8px;align-items:center;";
  voteRow.append(voteButton(item, "up", "👍", true), voteButton(item, "down", "👎", true));
  if (canEdit()) {
    voteRow.append(miniBtn("✎", "Edit game", () => openEditGame(item)), miniBtn("✕", "Delete game", () => deleteGame(item.id)));
  }
  right.append(voteRow);

  top.append(left, right);
  card.append(top);

  // progress
  const need = majority(board);
  const up = countVotes(item, "up");
  const prog = document.createElement("div");
  prog.style.cssText = "margin-top:14px;";
  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;";
  const lbl = document.createElement("span");
  lbl.style.cssText = "font-size:11.5px;color:#a3a5bb;font-weight:600;";
  lbl.textContent = up >= need ? "Ready for rotation" : "Gathering votes";
  const req = document.createElement("span");
  req.style.cssText = "font-size:11px;color:#6b6d85;";
  req.textContent = `${up} / ${need} needed`;
  head.append(lbl, req);
  const track = document.createElement("div");
  track.style.cssText = "height:7px;border-radius:4px;background:#0b0c12;overflow:hidden;";
  const fill = document.createElement("div");
  fill.style.cssText = `height:100%;width:${Math.min(100, (up / need) * 100)}%;background:linear-gradient(90deg,#ffb13d,#56d364);border-radius:4px;transition:width .3s;`;
  track.append(fill);
  prog.append(head, track);

  const waiting = memberIdsOf(board).filter((uid) => item.approvals?.[uid] === undefined);
  if (waiting.length) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:11px;flex-wrap:wrap;";
    const txt = document.createElement("span");
    txt.style.cssText = "font-size:11.5px;color:#6b6d85;";
    txt.textContent = "Still waiting on";
    const avs = document.createElement("div");
    avs.style.cssText = "display:flex;";
    waiting.slice(0, 4).forEach((uid) => {
      const av = document.createElement("div");
      av.title = plainName(board, uid);
      av.style.cssText = `width:22px;height:22px;border-radius:50%;background:${avatarColor(uid)};border:2px solid #13141d;margin-left:-6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#0b0c12;`;
      av.textContent = initialsFor(plainName(board, uid));
      avs.append(av);
    });
    row.append(txt, avs);
    if (canEdit()) {
      const nudge = document.createElement("button");
      nudge.type = "button";
      nudge.style.cssText =
        "font-size:11px;font-weight:600;color:var(--accent,#7c5cff);background:#7c5cff14;border:1px solid #7c5cff33;border-radius:7px;padding:4px 9px;cursor:pointer;margin-left:2px;";
      nudge.textContent = "🔔 Nudge";
      nudge.addEventListener("click", () => nudgeCrew(item));
      row.append(nudge);
    }
    prog.append(row);
  }

  card.append(prog);
  return card;
}

function rejectedCard(item) {
  const card = document.createElement("div");
  card.style.cssText =
    "background:#101019;border:1px solid #ffffff08;border-radius:11px;padding:9px 13px;display:flex;align-items:center;gap:10px;opacity:.6;";
  const name = document.createElement("span");
  name.style.cssText = "font-weight:600;font-size:13px;text-decoration:line-through;color:#a3a5bb;";
  name.textContent = item.title;
  card.append(name);
  const chip = variantChip(item, "10px");
  if (chip) {
    chip.style.color = "#6b6d85";
    chip.style.background = "#ffffff0a";
    card.append(chip);
  }
  const down = document.createElement("span");
  down.style.cssText = "font-size:11px;color:#ff5c7c;";
  down.textContent = `👎 ${countVotes(item, "down")}`;
  card.append(down);
  if (canEdit()) {
    const revive = document.createElement("button");
    revive.type = "button";
    revive.title = "Revive — vote yes";
    revive.style.cssText = "font-size:11px;color:#8b8da3;background:none;border:none;cursor:pointer;";
    revive.textContent = "↺ revive";
    revive.addEventListener("click", () => setVote(item.id, "up"));
    card.append(revive);
    card.append(miniBtn("✕", "Delete game", () => deleteGame(item.id)));
  }
  return card;
}

function nudgeCrew(item) {
  updateActiveBoard((board) => {
    board.messages = board.messages ?? [];
    board.messages.push({
      id: crypto.randomUUID(),
      author: "Huddle Game Hub",
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
  spark.style.fontSize = "22px";
  spark.textContent = "🎡";
  const text = document.createElement("span");
  text.style.fontSize = "14px";
  text.append(document.createTextNode("The wheel says... "));
  const b = document.createElement("b");
  b.style.cssText = "color:var(--accent,#7c5cff);font-weight:700;";
  b.textContent = pick.title;
  text.append(b, document.createTextNode(" tonight!"));
  elements.wheelResult.append(spark, text);
}

// ---------- propose / edit game ----------
function selectedPlatforms() {
  return [...elements.pgPlatforms.querySelectorAll(".platform-opt.selected")].map((c) => c.dataset.platform);
}

function paintPlatform(chip, selected) {
  chip.classList.toggle("selected", selected);
  chip.style.background = selected ? "#7c5cff1a" : "#15161f";
  chip.style.borderColor = selected ? "var(--accent,#7c5cff)" : "#2a2c3d";
  chip.style.color = selected ? "var(--accent,#7c5cff)" : "#8b8da3";
}

function clearPlatformPicker() {
  elements.pgPlatforms.querySelectorAll(".platform-opt").forEach((c) => paintPlatform(c, false));
}

export function openProposeGame() {
  if (!canEdit()) {
    showToast("You don't have edit access on this board");
    return;
  }
  store.editingGameId = null;
  elements.proposeGameForm.reset();
  clearPlatformPicker();
  elements.pgModalTitle.textContent = "Propose a game";
  elements.pgSubmitButton.textContent = "Add to roster";
  openModal("proposeGame");
  setTimeout(() => elements.pgTitle.focus(), 50);
}

export function openEditGame(game) {
  if (!canEdit()) return;
  store.editingGameId = game.id;
  elements.proposeGameForm.reset();
  elements.pgTitle.value = game.title;
  elements.pgVariant.value = game.variant || "";
  elements.pgPlayers.value = game.players || "";
  elements.pgPlatforms.querySelectorAll(".platform-opt").forEach((c) => {
    paintPlatform(c, (game.platforms || []).includes(c.dataset.platform));
  });
  elements.pgModalTitle.textContent = "Edit game";
  elements.pgSubmitButton.textContent = "Save changes";
  openModal("proposeGame");
  setTimeout(() => elements.pgTitle.focus(), 50);
}

function deleteGame(id) {
  const game = activeBoard()?.games.find((g) => g.id === id);
  if (!game) return;
  if (!window.confirm(`Delete "${game.title}"?`)) return;
  updateActiveBoard((board) => {
    board.games = board.games.filter((g) => g.id !== id);
  });
  showToast(`Deleted ${game.title}`);
}

export function bindGameEvents() {
  elements.spinButton.addEventListener("click", spinWheel);
  elements.proposeGameButton.addEventListener("click", openProposeGame);

  elements.pgPlatforms.addEventListener("click", (event) => {
    const chip = event.target.closest(".platform-opt");
    if (chip) paintPlatform(chip, !chip.classList.contains("selected"));
  });

  elements.proposeGameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    const title = elements.pgTitle.value.trim();
    if (!title) return;
    const variant = elements.pgVariant.value.trim();
    const players = elements.pgPlayers.value.trim();
    const platforms = selectedPlatforms().filter((p) => PLATFORMS.includes(p));

    if (store.editingGameId) {
      const id = store.editingGameId;
      updateActiveBoard((board) => {
        const g = board.games.find((x) => x.id === id);
        if (!g) return;
        g.title = title;
        g.variant = variant;
        g.players = players;
        g.platforms = platforms;
      });
      closeModal();
      showToast("Game updated");
      return;
    }

    updateActiveBoard((board) => {
      board.games.push({
        id: crypto.randomUUID(),
        title,
        genre: "",
        variant,
        players,
        platforms,
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
