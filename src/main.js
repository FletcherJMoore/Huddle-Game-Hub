import "./assets/styles.css";

import { store, activeBoard, saveLocal, setRenderHandler } from "./state/store.js";
import { elements } from "./state/dom.js";
import { getFirebaseServices } from "./services/firebase-service.js";
import { watchAuthState, signOutUser } from "./services/auth-service.js";
import { subscribeToUserBoards, ensureMemberProfile } from "./services/boards-repository.js";
import { getPendingInvites, acceptInvite } from "./services/invites-repository.js";
import { normalizeBoard, currentProfile, memberIdsOf, canManage, canonicalRole } from "./features/boards/board-model.js";
import { formatShortDate, sessionTimeLabel, sortSchedule } from "./utils/format.js";
import { renderAccount, setAuthError, setAuthNotice, bindAuthEvents } from "./features/auth/auth.js";
import { bindShellEvents, renderTabs, showToast } from "./features/shell/shell.js";
import { renderRail, renderDashboard, bindBoardEvents, paintBoardIcon } from "./features/boards/board-list.js";
import { renderRoster, bindGameEvents } from "./features/games/games.js";
import { renderSchedule, bindScheduleEvents } from "./features/schedule/schedule.js";
import { renderHeaderAvatars, bindCrewEvents } from "./features/crew/crew.js";
import { renderChat, bindChatEvents } from "./features/chat/chat.js";
import { renderNotifications, updateTitleBadge, notifyIncoming, bindNotificationEvents } from "./features/notifications/notifications.js";
import { renderProfile, bindProfileEvents } from "./features/profile/profile.js";
import { enablePush } from "./services/push-service.js";
import { hydrateIcons } from "./utils/icons.js";
import { getPrefs } from "./utils/prefs.js";

let lastBoardId = null;

// Tracks which board ids we've already seen from the live subscription so we can
// toast boards that appear *after* the initial load (e.g. a live invite granted
// while the user is online). Reset on each sign-in.
let knownBoardIds = new Set();
let boardsBaselineSet = false;

// --- 30-minute session timeout with a top-right countdown ---
const SESSION_MS = 30 * 60 * 1000;
let sessionInterval = null;
let sessionExpiry = 0;

function startSessionTimer() {
  sessionExpiry = Date.now() + SESSION_MS;
  elements.sessionTimer.classList.remove("hidden");
  if (sessionInterval) clearInterval(sessionInterval);
  tickSession();
  sessionInterval = setInterval(tickSession, 1000);
}

function stopSessionTimer() {
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = null;
  elements.sessionTimer.classList.add("hidden");
}

function tickSession() {
  const remaining = sessionExpiry - Date.now();
  if (remaining <= 0) {
    stopSessionTimer();
    setAuthNotice("Your session expired after 30 minutes. Please log in again.");
    if (store.services) signOutUser(store.services.auth);
    return;
  }
  const totalSec = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  elements.sessionTimer.textContent = `⏳ ${minutes}:${String(seconds).padStart(2, "0")}`;
  elements.sessionTimer.classList.toggle("warn", remaining <= 5 * 60 * 1000);
}

// Top-level render: routes between auth / dashboard / board.
function renderApp() {
  // Until Firebase reports the initial auth state, show neither screen so the
  // login page doesn't flash for already-signed-in users.
  if (!store.authResolved) {
    elements.authScreen.classList.add("hidden");
    elements.appRoot.classList.add("hidden");
    elements.rail.classList.add("hidden");
    return;
  }

  if (!store.currentUser) {
    elements.authScreen.classList.remove("hidden");
    elements.appRoot.classList.add("hidden");
    elements.rail.classList.add("hidden");
    return;
  }

  elements.authScreen.classList.add("hidden");
  elements.appRoot.classList.remove("hidden");
  elements.rail.classList.remove("hidden");
  renderAccount();
  renderRail();
  renderNotifications();

  const board = activeBoard();
  const onBoard = store.view === "board" && Boolean(board);
  const accentOverride = store.currentUser ? getPrefs(store.currentUser.uid).accentOverride : null;

  elements.dashboardScreen.classList.toggle("hidden", onBoard);
  elements.boardScreen.classList.toggle("hidden", !onBoard);

  if (onBoard) {
    store.state.activeBoardId = board.id;
    setAccent(accentOverride || board.accent);
    renderBoard(board);
  } else {
    store.view = "dashboard";
    setAccent(accentOverride || "#7c5cff");
    renderDashboard();
  }

  // settings modal overlays the active screen
  renderProfile();
  updateTitleBadge();
}

function setAccent(hex) {
  elements.appShell.style.setProperty("--accent", hex || "#7c5cff");
}

