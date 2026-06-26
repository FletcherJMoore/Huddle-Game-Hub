import "./assets/styles.css";

import { store, activeBoard, saveLocal, setRenderHandler } from "./state/store.js";
import { elements } from "./state/dom.js";
import { getFirebaseServices } from "./services/firebase-service.js";
import { watchAuthState, signOutUser } from "./services/auth-service.js";
import { subscribeToUserBoards, saveBoard, ensureMemberProfile } from "./services/boards-repository.js";
import { claimInvites } from "./services/invites-repository.js";
import { normalizeBoard, currentProfile, memberIdsOf } from "./features/boards/board-model.js";
import { renderAccount, setAuthError, setAuthNotice, bindAuthEvents } from "./features/auth/auth.js";
import { bindShellEvents, renderTabs, showToast } from "./features/shell/shell.js";
import { renderRail, renderDashboard, bindBoardEvents } from "./features/boards/board-list.js";
import { renderRoster, bindGameEvents } from "./features/games/games.js";
import { renderSchedule, bindScheduleEvents } from "./features/schedule/schedule.js";
import { renderHeaderAvatars, bindCrewEvents } from "./features/crew/crew.js";
import { renderChat, bindChatEvents } from "./features/chat/chat.js";

let lastBoardId = null;

// Top-level render: routes between auth / dashboard / board.
function renderApp() {
  if (!store.currentUser) {
    elements.authScreen.classList.remove("hidden");
    elements.appRoot.classList.add("hidden");
    return;
  }

  elements.authScreen.classList.add("hidden");
  elements.appRoot.classList.remove("hidden");
  renderAccount();

  const board = activeBoard();
  const onBoard = store.view === "board" && Boolean(board);

  elements.dashboardScreen.classList.toggle("hidden", onBoard);
  elements.boardScreen.classList.toggle("hidden", !onBoard);

  if (onBoard) {
    store.state.activeBoardId = board.id;
    renderBoard(board);
  } else {
    store.view = "dashboard";
    renderDashboard();
  }
}

function renderBoard(board) {
  if (lastBoardId !== board.id) {
    elements.wheelResult.classList.add("hidden");
    lastBoardId = board.id;
  }

  renderRail();

  const count = memberIdsOf(board).length;
  elements.boardEmoji.textContent = board.emoji;
  elements.boardName.textContent = board.name;
  elements.boardSubtitle.textContent = `${count} ${count === 1 ? "member" : "members"} · ${board.games.length} games`;
  elements.boardOnline.textContent = `● ${count} online`;

  renderHeaderAvatars(board);
  renderTabs();
  if (store.boardTab === "roster") renderRoster(board);
  else renderSchedule(board);
  renderChat(board);
}

async function uploadLocalBoardsForUser() {
  const boards = store.state.boards.map((board) => normalizeBoard(board));
  await Promise.all(boards.map((board) => saveBoard(store.services.db, board, store.currentUser.uid)));
}

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
  renderApp();

  claimInvites(store.services.functions)
    .then((joined) => {
      if (joined.length) showToast(`You were added to ${joined.map((b) => b.boardName).join(", ")}.`);
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
    saveLocal();
    store.isApplyingCloudState = false;
    renderApp();
    syncOwnProfiles();
  });
}

function handleSignedOutUser() {
  store.currentUser = null;
  store.view = "dashboard";
  if (store.unsubscribeBoards) {
    store.unsubscribeBoards();
    store.unsubscribeBoards = null;
  }
  renderApp();
}

function startApp() {
  bindAuthEvents();
  bindShellEvents();
  bindBoardEvents();
  bindGameEvents();
  bindScheduleEvents();
  bindCrewEvents();
  bindChatEvents();
  setRenderHandler(renderApp);

  try {
    store.services = getFirebaseServices();
    watchAuthState(store.services.auth, (user) => {
      if (user) handleAuthenticatedUser(user);
      else handleSignedOutUser();
    });
  } catch (error) {
    console.error(error);
    renderApp();
    setAuthError("Firebase is not configured yet. Check your .env values.");
  }
}

startApp();
