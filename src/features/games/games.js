import { store, activeBoard, updateActiveBoard } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { BUCKETS } from "../../utils/constants.js";
import { canEdit, memberName } from "../boards/board-model.js";
import { emptyState } from "../../components/empty-state.js";
import { initialsFor } from "../../utils/format.js";
import { toggleForm, removeById } from "../../utils/dom.js";

export function countVotes(item, kind) {
  return Object.values(item.approvals ?? {}).filter((value) => value === kind).length;
}

export function approvalScore(item) {
  return countVotes(item, "up") - countVotes(item, "down");
}

export function renderGames(board) {
  BUCKETS.forEach((bucket) => {
    const games = board.games
      .filter((item) => item.status === bucket.key)
      .sort((a, b) => approvalScore(b) - approvalScore(a) || a.title.localeCompare(b.title));
    const cards = games.map((item) => gameCard(board, item));
    const emptyText =
      bucket.key === "rotation"
        ? "Nothing in rotation yet"
        : bucket.key === "maybe"
          ? "No games up for debate"
          : "No hard passes (yet)";
    elements[bucket.listId].replaceChildren(...(cards.length ? cards : [emptyState(emptyText)]));
  });
}

function gameCard(board, item) {
  const card = document.createElement("article");
  card.className = `game-card status-${item.status}`;

  const info = document.createElement("div");
  info.className = "game-info";
  const title = document.createElement("strong");
  title.className = "game-title";
  title.textContent = item.title;
  info.append(title);

  const tags = document.createElement("div");
  tags.className = "game-tags";
  if (item.genre) {
    const genre = document.createElement("span");
    genre.className = "genre-chip";
    genre.textContent = item.genre;
    tags.append(genre);
  }
  if (item.platforms.length) {
    item.platforms.forEach((platform) => {
      const tag = document.createElement("span");
      tag.className = "platform-tag";
      tag.textContent = platform;
      tags.append(tag);
    });
  } else {
    const tag = document.createElement("span");
    tag.className = "platform-tag muted";
    tag.textContent = "Platform?";
    tags.append(tag);
  }
  info.append(tags);
  card.append(info);

  const side = document.createElement("div");
  side.className = "game-side";
  side.append(approvalRow(board, item));

  const actions = document.createElement("div");
  actions.className = "game-actions";
  if (canEdit()) {
    const select = document.createElement("select");
    select.className = "status-select";
    select.setAttribute("aria-label", "Move game");
    BUCKETS.forEach((bucket) => {
      const option = document.createElement("option");
      option.value = bucket.key;
      option.textContent = bucket.label;
      if (bucket.key === item.status) option.selected = true;
      select.append(option);
    });
    select.addEventListener("change", () => {
      updateActiveBoard((draft) => {
        const target = draft.games.find((game) => game.id === item.id);
        if (target) target.status = select.value;
      });
    });
    actions.append(select);

    const remove = document.createElement("button");
    remove.className = "icon-button delete-item";
    remove.type = "button";
    remove.title = "Delete";
    remove.setAttribute("aria-label", "Delete game");
    remove.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>`;
    remove.addEventListener("click", () => {
      updateActiveBoard((draft) => removeById(draft.games, item.id));
    });
    actions.append(remove);
  }
  side.append(actions);
  card.append(side);

  return card;
}

function approvalRow(board, item) {
  const wrap = document.createElement("div");
  wrap.className = "approvals";

  const chips = document.createElement("div");
  chips.className = "approval-chips";
  board.memberIds.forEach((uid) => {
    const vote = item.approvals?.[uid] ?? "none";
    const isSelf = uid === store.currentUser?.uid;
    const interactive = isSelf && canEdit();
    const name = memberName(board, uid);
    const chip = document.createElement(interactive ? "button" : "span");
    chip.className = `approval-chip ${vote}${isSelf ? " self" : ""}`;
    chip.textContent = initialsFor(name);
    chip.title = `${name} — ${vote === "up" ? "👍 in" : vote === "down" ? "👎 out" : "no vote"}`;
    if (interactive) {
      chip.type = "button";
      chip.addEventListener("click", () => cycleVote(item.id, uid));
    }
    chips.append(chip);
  });
  wrap.append(chips);

  const tally = document.createElement("span");
  tally.className = "approval-tally";
  tally.textContent = `👍 ${countVotes(item, "up")} · 👎 ${countVotes(item, "down")}`;
  wrap.append(tally);

  return wrap;
}

function cycleVote(gameId, uid) {
  const order = { none: "up", up: "down", down: "none" };
  updateActiveBoard((draft) => {
    const target = draft.games.find((game) => game.id === gameId);
    if (!target) return;
    target.approvals = target.approvals ?? {};
    const next = order[target.approvals[uid] ?? "none"];
    if (next === "none") delete target.approvals[uid];
    else target.approvals[uid] = next;
  });
}

function selectedPlatforms() {
  return [...elements.gamePlatforms.querySelectorAll(".platform-chip.selected")].map(
    (chip) => chip.dataset.platform
  );
}

function resetGameForm() {
  elements.gameForm.reset();
  elements.gameForm.classList.add("hidden");
  elements.gamePlatforms.querySelectorAll(".platform-chip.selected").forEach((chip) => {
    chip.classList.remove("selected");
  });
}

export function bindGameEvents() {
  elements.addGameButton.addEventListener("click", () => toggleForm(elements.gameForm));

  elements.gamePlatforms.addEventListener("click", (event) => {
    const chip = event.target.closest(".platform-chip");
    if (!chip) return;
    chip.classList.toggle("selected");
  });

  elements.gameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canEdit()) return;
    updateActiveBoard((board) => {
      board.games.push({
        id: crypto.randomUUID(),
        title: elements.gameTitle.value.trim(),
        genre: elements.gameGenre.value.trim(),
        platforms: selectedPlatforms(),
        status: elements.gameStatus.value,
        approvals: {},
        addedBy: store.currentUser.uid,
        createdAt: new Date().toISOString()
      });
    });
    resetGameForm();
  });
}
