import { store, activeBoard, updateActiveBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { PLATFORMS, GAME_TAGS } from "../../utils/constants.js";
import {
  canEdit,
  memberIdsOf,
  majority,
  avatarColor,
  plainName,
  photoURLFor,
  displayName
} from "../boards/board-model.js";
import { initialsFor } from "../../utils/format.js";
import { emptyState } from "../../components/empty-state.js";
import { openModal, closeModal, showToast } from "../shell/shell.js";
import { icon } from "../../utils/icons.js";
import { avatarEl } from "../boards/board-list.js";
import { searchCatalog } from "../../services/games-catalog-service.js";
import { addToCalendar } from "../schedule/schedule.js";

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

// Cover: catalog art if we have it, legacy Steam CDN art for older games that
// linked a Steam app before catalog search existed, else initials mark.
function coverInner(item, markSize) {
  const el = document.createElement("div");
  el.className = "game-cover";
  const coverUrl =
    item.coverImageUrl || (item.steamAppId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamAppId}/header.jpg` : null);
  if (coverUrl) {
    el.classList.add("has-art");
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = item.title;
    img.src = coverUrl;
    img.addEventListener("error", () => {
      el.classList.remove("has-art");
      el.replaceChildren();
      el.style.background = avatarColor(item.title);
      el.textContent = initialsFor(item.title);
      if (markSize) el.style.fontSize = markSize;
    });
    el.append(img);
    return el;
  }
  el.style.background = avatarColor(item.title);
  el.textContent = initialsFor(item.title);
  return el;
}

function variantChip(item, size) {
  if (!item.variant) return null;
  const chip = document.createElement("span");
  chip.className = "variant-chip";
  chip.style.fontSize = size;
  chip.textContent = item.variant;
  return chip;
}

function platformBadges(item) {
  if (!item.platforms?.length) return null;
  const wrap = document.createElement("div");
  wrap.className = "game-badges";
  item.platforms.forEach((p) => {
    const chip = document.createElement("span");
    chip.className = "tag-platform";
    chip.textContent = p;
    wrap.append(chip);
  });
  return wrap;
}

function tagChips(item) {
  if (!item.tags?.length) return null;
  const wrap = document.createElement("div");
  wrap.className = "game-badges";
  item.tags.forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "tag-game";
    chip.textContent = t;
    wrap.append(chip);
  });
  return wrap;
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

function voteButton(item, kind) {
  const btn = document.createElement("button");
  btn.type = "button";
  const mine = item.approvals?.[store.currentUser?.uid] === kind;
  btn.className = `vote-btn ${kind} ${mine ? "on" : ""}`;
  btn.append(icon(kind === "up" ? "thumbs-up" : "thumbs-down", { size: 14 }), document.createTextNode(String(countVotes(item, kind))));
  if (canEdit()) btn.addEventListener("click", () => setVote(item.id, kind));
  else btn.disabled = true;
  return btn;
}

// ---------- manual drag and drop between rotation / pending ----------
// Lets a crew that already knows what it wants skip the vote flow entirely.
function makeDraggable(card, item) {
  if (!canEdit()) return;
  card.draggable = true;
  card.classList.add("draggable");
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
}

function moveGame(gameId, targetStatus, targetLabel) {
  const board = activeBoard();
  const game = board?.games.find((g) => g.id === gameId);
  if (!game || game.status === targetStatus) return;
  updateActiveBoard((b) => {
    const g = b.games.find((x) => x.id === gameId);
    if (g) g.status = targetStatus;
  });
  showToast(`${game.title} moved to ${targetLabel}`);
}

function bindDropZone(el, targetStatus, targetLabel) {
  el.addEventListener("dragover", (event) => {
    if (!canEdit()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    el.classList.add("drop-active");
  });
  el.addEventListener("dragleave", (event) => {
    if (event.target === el) el.classList.remove("drop-active");
  });
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    el.classList.remove("drop-active");
    if (!canEdit()) return;
    const gameId = event.dataTransfer.getData("text/plain");
    if (gameId) moveGame(gameId, targetStatus, targetLabel);
  });
}

function miniBtn(iconName, title, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.title = title;
  b.className = "mini-btn";
  b.append(icon(iconName, { size: 13 }));
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
  elements.rosterSubtitle.textContent = `Majority of ${memberIdsOf(board).length} (${need} votes) moves a game into rotation — or drag a card to place it directly.`;

  const rotation = board.games.filter((g) => g.status === "rotation");
  const pending = board.games.filter((g) => g.status === "maybe");
  const rejected = board.games.filter((g) => g.status === "never");

  elements.rotationCount.textContent = String(rotation.length);
  elements.pendingCount.textContent = String(pending.length);
  elements.rejectedCount.textContent = String(rejected.length);
  renderDecisionPanel(board, rotation, pending);

  elements.rotationList.replaceChildren(
    ...(rotation.length
      ? rotation.map((g) => rotationCard(board, g))
      : [emptyState("Nothing agreed yet", [{ label: "Propose a game", variant: "primary", onClick: openProposeGame }])])
  );
  elements.pendingList.replaceChildren(
    ...(pending.length
      ? pending.map((g) => pendingCard(board, g))
      : [emptyState("No games up for a vote", [{ label: "Add the first game", variant: "primary", onClick: openProposeGame }])])
  );
  elements.rejectedList.replaceChildren(
    ...(rejected.length ? rejected.map((g) => rejectedCard(g)) : [emptyState("No hard passes")])
  );
}

function renderDecisionPanel(board, rotation, pending) {
  const topGame = [...rotation, ...pending]
    .sort((a, b) => approvalScore(b) - approvalScore(a) || (a.title || "").localeCompare(b.title || ""))[0];
  const next = nextSession(board);
  const available = next ? Object.values(next.votes ?? {}).filter((vote) => vote === "yes").length : 0;

  const intro = document.createElement("div");
  intro.className = "decision-copy";
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow accent";
  eyebrow.textContent = "Tonight";
  const title = document.createElement("strong");
  title.textContent = topGame ? topGame.title : "No front-runner yet";
  const meta = document.createElement("p");
  meta.textContent = next
    ? `${next.activity || "Game night"} · ${next.date} · ${next.start || "time TBD"}`
    : "Pick a game and propose a time to get the crew moving.";
  intro.append(eyebrow, title, meta);

  const stats = document.createElement("div");
  stats.className = "decision-stats";
  stats.append(
    decisionStat("Top votes", topGame ? String(countVotes(topGame, "up")) : "0"),
    decisionStat("Available", next ? String(available) : "0"),
    decisionStat("Needs votes", String(pending.length))
  );

  const actions = document.createElement("div");
  actions.className = "decision-actions";
  const spin = document.createElement("button");
  spin.type = "button";
  spin.className = "btn btn-surface";
  spin.append(icon("dices", { size: 16 }), document.createTextNode("Random pick"));
  spin.addEventListener("click", spinWheel);
  const calendar = document.createElement("button");
  calendar.type = "button";
  calendar.className = "btn btn-surface";
  calendar.disabled = !next;
  calendar.append(icon("calendar", { size: 16 }), document.createTextNode("Calendar"));
  calendar.addEventListener("click", () => addToCalendar(next));
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "btn btn-accent";
  confirm.disabled = !topGame;
  confirm.append(icon("check", { size: 16 }), document.createTextNode("Playing tonight"));
  confirm.addEventListener("click", () => confirmTonight(topGame));
  const reminder = document.createElement("button");
  reminder.type = "button";
  reminder.className = "btn btn-ghost";
  reminder.disabled = !topGame && !next;
  reminder.append(icon("bell", { size: 16 }), document.createTextNode("Reminder"));
  reminder.addEventListener("click", () => sendReminder(topGame, next));
  actions.append(spin, calendar, reminder, confirm);

  elements.decisionPanel.replaceChildren(intro, stats, actions);
}

function decisionStat(label, value) {
  const stat = document.createElement("span");
  stat.className = "decision-stat";
  const num = document.createElement("b");
  num.textContent = value;
  const txt = document.createElement("small");
  txt.textContent = label;
  stat.append(num, txt);
  return stat;
}

function nextSession(board) {
  const today = new Date().toISOString().slice(0, 10);
  return [...(board.schedule ?? [])]
    .filter((session) => `${session.date}` >= today)
    .sort((a, b) => `${a.date}T${a.start || ""}`.localeCompare(`${b.date}T${b.start || ""}`))[0];
}

function rotationCard(board, item) {
  const card = document.createElement("div");
  card.className = "game-card rotation";

  const coverWrap = document.createElement("div");
  coverWrap.className = "game-hero";
  coverWrap.append(coverInner(item, "36px"));
  const overlay = document.createElement("div");
  overlay.className = "game-hero-fade";
  coverWrap.append(overlay);

  const body = document.createElement("div");
  body.className = "game-body";

  const meta = document.createElement("div");
  meta.className = "game-meta";
  meta.textContent = gameMeta(item);

  const details = document.createElement("div");
  details.append(nameRow(item), meta);
  const badges = platformBadges(item);
  if (badges) details.append(badges);
  const tags = tagChips(item);
  if (tags) details.append(tags);

  const foot = document.createElement("div");
  foot.className = "game-foot";
  const agreed = document.createElement("span");
  agreed.className = "agreed";
  agreed.append(icon("check", { size: 13 }), document.createTextNode("Agreed by the crew"));
  const votes = document.createElement("div");
  votes.className = "vote-row";
  votes.append(voteButton(item, "up"), voteButton(item, "down"));
  if (canEdit()) {
    votes.append(miniBtn("pencil", "Edit game", () => openEditGame(item)), miniBtn("x", "Delete game", () => deleteGame(item.id)));
  }
  foot.append(agreed, votes);

  body.append(details, foot);
  card.append(coverWrap, body);
  makeDraggable(card, item);
  return card;
}
function pendingCard(board, item) {
  const card = document.createElement("div");
  card.className = "game-card pending";

  const top = document.createElement("div");
  top.className = "pending-top";

  const left = document.createElement("div");
  left.className = "pending-id";
  const cover = document.createElement("div");
  cover.className = "pending-cover";
  cover.append(coverInner(item, "22px"));
  const info = document.createElement("div");
  info.className = "game-info";
  const meta = document.createElement("div");
  meta.className = "game-meta";
  meta.textContent = gameMeta(item);
  info.append(nameRow(item), meta);
  const badges = platformBadges(item);
  if (badges) info.append(badges);
  const tags = tagChips(item);
  if (tags) info.append(tags);
  if (item.addedBy) {
    const prop = document.createElement("div");
    prop.className = "game-proposer";
    const av = avatarEl(item.addedBy, plainName(board, item.addedBy), "av", photoURLFor(board, item.addedBy));
    prop.append(av, document.createTextNode(`Proposed by ${plainName(board, item.addedBy)}`));
    info.append(prop);
  }
  left.append(cover, info);

  const right = document.createElement("div");
  right.className = "pending-actions";
  const voteRow = document.createElement("div");
  voteRow.className = "vote-row";
  voteRow.append(voteButton(item, "up"), voteButton(item, "down"));
  if (canEdit()) {
    voteRow.append(miniBtn("pencil", "Edit game", () => openEditGame(item)), miniBtn("x", "Delete game", () => deleteGame(item.id)));
  }
  right.append(voteRow);

  top.append(left, right);
  card.append(top);

  const need = majority(board);
  const up = countVotes(item, "up");
  const prog = document.createElement("div");
  prog.className = "progress-wrap";
  const head = document.createElement("div");
  head.className = "progress-head";
  const lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = up >= need ? "Ready for rotation" : `Needs ${need - up} more yes vote${need - up === 1 ? "" : "s"}`;
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
  prog.append(head, track);

  const waiting = memberIdsOf(board).filter((uid) => item.approvals?.[uid] === undefined);
  if (waiting.length) {
    const row = document.createElement("div");
    row.className = "waiting-row";
    const txt = document.createElement("span");
    txt.textContent = "Still waiting on";
    const avs = document.createElement("div");
    avs.className = "avs";
    waiting.slice(0, 4).forEach((uid) => {
      avs.append(avatarEl(uid, plainName(board, uid), "av", photoURLFor(board, uid)));
    });
    row.append(txt, avs);
    if (canEdit()) {
      const nudge = document.createElement("button");
      nudge.type = "button";
      nudge.className = "nudge-btn";
      nudge.append(icon("bell", { size: 12 }), document.createTextNode("Nudge"));
      nudge.addEventListener("click", () => nudgeCrew(item));
      row.append(nudge);
    }
    prog.append(row);
  }

  card.append(prog);
  makeDraggable(card, item);
  return card;
}
function rejectedCard(item) {
  const card = document.createElement("div");
  card.className = "rejected-card";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = item.title;
  card.append(name);
  const chip = variantChip(item, "10px");
  if (chip) {
    chip.style.color = "#6b6d85";
    chip.style.background = "#ffffff0a";
    card.append(chip);
  }
  const down = document.createElement("span");
  down.className = "down";
  down.append(icon("thumbs-down", { size: 12 }), document.createTextNode(String(countVotes(item, "down"))));
  card.append(down);
  if (canEdit()) {
    const revive = document.createElement("button");
    revive.type = "button";
    revive.title = "Revive - vote yes";
    revive.className = "revive-btn";
    revive.append(icon("rotate-ccw", { size: 12 }), document.createTextNode("revive"));
    revive.addEventListener("click", () => setVote(item.id, "up"));
    card.append(revive);
    card.append(miniBtn("x", "Delete game", () => deleteGame(item.id)));
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
      text: `${displayName()} nudged the crew to vote on ${item.title}.`,
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
  const spark = icon("dices", { size: 22 });
  const text = document.createElement("span");
  text.append(document.createTextNode("The wheel says... "));
  const b = document.createElement("b");
  b.textContent = pick.title;
  text.append(b, document.createTextNode(" tonight!"));
  elements.wheelResult.append(spark, text);
}

function confirmTonight(game) {
  if (!game) return;
  updateActiveBoard((board) => {
    board.messages = board.messages ?? [];
    board.messages.push({
      id: crypto.randomUUID(),
      author: "Huddle Game Hub",
      authorUid: null,
      text: `${displayName()} confirmed ${game.title} for tonight.`,
      createdAt: new Date().toISOString()
    });
  });
  showToast(`${game.title} confirmed for tonight`);
}

function sendReminder(game, session) {
  updateActiveBoard((board) => {
    board.messages = board.messages ?? [];
    const parts = ["Reminder:"];
    if (game) parts.push(`${game.title}`);
    if (session) parts.push(`${session.date} at ${session.start || "time TBD"}`);
    board.messages.push({
      id: crypto.randomUUID(),
      author: "Huddle Game Hub",
      authorUid: null,
      text: `${displayName()} sent a ${parts.join(" ")}.`,
      createdAt: new Date().toISOString()
    });
  });
  showToast("Reminder posted to chat");
}

// ---------- propose / edit game ----------
function renderPlatformPicker() {
  elements.pgPlatforms.replaceChildren(
    ...PLATFORMS.map((p) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "platform-opt";
      chip.dataset.platform = p;
      chip.textContent = p;
      return chip;
    })
  );
}

function renderTagPicker() {
  elements.pgTags.replaceChildren(
    ...GAME_TAGS.map((t) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "platform-opt";
      chip.dataset.tag = t;
      chip.textContent = t;
      return chip;
    })
  );
}

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

function selectedTags() {
  return [...elements.pgTags.querySelectorAll(".platform-opt.selected")].map((c) => c.dataset.tag);
}

function clearTagPicker() {
  elements.pgTags.querySelectorAll(".selected").forEach((c) => c.classList.remove("selected"));
}

// Catalog match picked during the current propose/edit session. undefined =
// no change (edit keeps the game's existing match); null = explicitly
// cleared; { id, name, coverImageUrl, genre, platforms } = newly picked from
// search. Clearing or picking a new match always supersedes any legacy
// steamAppId a game might have had before catalog search existed.
let pgCatalogPick;
let catalogSearchTimer = null;
let catalogSearchToken = 0;

function resolveCatalogFields(existing) {
  if (pgCatalogPick === undefined) {
    return {
      catalogId: existing?.catalogId ?? null,
      coverImageUrl: existing?.coverImageUrl ?? null,
      genre: existing?.genre ?? "",
      steamAppId: existing?.steamAppId ?? null
    };
  }
  if (!pgCatalogPick) return { catalogId: null, coverImageUrl: null, genre: "", steamAppId: null };
  return {
    catalogId: pgCatalogPick.id,
    coverImageUrl: pgCatalogPick.coverImageUrl,
    genre: pgCatalogPick.genre || "",
    steamAppId: null
  };
}

function clearCatalogMatch() {
  catalogSearchToken += 1; // invalidate any in-flight search from before this reset
  elements.pgCatalogLoading.classList.add("hidden");
  elements.pgCatalogPicked.classList.add("hidden");
  elements.pgCatalogPicked.replaceChildren();
}

function showCatalogPicked(pick) {
  catalogSearchToken += 1; // invalidate any in-flight search now that a match is set
  elements.pgCatalogLoading.classList.add("hidden");
  elements.pgCatalogSuggest.classList.add("hidden");
  elements.pgCatalogSuggest.replaceChildren();

  elements.pgCatalogPicked.classList.remove("hidden");
  const info = document.createElement("div");
  info.className = "catalog-linked-info";
  if (pick.coverImageUrl) {
    const img = document.createElement("img");
    img.src = pick.coverImageUrl;
    img.alt = "";
    info.append(img);
  }
  const label = document.createElement("span");
  label.textContent = `Matched: ${pick.name}`;
  info.append(label);

  const unlink = document.createElement("button");
  unlink.type = "button";
  unlink.className = "mini-btn";
  unlink.title = "Clear match";
  unlink.textContent = "✕";
  unlink.addEventListener("click", () => {
    pgCatalogPick = null;
    clearCatalogMatch();
  });
  elements.pgCatalogPicked.replaceChildren(info, unlink);
}

function applySuggestedPlatforms(platforms) {
  if (!platforms?.length) return;
  elements.pgPlatforms.querySelectorAll(".platform-opt").forEach((c) => {
    if (platforms.includes(c.dataset.platform)) paintPlatform(c, true);
  });
}

async function renderCatalogSuggestions(query) {
  const q = query.trim();
  if (q.length < 2) {
    elements.pgCatalogLoading.classList.add("hidden");
    elements.pgCatalogSuggest.classList.add("hidden");
    elements.pgCatalogSuggest.replaceChildren();
    return;
  }

  const token = ++catalogSearchToken;
  elements.pgCatalogLoading.classList.remove("hidden");
  let results;
  try {
    results = await searchCatalog(store.services?.functions, q);
  } catch (error) {
    console.error("Catalog search failed", error);
    if (token === catalogSearchToken) elements.pgCatalogLoading.classList.add("hidden");
    return;
  }
  if (token !== catalogSearchToken) return; // a newer search superseded this one
  elements.pgCatalogLoading.classList.add("hidden");

  elements.pgCatalogSuggest.classList.remove("hidden");
  if (!results.length) {
    elements.pgCatalogSuggest.replaceChildren(emptyState("No matches — you can still add this as a custom title"));
    return;
  }
  elements.pgCatalogSuggest.replaceChildren(
    ...results.map((game) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "catalog-suggest-item";
      if (game.coverImageUrl) {
        const img = document.createElement("img");
        img.src = game.coverImageUrl;
        img.alt = "";
        img.loading = "lazy";
        opt.append(img);
      }
      opt.append(document.createTextNode(game.name));
      opt.addEventListener("click", () => {
        pgCatalogPick = game;
        elements.pgTitle.value = game.name;
        showCatalogPicked(game);
        applySuggestedPlatforms(game.platforms);
      });
      return opt;
    })
  );
}

export function openProposeGame() {
  if (!canEdit()) {
    showToast("You don't have edit access on this board");
    return;
  }
  store.editingGameId = null;
  elements.proposeGameForm.reset();
  clearPlatformPicker();
  clearTagPicker();
  pgCatalogPick = undefined;
  clearCatalogMatch();
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
  elements.pgTags.querySelectorAll(".platform-opt").forEach((c) => {
    c.classList.toggle("selected", (game.tags || []).includes(c.dataset.tag));
  });
  pgCatalogPick = undefined;
  const existingCoverUrl =
    game.coverImageUrl || (game.steamAppId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg` : null);
  if (game.catalogId || game.steamAppId) showCatalogPicked({ name: game.title, coverImageUrl: existingCoverUrl });
  else clearCatalogMatch();
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
  renderPlatformPicker();
  renderTagPicker();

  bindDropZone(elements.rotationList, "rotation", "In Rotation");
  bindDropZone(elements.pendingList, "maybe", "Pending Vote");

  elements.spinButton.addEventListener("click", spinWheel);
  elements.proposeGameButton.addEventListener("click", openProposeGame);

  elements.pgPlatforms.addEventListener("click", (event) => {
    const chip = event.target.closest(".platform-opt");
    if (chip) paintPlatform(chip, !chip.classList.contains("selected"));
  });

  elements.pgTags.addEventListener("click", (event) => {
    const chip = event.target.closest(".platform-opt");
    if (chip) chip.classList.toggle("selected");
  });

  elements.pgTitle.addEventListener("input", () => {
    if (pgCatalogPick) {
      pgCatalogPick = null;
      clearCatalogMatch();
    }
    clearTimeout(catalogSearchTimer);
    const query = elements.pgTitle.value;
    catalogSearchTimer = setTimeout(() => renderCatalogSuggestions(query), 350);
  });
  elements.pgTitle.addEventListener("blur", () => {
    setTimeout(() => elements.pgCatalogSuggest.classList.add("hidden"), 150);
  });

  elements.proposeGameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    const title = elements.pgTitle.value.trim();
    if (!title) return;
    const variant = elements.pgVariant.value.trim();
    const players = elements.pgPlayers.value.trim();
    const platforms = selectedPlatforms().filter((p) => PLATFORMS.includes(p));
    const tags = selectedTags().filter((t) => GAME_TAGS.includes(t));

    if (store.editingGameId) {
      const id = store.editingGameId;
      updateActiveBoard((board) => {
        const g = board.games.find((x) => x.id === id);
        if (!g) return;
        g.title = title;
        g.variant = variant;
        g.players = players;
        g.platforms = platforms;
        g.tags = tags;
        Object.assign(g, resolveCatalogFields(g));
      });
      closeModal();
      showToast("Game updated");
      return;
    }

    updateActiveBoard((board) => {
      board.games.push({
        id: crypto.randomUUID(),
        title,
        variant,
        players,
        platforms,
        tags,
        status: "maybe",
        approvals: { [store.currentUser.uid]: "up" },
        addedBy: store.currentUser.uid,
        createdAt: new Date().toISOString(),
        ...resolveCatalogFields(null)
      });
    });
    closeModal();
    showToast(`${title} added to Pending`);
  });
}

