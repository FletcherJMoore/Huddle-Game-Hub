import { getFirebaseServices } from "./services/firebase-service.js";
import {
  createAccountWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  watchAuthState
} from "./services/auth-service.js";
import { deleteBoard, saveBoard, subscribeToUserBoards } from "./services/boards-repository.js";
import { getFriendlyAuthError } from "./utils/firebase-errors.js";

const STORAGE_KEY = "planner-board-state-v2";

const defaultState = {
  activeBoardId: "board-game-night",
  boards: [
    {
      id: "board-game-night",
      name: "Game Night",
      createdAt: new Date().toISOString(),
      members: {},
      memberIds: [],
      schedule: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          start: "20:00",
          end: "22:30",
          activity: "Pick the first co-op game"
        }
      ],
      activities: [
        { id: crypto.randomUUID(), name: "Helldivers run", type: "Game", votes: 3 },
        { id: crypto.randomUUID(), name: "Stardew Valley farm reset", type: "Game", votes: 2 }
      ],
      people: [
        { id: crypto.randomUUID(), name: "Fletcher", status: "Free after 8" },
        { id: crypto.randomUUID(), name: "Sam", status: "Maybe late" }
      ],
      messages: [
        {
          id: crypto.randomUUID(),
          author: "Fletcher",
          text: "Drop ideas here and vote up what sounds good.",
          createdAt: new Date().toISOString()
        }
      ]
    }
  ]
};

let state = loadState();
let services = null;
let currentUser = null;
let unsubscribeBoards = null;
let isApplyingCloudState = false;

