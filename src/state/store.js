// Shared mutable application state, persistence, and a tiny render bus that lets
// feature modules trigger a re-render without importing each other.

import { STORAGE_KEY } from "../utils/constants.js";
import { defaultState } from "../data/default-state.js";
import { saveBoard } from "../services/boards-repository.js";
import { normalizeBoard } from "../features/boards/board-model.js";

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(stored);
    if (!parsed.boards?.length) return structuredClone(defaultState);
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

export const store = {
  state: loadState(),
  services: null,
  currentUser: null,
  unsubscribeBoards: null,
  isApplyingCloudState: false,

  // view / UI state
  view: "dashboard", // "dashboard" | "board"
  boardTab: "roster", // "roster" | "schedule"
  chatCollapsed: false,
  modal: null, // null | "proposeGame" | "invite" | "proposeTime" | "createBoard"
  notifOpen: false,
  profileOpen: false,
  wheelPick: null,
  createDraft: { emoji: "🎮", accent: "#7c5cff" }
};

export function activeBoard() {
  return store.state.boards.find((b) => b.id === store.state.activeBoardId) ?? store.state.boards[0] ?? null;
}

export function boardById(boardId) {
  return store.state.boards.find((b) => b.id === boardId) ?? null;
}

export function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
}

// Push a single board to the cloud. Safe to call for any board the user can write.
export function pushBoard(board) {
  if (!store.services || !store.currentUser || store.isApplyingCloudState || !board) return;
  saveBoard(store.services.db, normalizeBoard(board), store.currentUser.uid).catch((error) => {
    console.error("Failed to sync board", error);
  });
}

export function saveState(options = {}) {
  saveLocal();
  if (!options.skipCloud) pushBoard(activeBoard());
}

// Mutate the active board, persist, and re-render. The common write path.
export function updateActiveBoard(updater) {
  const board = activeBoard();
  if (!board) return;
  updater(board);
  saveState();
  render();
}

// --- render bus ---
let renderHandler = () => {};

export function setRenderHandler(handler) {
  renderHandler = handler;
}

export function render() {
  renderHandler();
}