function renderBoard(board) {
  if (lastBoardId !== board.id) {
    elements.wheelResult.classList.add("hidden");
    lastBoardId = board.id;
  }

  renderRail();

  const count = memberIdsOf(board).length;
  const pendingGames = (board.games ?? []).filter((game) => game.status === "maybe");
  const rotationGames = (board.games ?? []).filter((game) => game.status === "rotation");
  const topGame = [...rotationGames, ...pendingGames]
    .sort((a, b) => voteScore(b) - voteScore(a) || (a.title || "").localeCompare(b.title || ""))[0];
  const nextSession = nextSessionFor(board);
  paintBoardIcon(elements.boardEmoji, board);
  elements.boardName.textContent = board.name;
  elements.boardSubtitle.textContent = board.subtitle || `${board.games.length} games in the roster`;
  elements.boardOnline.textContent = `● ${count} online`;
  elements.boardMemberLabel.textContent = `${count} ${count === 1 ? "member" : "members"}`;
  elements.boardTopGame.textContent = `Top game: ${topGame?.title || "none yet"}`;
  elements.boardNextNight.textContent = nextSession
    ? `Next night: ${formatShortDate(nextSession.date)} at ${sessionTimeLabel(nextSession.start, nextSession.end)}`
    : "Next night: not planned";
  elements.boardPendingVotes.textContent = `${pendingGames.length} pending ${pendingGames.length === 1 ? "vote" : "votes"}`;
  elements.boardSettingsButton.classList.toggle("hidden", !canManage());

  renderHeaderAvatars(board);
  renderTabs();
  if (store.boardTab === "roster") {
    renderRoster(board);
  } else {
    renderSchedule(board);
  }
  renderChat(board);
}

function voteScore(game) {
  return Object.values(game.approvals ?? {}).reduce((score, vote) => {
    if (vote === "up") return score + 1;
    if (vote === "down") return score - 1;
    return score;
  }, 0);
}

function nextSessionFor(board) {
  const today = new Date().toISOString().slice(0, 10);
  return sortSchedule(board.schedule ?? []).find((session) => `${session.date}` >= today);
}

function syncOwnProfiles() {
  if (!store.services || !store.currentUser) return;
  const profile = currentProfile();
  store.state.boards.forEach((board) => {
    const stored = board.memberProfiles?.[store.currentUser.uid];
    if (
      !stored ||
      stored.name !== profile.name ||
      stored.email !== profile.email ||
      (stored.photoURL ?? null) !== (profile.photoURL ?? null)
    ) {
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
  startSessionTimer();
  renderApp();

  // Refresh this device's push token if the user already granted permission.
  enablePush(store.services, user.uid, { silent: true }).catch(() => {});

  getPendingInvites(store.services.functions)
    .then((pending) => {
      if (!pending.length) return;

      // Clear the email deep-link param if present; every pending invite is
      // auto-accepted below, so it's redundant.
      const params = new URLSearchParams(window.location.search);
      if (params.has("acceptInvite")) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      // Auto-join every board the user was invited to so it's instantly
      // accessible on login — no manual accept step. Membership is granted
      // server-side and the live userBoards subscription streams the board in.
      pending.forEach((invite) => {
        acceptInvite(store.services.functions, invite.boardId)
          .then((res) => showToast(`You joined ${res?.boardName || invite.boardName}!`))
          .catch((err) => console.error("Auto-accept failed", invite.boardId, err));
      });
    })
    .catch((error) => console.error("Failed to load invites", error));

  if (store.unsubscribeBoards) store.unsubscribeBoards();
  knownBoardIds = new Set();
  boardsBaselineSet = false;

  store.unsubscribeBoards = subscribeToUserBoards(store.services.db, user.uid, async (boards) => {
    store.isApplyingCloudState = true;
    store.state.boards = boards.map((board) => normalizeBoard(board));
    if (!store.state.boards.some((board) => board.id === store.state.activeBoardId)) {
      store.state.activeBoardId = store.state.boards[0]?.id ?? null;
    }
    saveLocal();
    store.isApplyingCloudState = false;
    renderApp();
    notifyIncoming();
    syncOwnProfiles();

    // After the first settled load, announce boards that newly appear — a live
    // invite grants membership server-side, which streams the board in here.
    // Skip boards where the user is owner (those are self-created, not invites).
    if (boardsBaselineSet) {
      boards
        .filter((b) => !knownBoardIds.has(b.id) && canonicalRole(b.members?.[user.uid]) !== "owner")
        .forEach((b) => showToast(`You were added to ${b.name}!`));
    }
    knownBoardIds = new Set(boards.map((b) => b.id));
    boardsBaselineSet = true;
  });
}

function handleSignedOutUser() {
  store.currentUser = null;
  store.view = "dashboard";
  stopSessionTimer();
  knownBoardIds = new Set();
  boardsBaselineSet = false;
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
  bindProfileEvents();
  bindNotificationEvents();
  setRenderHandler(renderApp);

  try {
    store.services = getFirebaseServices();
    watchAuthState(store.services.auth, (user) => {
      store.authResolved = true;
      if (user) handleAuthenticatedUser(user);
      else handleSignedOutUser();
    });
  } catch (error) {
    console.error(error);
    store.authResolved = true;
    renderApp();
    setAuthError("Firebase is not configured yet. Check your .env values.");
  }
}

startApp();
