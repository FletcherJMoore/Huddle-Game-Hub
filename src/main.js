import "./assets/styles.css";

import { store, activeBoard, saveLocal, setRenderHandler } from "./state/store.js";
import { elements } from "./state/dom.js";
import { getFirebaseServices } from "./services/firebase-service.js";
import { watchAuthState, signOutUser } from "./services/auth-service.js";
import { subscribeToUserBoards, saveBoard, ensureMemberProfile } from "./services/boards-repository.js";
import { claimInvites } from "./services/invites-repository.js";
import { normalizeBoard, currentProfile } from "./features/boards/board-model.js";
import { renderAccount, setAuthError, setAuthNotice, bindAuthEvents } from "./features/auth/auth.js";
import { renderView, renderPermissions, bindShellEvents } from "./features/shell/shell.js";
import { renderBoards, bindBoardEvents } from "./features/boards/board-list.js";
import { renderGames, bindGameEvents, approvalScore, countVotes } from "./features/games/games.js";
import { renderSchedule, bindScheduleEvents } from "./features/schedule/schedule.js";
import { renderCrew, bindCrewEvents } from "./features/crew/crew.js";
import { renderChat, bindChatEvents } from "./features/chat/chat.js";
import { sortSchedule, formatShortDate } from "./utils/format.js";

// Lightweight transient banner for one-off confirmations (e.g. "you joined X").
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "app-toast";
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showAuthScreen() {
  elements.authScreen.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
}

function showPlanner() {
  elements.authScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
}

// Top-level render: refreshes every feature against the active board.
function renderPlanner() {
  if (!store.currentUser) return;

  const board = activeBoard();
  store.state.activeBoardId = board.id;
  const memberIds = board.memberIds ?? Object.keys(board.members ?? {});

  renderAccount();
  renderView();
  renderPermissions();
  renderBoards();

  // Don't overwrite the title while the user is editing it (live updates can
  // otherwise yank the field mid-keystroke).
  if (document.activeElement !== elements.activeBoardName) {
    elements.activeBoardName.value = board.name;
  }
  elements.boardMeta.textContent = `${board.games.length} games · ${memberIds.length} crew · ${board.messages.length} messages`;

  const rotationCount = board.games.filter((item) => item.status === "rotation").length;
  elements.rotationCount.textContent = `${rotationCount} ${rotationCount === 1 ? "game" : "games"}`;

  const topPick = [...board.games]
    .filter((item) => item.status === "maybe")
    .sort((a, b) => approvalScore(b) - approvalScore(a))[0];
  elements.topActivity.textContent =
    topPick && approvalScore(topPick) > 0 ? `${topPick.title} (👍 ${countVotes(topPick, "up")})` : "No votes yet";

  const next = sortSchedule(board.schedule)[0];
  elements.nextEvent.textContent = next ? `${next.activity} · ${formatShortDate(next.date)}` : "Not scheduled";
  elements.peopleCount.textContent = `${memberIds.length} ${memberIds.length === 1 ? "member" : "members"}`;

  renderGames(board);
  renderSchedule(board);
  renderCrew(board);
  renderChat();
}

async function uploadLocalBoardsForUser() {
  const boards = store.state.boards.map((board) => normalizeBoard(board));
  await Promise.all(boards.map((board) => saveBoard(store.services.db, board, store.currentUser.uid)));
}

// Make sure co-members can see our current name without forcing a full re-save.
function syncOwnProfiles() {
  if (!store.services || !store.currentUser) return;
  const profile = currentProfile();
  store.state.boards.forEach((board) => {
    const stored = board.memberProfiles?.[store.currentUser.uid];
    if (!stored || stored.name !== profile.name || stored.email !== profile.email) {
      ensureMemberProfile(store.services.db, board.id, store.currentUser.uid, profile).catch(() => {});
    }
  });
}

async function handleAuthenticatedUser(user) {
  if (!user.emailVerified) {
    await signOutUser(store.services.auth);
    setAuthNotice("Please verify your email before logging in. Check your inbox for the verification link.");
    return;
  }

  store.currentUser = user;
  showPlanner();
  renderAccount();

  // Join any boards this user was invited to by email. Newly joined boards
  // stream in through the boards subscription below.
  claimInvites(store.services.functions)
    .then((joined) => {
      if (joined.length) {
        const names = joined.map((board) => board.boardName).join(", ");
        showToast(`You were added to ${names}.`);
      }
    })
    .catch((error) => console.error("Failed to claim invites", error));

  if (store.unsubscribeBoards) store.unsubscribeBoards();

  store.unsubscribeBoards = subscribeToUserBoards(store.services.db, user.uid, async (boards) => {
    if (!boards.length) {
      await uploadLocalBoardsForUser();
      return;
    }

    store.isApplyingCloudState = true;
    store.state.boards = boards.map((board) => normalizeBoard(board));
    if (!store.state.boards.some((board) => board.id === store.state.activeBoardId)) {
      store.state.activeBoardId = store.state.boards[0].id;
    }
    if (!store.state.boards.some((board) => board.id === store.chat.activeBoardId)) {
      store.chat.activeBoardId = store.state.boards[0].id;
    }
    saveLocal();
    store.isApplyingCloudState = false;
    renderPlanner();
    syncOwnProfiles();
  });
}

function handleSignedOutUser() {
  store.currentUser = null;
  store.chat.open = false;
  elements.chatDrawer.classList.add("hidden");
  elements.chatBackdrop.classList.add("hidden");
  if (store.unsubscribeBoards) {
    store.unsubscribeBoards();
    store.unsubscribeBoards = null;
  }
  showAuthScreen();
}

function startApp() {
  bindAuthEvents();
  bindShellEvents();
  bindBoardEvents();
  bindGameEvents();
  bindScheduleEvents();
  bindCrewEvents();
  bindChatEvents();
  setRenderHandler(renderPlanner);

  try {
    store.services = getFirebaseServices();
    watchAuthState(store.services.auth, (user) => {
      if (user) {
        handleAuthenticatedUser(user);
      } else {
        handleSignedOutUser();
      }
    });
  } catch (error) {
    showAuthScreen();
    setAuthError("Firebase is not configured yet. Check your .env values.");
  }
}

startApp();
