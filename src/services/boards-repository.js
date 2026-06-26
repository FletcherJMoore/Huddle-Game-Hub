import { get, onValue, ref, remove, serverTimestamp, set, update } from "firebase/database";

// Live subscription: watches the user's set of board ids AND attaches an
// onValue listener to each board so content changes (messages, approvals, read
// receipts, etc.) stream in real time. Emits the full board list on every
// change once the initial set has loaded.
export function subscribeToUserBoards(db, uid, onBoardsChange) {
  const userBoardsRef = ref(db, `userBoards/${uid}`);
  const boardCache = new Map(); // boardId -> board data (only existing boards)
  const boardUnsubs = new Map(); // boardId -> off()
  const resolved = new Set(); // boardIds that have fired at least once
  let currentIds = [];

  function allResolved() {
    return currentIds.every((id) => resolved.has(id));
  }

  function emit() {
    onBoardsChange(currentIds.map((id) => boardCache.get(id)).filter(Boolean));
  }

  const userBoardsUnsub = onValue(userBoardsRef, (snapshot) => {
    currentIds = Object.keys(snapshot.val() ?? {});
    const idSet = new Set(currentIds);

    // Detach boards the user no longer belongs to.
    for (const [id, off] of boardUnsubs) {
      if (!idSet.has(id)) {
        off();
        boardUnsubs.delete(id);
        boardCache.delete(id);
        resolved.delete(id);
      }
    }

    // Attach a live listener for each newly added board.
    currentIds.forEach((id) => {
      if (boardUnsubs.has(id)) return;
      const off = onValue(ref(db, `boards/${id}`), (snap) => {
        resolved.add(id);
        if (snap.exists()) boardCache.set(id, { id: snap.key, ...snap.val() });
        else boardCache.delete(id);
        if (allResolved()) emit();
      });
      boardUnsubs.set(id, off);
    });

    // Emit immediately when the set is empty (so the app can seed/upload) or
    // when a removal leaves everything already resolved.
    if (currentIds.length === 0 || allResolved()) emit();
  });

  return () => {
    userBoardsUnsub();
    for (const off of boardUnsubs.values()) off();
    boardUnsubs.clear();
    boardCache.clear();
    resolved.clear();
  };
}

export async function getBoard(db, boardId) {
  const snapshot = await get(ref(db, `boards/${boardId}`));
  if (!snapshot.exists()) return null;
  return { id: snapshot.key, ...snapshot.val() };
}

export async function saveBoard(db, board, uid) {
  const members = board.members ?? {};

  await set(ref(db, `boards/${board.id}`), {
    ...board,
    members,
    updatedAt: serverTimestamp()
  });

  // Each member owns their own userBoards pointer (DB rules only allow a user
  // to write their own). Co-members add their pointer when they join.
  if (uid) {
    await set(ref(db, `userBoards/${uid}/${board.id}`), true);
  }
}

// Upsert just the caller's own profile so co-members can see their name.
export async function ensureMemberProfile(db, boardId, uid, profile) {
  await update(ref(db), {
    [`boards/${boardId}/memberProfiles/${uid}`]: profile
  });
}

export async function deleteBoard(db, uid, boardId) {
  await remove(ref(db, `boards/${boardId}`));
  await remove(ref(db, `userBoards/${uid}/${boardId}`));
}