const elements = {
  appShell: document.querySelector("#appShell"),
  authScreen: document.querySelector("#authScreen"),
  authError: document.querySelector("#authError"),
  emailAuthForm: document.querySelector("#emailAuthForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  emailSignInButton: document.querySelector("#emailSignInButton"),
  emailSignUpButton: document.querySelector("#emailSignUpButton"),
  googleSignInButton: document.querySelector("#googleSignInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  authStatus: document.querySelector("#authStatus"),
  authDetail: document.querySelector("#authDetail"),
  boardForm: document.querySelector("#boardForm"),
  boardName: document.querySelector("#boardName"),
  boardList: document.querySelector("#boardList"),
  activeBoardName: document.querySelector("#activeBoardName"),
  boardMeta: document.querySelector("#boardMeta"),
  nextEvent: document.querySelector("#nextEvent"),
  topActivity: document.querySelector("#topActivity"),
  peopleCount: document.querySelector("#peopleCount"),
  seedButton: document.querySelector("#seedButton"),
  deleteBoardButton: document.querySelector("#deleteBoardButton"),
  addTimeButton: document.querySelector("#addTimeButton"),
  timeForm: document.querySelector("#timeForm"),
  timeDate: document.querySelector("#timeDate"),
  timeStart: document.querySelector("#timeStart"),
  timeEnd: document.querySelector("#timeEnd"),
  timeActivity: document.querySelector("#timeActivity"),
  scheduleList: document.querySelector("#scheduleList"),
  addActivityButton: document.querySelector("#addActivityButton"),
  activityForm: document.querySelector("#activityForm"),
  activityName: document.querySelector("#activityName"),
  activityType: document.querySelector("#activityType"),
  activityList: document.querySelector("#activityList"),
  addPersonButton: document.querySelector("#addPersonButton"),
  personForm: document.querySelector("#personForm"),
  personName: document.querySelector("#personName"),
  personStatus: document.querySelector("#personStatus"),
  peopleList: document.querySelector("#peopleList"),
  clearChatButton: document.querySelector("#clearChatButton"),
  chatLog: document.querySelector("#chatLog"),
  chatForm: document.querySelector("#chatForm"),
  chatAuthor: document.querySelector("#chatAuthor"),
  chatMessage: document.querySelector("#chatMessage"),
  emptyTemplate: document.querySelector("#emptyTemplate")
};

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

function saveState(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!options.skipCloud && services && currentUser && !isApplyingCloudState) {
    syncActiveBoardToCloud();
  }
}

function activeBoard() {
  return state.boards.find((board) => board.id === state.activeBoardId) ?? state.boards[0];
}

function normalizeBoard(board) {
  const members = board.members ?? {};
  if (currentUser) members[currentUser.uid] = true;

  return {
    ...board,
    members,
    memberIds: Object.keys(members),
    schedule: board.schedule ?? [],
    activities: board.activities ?? [],
    people: board.people ?? [],
    messages: board.messages ?? []
  };
}

function updateBoard(updater) {
  const board = activeBoard();
  updater(board);
  saveState();
  renderPlanner();
}

function showAuthScreen() {
  elements.authScreen.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
}

function showPlanner() {
  elements.authScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
}

function setAuthError(message = "") {
  elements.authError.textContent = message;
  elements.authError.classList.toggle("hidden", !message);
}

function setAuthLoading(isLoading) {
  elements.emailSignInButton.disabled = isLoading;
  elements.emailSignUpButton.disabled = isLoading;
  elements.googleSignInButton.disabled = isLoading;
}

function renderAccount() {
  elements.authStatus.textContent = "Signed in";
  elements.authDetail.textContent = currentUser?.email || currentUser?.displayName || "Authenticated user";
}

function renderPlanner() {
  if (!currentUser) return;

  const board = activeBoard();
  state.activeBoardId = board.id;

  renderAccount();
  renderBoards();
  elements.activeBoardName.value = board.name;
  elements.boardMeta.textContent = `${board.schedule.length} times · ${board.activities.length} activities · ${board.messages.length} messages`;

  const next = sortSchedule(board.schedule)[0];
  elements.nextEvent.textContent = next ? `${next.activity} · ${formatDateTime(next)}` : "No scheduled times";

  const top = [...board.activities].sort((a, b) => b.votes - a.votes)[0];
  elements.topActivity.textContent = top ? `${top.name} (${top.votes})` : "No votes yet";
  elements.peopleCount.textContent = `${board.people.length} ${board.people.length === 1 ? "member" : "members"}`;

  renderSchedule(board);
  renderActivities(board);
  renderPeople(board);
  renderChat(board);
}

function renderBoards() {
  elements.boardList.replaceChildren(
    ...state.boards.map((board) => {
      const button = document.createElement("button");
      button.className = `board-tab${board.id === state.activeBoardId ? " active" : ""}`;
      button.type = "button";
      button.innerHTML = `<strong></strong><span></span>`;
      button.querySelector("strong").textContent = board.name;
      button.querySelector("span").textContent = `${board.schedule.length} planned · ${board.people.length} people`;
      button.addEventListener("click", () => {
        state.activeBoardId = board.id;
        saveState();
        renderPlanner();
      });
      return button;
    })
  );
}

function renderSchedule(board) {
  const items = sortSchedule(board.schedule).map((item) =>
    planningItem({
      title: item.activity,
      meta: formatDateTime(item),
      onDelete: () => updateBoard((draft) => removeById(draft.schedule, item.id))
    })
  );
  elements.scheduleList.replaceChildren(...(items.length ? items : [emptyState("No times scheduled yet")]));
}

function renderActivities(board) {
  const items = [...board.activities]
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
    .map((item) =>
      planningItem({
        title: item.name,
        meta: `${item.type} · ${item.votes} ${item.votes === 1 ? "vote" : "votes"}`,
        voteCount: item.votes,
        onVote: () => updateBoard((draft) => {
          draft.activities.find((activity) => activity.id === item.id).votes += 1;
        }),
        onDelete: () => updateBoard((draft) => removeById(draft.activities, item.id))
      })
    );
  elements.activityList.replaceChildren(...(items.length ? items : [emptyState("No activity ideas yet")]));
}

function renderPeople(board) {
  const items = board.people.map((item) =>
    planningItem({
      title: item.name,
      meta: item.status || "Availability not set",
      onDelete: () => updateBoard((draft) => removeById(draft.people, item.id))
    })
  );
  elements.peopleList.replaceChildren(...(items.length ? items : [emptyState("No people added yet")]));
}

function renderChat(board) {
  const messages = board.messages.map((message) => {
    const bubble = document.createElement("div");
    bubble.className = "message";
    const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt));
    bubble.innerHTML = `<strong></strong><span></span><div class="meta-line"></div>`;
    bubble.querySelector("strong").textContent = message.author;
    bubble.querySelector("span").textContent = message.text;
    bubble.querySelector(".meta-line").textContent = time;
    return bubble;
  });

  elements.chatLog.replaceChildren(...(messages.length ? messages : [emptyState("No messages yet")]));
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function planningItem({ title, meta, voteCount, onVote, onDelete }) {
  const row = document.createElement("article");
  row.className = "planning-item";
  row.innerHTML = `
    <div>
      <strong></strong>
      <div class="meta-line"></div>
    </div>
    <div class="item-actions"></div>
  `;
  row.querySelector("strong").textContent = title;
  row.querySelector(".meta-line").textContent = meta;

  const actions = row.querySelector(".item-actions");
  if (onVote) {
    const vote = document.createElement("button");
    vote.className = "vote-pill";
    vote.type = "button";
    vote.title = "Vote";
    vote.textContent = `+ ${voteCount}`;
    vote.addEventListener("click", onVote);
    actions.append(vote);
  }

  const remove = document.createElement("button");
  remove.className = "icon-button delete-item";
  remove.type = "button";
  remove.title = "Delete";
  remove.setAttribute("aria-label", "Delete");
  remove.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>`;
  remove.addEventListener("click", onDelete);
  actions.append(remove);

  return row;
}

function emptyState(text) {
  const node = elements.emptyTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector("p").textContent = text;
  return node;
}

function removeById(collection, id) {
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) collection.splice(index, 1);
}

function toggleForm(form) {
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) {
    form.querySelector("input, select")?.focus();
  }
}

function formatDateTime(item) {
  const date = new Date(`${item.date}T${item.start}`);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
  return `${dateLabel}, ${item.start} - ${item.end}`;
}

function sortSchedule(schedule) {
  return [...schedule].sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
}

function createBoard(name) {
  const board = normalizeBoard({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    members: {},
    schedule: [],
    activities: [],
    people: [],
    messages: []
  });
  state.boards.unshift(board);
  state.activeBoardId = board.id;
  saveState();
  renderPlanner();
}

async function uploadLocalBoardsForUser() {
  const boards = state.boards.map((board) => normalizeBoard(board));
  await Promise.all(boards.map((board) => saveBoard(services.db, board)));
}

async function syncActiveBoardToCloud() {
  await saveBoard(services.db, normalizeBoard(activeBoard()));
}

async function handleAuthenticatedUser(user) {
  currentUser = user;
  showPlanner();
  renderAccount();

  if (unsubscribeBoards) unsubscribeBoards();

  unsubscribeBoards = subscribeToUserBoards(services.db, user.uid, async (boards) => {
    if (!boards.length) {
      await uploadLocalBoardsForUser();
      return;
    }

    isApplyingCloudState = true;
    state.boards = boards.map((board) => normalizeBoard(board));
    if (!state.boards.some((board) => board.id === state.activeBoardId)) {
      state.activeBoardId = state.boards[0].id;
    }
    saveState({ skipCloud: true });
    isApplyingCloudState = false;
    renderPlanner();
  });
}

function handleSignedOutUser() {
  currentUser = null;
  if (unsubscribeBoards) {
    unsubscribeBoards();
    unsubscribeBoards = null;
  }
  showAuthScreen();
}

async function authenticateWithEmail(mode) {
  setAuthError();
  setAuthLoading(true);

  try {
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;
    if (mode === "signUp") {
      await createAccountWithEmail(services.auth, email, password);
    } else {
      await signInWithEmail(services.auth, email, password);
    }
    elements.emailAuthForm.reset();
  } catch (error) {
    setAuthError(getFriendlyAuthError(error));
  } finally {
    setAuthLoading(false);
  }
}

function bindEvents() {
  elements.emailAuthForm.addEventListener("submit", (event) => {
    event.preventDefault();
    authenticateWithEmail("signIn");
  });

  elements.emailSignUpButton.addEventListener("click", () => {
    authenticateWithEmail("signUp");
  });

  elements.googleSignInButton.addEventListener("click", async () => {
    setAuthError();
    setAuthLoading(true);
    try {
      await signInWithGoogle(services.auth);
    } catch (error) {
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  });

  elements.signOutButton.addEventListener("click", () => {
    signOutUser(services.auth);
  });

  elements.boardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createBoard(elements.boardName.value.trim());
    elements.boardForm.reset();
  });

  elements.activeBoardName.addEventListener("input", () => {
    activeBoard().name = elements.activeBoardName.value.trim() || "Untitled board";
    saveState();
    renderBoards();
  });

  elements.deleteBoardButton.addEventListener("click", async () => {
    const removedBoardId = state.activeBoardId;

    if (state.boards.length === 1) {
      state.boards = [
        normalizeBoard({
          id: crypto.randomUUID(),
          name: "Fresh board",
          createdAt: new Date().toISOString(),
          members: {},
          schedule: [],
          activities: [],
          people: [],
          messages: []
        })
      ];
      state.activeBoardId = state.boards[0].id;
    } else {
      state.boards = state.boards.filter((board) => board.id !== removedBoardId);
      state.activeBoardId = state.boards[0].id;
    }

    await deleteBoard(services.db, currentUser.uid, removedBoardId);
    await saveBoard(services.db, normalizeBoard(activeBoard()));
    saveState();
    renderPlanner();
  });

  elements.seedButton.addEventListener("click", () => {
    updateBoard((board) => {
      board.schedule.push({
        id: crypto.randomUUID(),
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        start: "19:30",
        end: "21:00",
        activity: "Group vote and warm-up"
      });
      board.activities.push({ id: crypto.randomUUID(), name: "Try something new", type: "Other", votes: 1 });
      board.people.push({ id: crypto.randomUUID(), name: "Alex", status: "Free tomorrow night" });
      board.messages.push({
        id: crypto.randomUUID(),
        author: "Planner",
        text: "Added a few sample pieces for this board.",
        createdAt: new Date().toISOString()
      });
    });
  });

  elements.addTimeButton.addEventListener("click", () => toggleForm(elements.timeForm));
  elements.addActivityButton.addEventListener("click", () => toggleForm(elements.activityForm));
  elements.addPersonButton.addEventListener("click", () => toggleForm(elements.personForm));

  elements.timeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateBoard((board) => {
      board.schedule.push({
        id: crypto.randomUUID(),
        date: elements.timeDate.value,
        start: elements.timeStart.value,
        end: elements.timeEnd.value,
        activity: elements.timeActivity.value.trim()
      });
    });
    elements.timeForm.reset();
    elements.timeForm.classList.add("hidden");
  });

  elements.activityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateBoard((board) => {
      board.activities.push({
        id: crypto.randomUUID(),
        name: elements.activityName.value.trim(),
        type: elements.activityType.value,
        votes: 0
      });
    });
    elements.activityForm.reset();
    elements.activityForm.classList.add("hidden");
  });

  elements.personForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateBoard((board) => {
      board.people.push({
        id: crypto.randomUUID(),
        name: elements.personName.value.trim(),
        status: elements.personStatus.value.trim()
      });
    });
    elements.personForm.reset();
    elements.personForm.classList.add("hidden");
  });

  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateBoard((board) => {
      board.messages.push({
        id: crypto.randomUUID(),
        author: elements.chatAuthor.value.trim(),
        text: elements.chatMessage.value.trim(),
        createdAt: new Date().toISOString()
      });
    });
    elements.chatMessage.value = "";
    elements.chatMessage.focus();
  });

  elements.clearChatButton.addEventListener("click", () => {
    updateBoard((board) => {
      board.messages = [];
    });
  });
}

function startApp() {
  bindEvents();

  try {
    services = getFirebaseServices();
    watchAuthState(services.auth, (user) => {
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
