import { get, onValue, ref, remove, serverTimestamp, set } from "firebase/database";

export function subscribeToUserBoards(db, uid, onBoardsChange) {
  const userBoardsRef = ref(db, `userBoards/${uid}`);

  return onValue(userBoardsRef, async (snapshot) => {
    const boardIds = Object.keys(snapshot.val() ?? {});
    const boards = await Promise.all(boardIds.map((boardId) => getBoard(db, boardId)));
    onBoardsChange(boards.filter(Boolean));
  });
}

export async function getBoard(db, boardId) {
  const snapshot = await get(ref(db, `boards/${boardId}`));
  if (!snapshot.exists()) return null;
  return { id: snapshot.key, ...snapshot.val() };
}

export async function saveBoard(db, board) {
  const members = board.members ?? {};

  await set(ref(db, `boards/${board.id}`), {
    ...board,
    members,
    updatedAt: serverTimestamp()
  });

  await Promise.all(
    Object.keys(members).map((uid) => set(ref(db, `userBoards/${uid}/${board.id}`), true))
  );
}

export async function deleteBoard(db, uid, boardId) {
  await remove(ref(db, `boards/${boardId}`));
  await remove(ref(db, `userBoards/${uid}/${boardId}`));
}
