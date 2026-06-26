import { store, activeBoard, saveState, render } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import { normalizeBoard, currentProfile, isAdmin, canEdit } from "./board-model.js";
import { game } from "../../data/default-state.js";
import { deleteBoard, saveBoard } from "../../services/boards-repository.js";

export function renderBoards() {
  elements.boardList.replaceChildren(
    ...store.state.boards.map((board) => {
      const games = board.games ?? [];
      const memberCount = Object.keys(board.members ?? {}).length;
      const button = document.createElement("button");
      button.className = `board-tab${board.id === store.state.activeBoardId ? " active" : ""}`;
      button.type = "button";
      button.innerHTML = `<strong></strong><span></span>`;
      button.querySelector("strong").textContent = board.name;
      button.querySelector("span").textContent = `${games.length} games · ${memberCount} crew`;
      button.addEventListener("click", () => {
        store.state.activeBoardId = board.id;
        saveState({ skipCloud: true });
        render();
      });
      return button;
    })
  );
}

function createBoard(name) {
  const board = normalizeBoard({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    members: { [store.currentUser.uid]: "admin" },
    memberProfiles: { [store.currentUser.uid]: currentProfile() },
    reads: {},
    games: [],
    schedule: [],
    messages: []
  });
  store.state.boards.unshift(board);
  store.state.activeBoardId = board.id;
  saveState();
  render();
}

async function handleDelete() {
  if (!isAdmin()) return;
  const removedBoardId = store.state.activeBoardId;

  if (store.state.boards.length === 1) {
    store.state.boards = [
      normalizeBoard({
        id: crypto.randomUUID(),
        name: "Fresh huddle",
        createdAt: new Date().toISOString(),
        members: { [store.currentUser.uid]: "admin" },
        memberProfiles: { [store.currentUser.uid]: currentProfile() },
        reads: {},
        games: [],
        schedule: [],
        messages: []
      })
    ];
    store.state.activeBoardId = store.state.boards[0].id;
  } else {
    store.state.boards = store.state.boards.filter((board) => board.id !== removedBoardId);
    store.state.activeBoardId = store.state.boards[0].id;
  }

  await deleteBoard(store.services.db, store.currentUser.uid, removedBoardId);
  await saveBoard(store.services.db, normalizeBoard(activeBoard()), store.currentUser.uid);
  saveState();
  render();
}

export function bindBoardEvents() {
  elements.boardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createBoard(elements.boardName.value.trim());
    elements.boardForm.reset();
  });

  elements.activeBoardName.addEventListener("input", () => {
    if (!isAdmin()) return;
    activeBoard().name = elements.activeBoardName.value.trim() || "Untitled huddle";
    saveState();
    renderBoards();
  });

  elements.deleteBoardButton.addEventListener("click", handleDelete);

  elements.seedButton.addEventListener("click", () => {
    if (!canEdit()) return;
    const board = activeBoard();
    board.games.push(game("Helldivers 2", "Co-op Shooter", ["PC", "PS5"], "maybe"));
    board.games.push(game("Stardew Valley", "Farming Sim", ["PC", "Switch", "Mobile"], "rotation"));
    board.schedule.push({
      id: crypto.randomUUID(),
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      start: "19:30",
      end: "21:00",
      activity: "Co-op night"
    });
    board.messages.push({
      id: crypto.randomUUID(),
      author: "Huddle",
      authorUid: null,
      text: "Added a couple of sample games to get rolling.",
      createdAt: new Date().toISOString()
    });
    saveState();
    render();
  });
}
