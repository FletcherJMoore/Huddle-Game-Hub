import { firebaseConfig } from "./firebase-config.js";

const STORAGE_KEY = "planner-board-state-v1";
const FIREBASE_SDK_VERSION = "11.10.0";

const defaultState = {
  activeBoardId: "board-game-night",
  boards: [
    {
      id: "board-game-night",
      name: "Game Night",
      createdAt: new Date().toISOString(),
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
let firebaseApi = null;
let currentUser = null;
let cloudUnsubscribe = null;
let isApplyingCloudState = false;
let authMode = "signIn";

const elements = {
  boardForm: document.querySelector("#boardForm"),
  boardName: document.querySelector("#boardName"),
  boardList: document.querySelector("#boardList"),
  authStatus: document.querySelector("#authStatus"),
  authDetail: document.querySelector("#authDetail"),
  emailAuthForm: document.querySelector("#emailAuthForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  emailSignInButton: document.querySelector("#emailSignInButton"),
  emailSignUpButton: document.querySelector("#emailSignUpButton"),
  googleSignInButton: document.querySelector("#googleSignInButton"),
  signOutButton: document.querySelector("#signOutButton"),
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
  if (!options.skipCloud && firebaseApi && currentUser && !isApplyingCloudState) {
    syncActiveBoardToCloud();
  }
}

function activeBoard() {
  return state.boards.find((board) => board.id === state.activeBoardId) ?? state.boards[0];
}

function updateBoard(updater) {
  const board = activeBoard();
  updater(board);
  saveState();
  render();
}

function normalizeBoard(board) {
  const members = board.members ?? (board.memberIds ?? []).reduce((map, uid) => ({ ...map, [uid]: true }), {});
  if (currentUser && !Object.keys(members).length) members[currentUser.uid] = true;

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

function render() {
  const board = activeBoard();
  state.activeBoardId = board.id;

  renderAuth();
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

function renderAuth() {
  if (!firebaseApi) {
    elements.authStatus.textContent = "Local draft mode";
    elements.authDetail.textContent = "Add Firebase config to sync boards.";
    elements.emailAuthForm.classList.remove("hidden");
    elements.emailSignInButton.disabled = true;
    elements.emailSignUpButton.disabled = true;
    elements.googleSignInButton.disabled = true;
    elements.signOutButton.classList.add("hidden");
    return;
  }

  elements.emailSignInButton.disabled = false;
  elements.emailSignUpButton.disabled = false;
  elements.googleSignInButton.disabled = false;

  if (currentUser) {
    elements.authStatus.textContent = "Signed in";
    elements.authDetail.textContent = currentUser.email || currentUser.uid;
    elements.emailAuthForm.classList.add("hidden");
    elements.googleSignInButton.classList.add("hidden");
    elements.signOutButton.classList.remove("hidden");
  } else {
    elements.authStatus.textContent = "Cloud sync ready";
    elements.authDetail.textContent = "Sign in to save boards to Firebase.";
    elements.emailAuthForm.classList.remove("hidden");
    elements.googleSignInButton.classList.remove("hidden");
    elements.signOutButton.classList.add("hidden");
  }
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
        render();
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

function createBoard(name) {
  const board = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    memberIds: currentUser ? [currentUser.uid] : [],
    members: currentUser ? { [currentUser.uid]: true } : {},
    schedule: [],
    activities: [],
    people: [],
    messages: []
  };
  state.boards.unshift(board);
  state.activeBoardId = board.id;
  saveState();
  render();
}

async function initializeFirebase() {
  const config = firebaseConfig;
  if (!config?.projectId) {
    renderAuth();
    return;
  }

  const [{ initializeApp }, authModule, databaseModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`)
  ]);

  const app = initializeApp(config);
  const auth = authModule.getAuth(app);
  const db = databaseModule.getDatabase(app);

  firebaseApi = {
    auth,
    db,
    GoogleAuthProvider: authModule.GoogleAuthProvider,
    createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
    get: databaseModule.get,
    getDatabase: databaseModule.getDatabase,
    off: databaseModule.off,
    onValue: databaseModule.onValue,
    ref: databaseModule.ref,
    remove: databaseModule.remove,
    serverTimestamp: databaseModule.serverTimestamp,
    set: databaseModule.set,
    signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
    signInWithPopup: authModule.signInWithPopup,
    signOut: authModule.signOut,
    onAuthStateChanged: authModule.onAuthStateChanged
  };

  firebaseApi.onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (cloudUnsubscribe) {
      cloudUnsubscribe();
      cloudUnsubscribe = null;
    }
    if (user) {
      subscribeToCloudBoards();
    }
    render();
  });

  renderAuth();
}

function subscribeToCloudBoards() {
  const userBoardsRef = firebaseApi.ref(firebaseApi.db, `userBoards/${currentUser.uid}`);

  cloudUnsubscribe = firebaseApi.onValue(userBoardsRef, async (snapshot) => {
    const boardIds = Object.keys(snapshot.val() ?? {});

    if (!boardIds.length) {
      await uploadLocalBoardsForUser();
      return;
    }

    const boardSnapshots = await Promise.all(
      boardIds.map((boardId) => firebaseApi.get(firebaseApi.ref(firebaseApi.db, `boards/${boardId}`)))
    );
    const boards = boardSnapshots
      .filter((boardSnapshot) => boardSnapshot.exists())
      .map((boardSnapshot) => normalizeBoard({ id: boardSnapshot.key, ...boardSnapshot.val() }));

    if (!boards.length) return;

    isApplyingCloudState = true;
    state.boards = boards;
    if (!state.boards.some((board) => board.id === state.activeBoardId)) {
      state.activeBoardId = state.boards[0].id;
    }
    saveState({ skipCloud: true });
    isApplyingCloudState = false;
    render();
  });
}

async function uploadLocalBoardsForUser() {
  const boards = state.boards.map((board) => normalizeBoard(board));
  await Promise.all(boards.map((board) => saveBoardToCloud(board)));
}

async function syncActiveBoardToCloud() {
  const board = normalizeBoard(activeBoard());
  await saveBoardToCloud(board);
}

async function saveBoardToCloud(board) {
  const normalized = normalizeBoard(board);
  await firebaseApi.set(firebaseApi.ref(firebaseApi.db, `boards/${normalized.id}`), {
    ...normalized,
    updatedAt: firebaseApi.serverTimestamp()
  });
  await Promise.all(Object.keys(normalized.members).map((uid) =>
    firebaseApi.set(firebaseApi.ref(firebaseApi.db, `userBoards/${uid}/${normalized.id}`), true)
  ));
}

async function deleteBoardFromCloud(boardId) {
  await firebaseApi.remove(firebaseApi.ref(firebaseApi.db, `boards/${boardId}`));
  await firebaseApi.remove(firebaseApi.ref(firebaseApi.db, `userBoards/${currentUser.uid}/${boardId}`));
}

async function signInWithEmail() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || !password) return;

  if (authMode === "signUp") {
    await firebaseApi.createUserWithEmailAndPassword(firebaseApi.auth, email, password);
  } else {
    await firebaseApi.signInWithEmailAndPassword(firebaseApi.auth, email, password);
  }
  elements.emailAuthForm.reset();
}

elements.boardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createBoard(elements.boardName.value.trim());
  elements.boardForm.reset();
});

elements.emailAuthForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!firebaseApi) return;
  authMode = "signIn";
  await signInWithEmail();
});

elements.emailSignUpButton.addEventListener("click", async () => {
  if (!firebaseApi) return;
  authMode = "signUp";
  await signInWithEmail();
});

elements.googleSignInButton.addEventListener("click", async () => {
  if (!firebaseApi) return;
  const provider = new firebaseApi.GoogleAuthProvider();
  await firebaseApi.signInWithPopup(firebaseApi.auth, provider);
});

elements.signOutButton.addEventListener("click", async () => {
  if (!firebaseApi) return;
  await firebaseApi.signOut(firebaseApi.auth);
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
      {
        id: crypto.randomUUID(),
        name: "Fresh board",
        createdAt: new Date().toISOString(),
        memberIds: currentUser ? [currentUser.uid] : [],
        members: currentUser ? { [currentUser.uid]: true } : {},
        schedule: [],
        activities: [],
        people: [],
        messages: []
      }
    ];
    state.activeBoardId = state.boards[0].id;
  } else {
    state.boards = state.boards.filter((board) => board.id !== removedBoardId);
    state.activeBoardId = state.boards[0].id;
  }

  if (firebaseApi && currentUser) {
    await deleteBoardFromCloud(removedBoardId);
    await saveBoardToCloud(activeBoard());
  }

  saveState();
  render();
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

render();
initializeFirebase().catch((error) => {
  console.error("Firebase setup failed", error);
  renderAuth();
});
