import { httpsCallable } from "firebase/functions";
import { onValue, ref } from "firebase/database";

// Ask the backend for a "Sign in through Steam" URL (nonce tied to the caller).
export async function getSteamLoginUrl(functions) {
  const callable = httpsCallable(functions, "steamLoginUrl");
  const result = await callable();
  return result.data?.url;
}

// Persist the caller's hidden-game set and re-derive their shared library on
// every board. `hidden` is a map of appid -> true.
export async function updateHiddenGames(functions, hidden) {
  const callable = httpsCallable(functions, "updateHiddenGames");
  const result = await callable({ hidden });
  return result.data;
}

// Live map of uid -> { steamId, persona, games } for everyone on a board who
// has linked Steam (shared, non-hidden games only). Readable by board members.
export function subscribeBoardSteam(db, boardId, onChange) {
  return onValue(ref(db, `boardSteam/${boardId}`), (snapshot) => onChange(snapshot.val() || {}));
}

// Live view of the caller's own full Steam record { steamId, persona, games,
// hidden }. Private — only readable by the owner.
export function subscribeMySteam(db, uid, onChange) {
  return onValue(ref(db, `steamUsers/${uid}`), (snapshot) => onChange(snapshot.val()));
}
