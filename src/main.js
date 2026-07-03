import "./assets/styles.css";

import { store, activeBoard, saveLocal, setRenderHandler } from "./state/store.js";
import { elements } from "./state/dom.js";
import { getFirebaseServices } from "./services/firebase-service.js";
import { watchAuthState, signOutUser } from "./services/auth-service.js";
import { subscribeToUserBoards, saveBoard, ensureMemberProfile } from "./services/boards-repository.js";
import { getPendingInvites, acceptInvite } from "./services/invites-repository.js";
import { normalizeBoard, currentProfile, memberIdsOf, canManage } from "./features/boards/board-model.js";
import { renderAccount, setAuthError, setAuthNotice, bindAuthEvents } from "./features/auth/auth.js";
import { bindShellEvents, renderTabs, showToast, showInviteNotifications } from "./features/shell/shell.js";
import { renderRail, renderDashboard, bindBoardEvents } from "./features/boards/board-list.js";
import { renderRoster, bindGameEvents } from "./features/games/games.js";
import { renderSchedule, bindScheduleEvents } from "./features/schedule/schedule.js";
import { renderHeaderAvatars, bindCrewEvents } from "./features/crew/crew.js";
import { renderChat, bindChatEvents } from "./features/chat/chat.js";
import { renderCommonGames, bindSteamEvents } from "./features/steam/steam.js";
import { updateTitleBadge, notifyIncoming, bindNotificationEvents } from "./features/notifications/notifications.js";
import { enablePush } from "./services/push-service.js";
import { hydrateIcons } from "./utils/icons.js";
import { renderTonightPanel, bindTonightEvents } from "./features/tonight/tonight.js";

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

  updateTitleBadge();
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
  elements.boardSettingsButton.classList.toggle("hidden", !canManage());

  renderHeaderAvatars(board);
  renderTonightPanel(board);
  renderTabs();
  if (store.boardTab === "roster") {
    renderRoster(board);
    renderCommonGames(board);
  } else {
    renderSchedule(board);
  }
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

  // Refresh this device's push token if the user already granted permission.
  enablePush(store.services, user.uid, { silent: true }).catch(() => {});

  getPendingInvites(store.services.functions)
    .then((pending) => {
      if (!pending.length) return;

      // Check if the user arrived via an email accept link (?acceptInvite=boardId).
      const params = new URLSearchParams(window.location.search);
      const autoAcceptId = params.get("acceptInvite");
      if (autoAcceptId) {
        window.history.replaceState({}, "", window.location.pathname);
        const target = pending.find((i) => i.boardId === autoAcceptId);
        if (target) {
          acceptInvite(store.services.functions, target.boardId)
            .then(() => showToast(`You joined ${target.boardName}!`))
            .catch((err) => console.error("Auto-accept failed", err));
          return;
        }
      }

      showInviteNotifications(pending, (invite) =>
        acceptInvite(store.services.functions, invite.boardId).then(() =>
          showToast(`You joined ${invite.boardName}!`)
        )
      );
    })
    .catch((error) => console.error("Failed to load invites", error));

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
    notifyIncoming();
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
  hydrateIcons();
  bindAuthEvents();
  bindShellEvents();
  bindBoardEvents();
  bindGameEvents();
  bindScheduleEvents();
  bindCrewEvents();
  bindChatEvents();
  bindSteamEvents();
  bindNotificationEvents();
  bindTonightEvents();
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
